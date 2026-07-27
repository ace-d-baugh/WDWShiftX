import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { optionalServerEnv } from '@/lib/env'

// Gemini answers in 5-15s; 90s covers a slow inference plus the endpoint
// fallback attempt without holding the function open needlessly.
export const maxDuration = 90

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

// Total time budget for reaching the model, shared across both endpoint
// attempts. maxDuration is 90s, so two independent 60s timeouts could exceed
// the function's own lifetime and get us killed mid-retry — the user sees a
// generic failure and we may still have been billed for the first call.
const MODEL_BUDGET_MS = 75_000

// file.type is whatever the uploader's browser claimed in the multipart
// headers — it is not derived from the bytes, so it validates nothing. Sniff
// the actual magic bytes instead and use the sniffed type downstream.
const SIGNATURES: [string, number[]][] = [
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png',  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/webp', [0x52, 0x49, 0x46, 0x46]], // 'RIFF'; bytes 8-11 must be 'WEBP'
]

function sniffImageType(buf: Buffer): string | null {
  for (const [mime, sig] of SIGNATURES) {
    if (sig.every((b, i) => buf[i] === b)) {
      if (mime === 'image/webp' && buf.subarray(8, 12).toString('ascii') !== 'WEBP') continue
      return mime
    }
  }
  return null
}

// Shape returned to the client (ScheduleImportModal).
const parsedShiftSchema = z.object({
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_time:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title:      z.string().trim().max(35).optional(),
})

// Gemini rows carry an explicit end_date for overnight shifts; the client
// derives overnight from end <= start, so end_date is validated but unused.
const geminiShiftSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_time:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title:      z.string().trim().max(35).optional(),
})

// Prompt validated by hand against Gemini 2.5 Flash (see "Prompt That
// Worked" in schedule-from-image.md): benchmarked 2/2 on a real app
// screenshot and 8/8 on a dense synthetic table. It isolates the target
// employee's row on multi-employee schedules and resolves year-less dates
// by day-of-week alignment. One lesson from the earlier self-hosted-model
// benchmarks still applies here: never mention today's date in the prompt —
// it makes vision models tunnel-vision onto today's row.
function buildGeminiPrompt(userName: string): string {
  const target = userName.trim()
    ? `Target Name to find: ${userName.trim()}
If the image shows only a single person's schedule with no names, treat that schedule as the target's.`
    : `No target name is available. The image should show a single person's schedule — extract that schedule's shifts.`
  return `You are a highly accurate operational calendar parser for an employee shift tracking application. Your job is to analyze the attached schedule image and extract ONLY the work shifts that belong to the target employee specified below.

### Target Employee Context
${target}

Follow these execution steps precisely:

### Step 1: User Identification & Row Isolation
1. Scan the image for the target employee name. Look for exact matches, or the closest partial match (e.g., if the target name is "John Smith", look for "Smith, John", "John S.", or text partially truncated near a margin that uniquely matches).
2. Once the target name is identified, isolate ONLY the spatial region, row, or card associated directly with that name.
3. Explicitly discard all schedule blocks, rows, or tables belonging to any other employee. Do not extract or process any data lines outside of the target user's specific schedule boundaries.

### Step 2: Date & Shift Cross-Referencing
Schedule layouts vary. The two most common:
- Vertical lists: one date per row, reading top to bottom.
- Weekly grids: dates run across the top as column headers, one column per day — and several week-tables may be stacked vertically in the same image, each with its own header row of dates. In grid layouts, bind every time block to the date in ITS OWN column's header, and process EVERY week-table present, not just the first.

For the isolated data blocks belonging to the target employee, transcribe the following details step-by-step in your raw thinking space:
- The specific calendar date or day of the week header bound to that entry.
- The literal raw time window text exactly as written in the cell/block (e.g., "15:30 - 00:30").
- The literal location, role, or activity text associated with that specific time block.
Note: If a specific day is explicitly marked "OFF", "RDO", "LOA", "No Shifts", or with a named absence code — Holiday, FMLA, ADO, Vacation, PTO, Sick, or similar — note it as empty and skip it. These are not shifts and never carry a start/end time; do not invent one. The same applies to any day that is completely blank.

### Step 3: Normalization & Structural Rules
Convert your findings from Step 2 using these strict parameters:
1. Time Format: Convert all start and end times to 24-hour HH:MM strings (e.g., "15:30", "00:30"). If a time uses a 12-hour format, normalize it to 24-hour time.
2. Date Resolution: Extract the exact calendar year, month, and day from the document's main headers to construct a strict "YYYY-MM-DD" date string. If the schedule omits the year, dynamically resolve the correct calendar year by selecting the closest matching Gregorian calendar year where the written days of the week align perfectly with those specific calendar dates.
3. Over-Midnight (Overnight) Rules: If a shift's normalized end time is numerically less than or equal to its start time (e.g., Start: 22:00, End: 06:00), it runs past midnight. Calculate the end_date as exactly one calendar day AFTER the start_date.

### Step 4: Final JSON Output
Provide your final output at the very bottom inside a standard JSON code block matching the schema below. Output absolutely zero markdown or conversational prose outside of the JSON block once you reach this step.

{
  "shifts": [
    {
      "start_date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_date": "YYYY-MM-DD",
      "end_time": "HH:MM",
      "title": "Normalized Location/Role Title"
    }
  ]
}`
}

// The model answers in prose (transcription steps, then fenced JSON) — pull
// out the JSON object rather than assuming the whole reply parses.
function extractJson(content: string): string {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  return start >= 0 && end > start ? content.slice(start, end + 1) : content
}

// Normalize "3:15 PM" / "9:00" style times to strict 24-hour HH:MM so a
// model that ignores the 24-hour instruction doesn't cost the user a row.
function normalizeTime(t: unknown): unknown {
  if (typeof t !== 'string') return t
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return t
  let h = Number(m[1])
  const ampm = m[3]?.toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

export async function POST(req: NextRequest) {
  const { GEMINI_API_KEY } = optionalServerEnv
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Schedule import is not configured yet.' }, { status: 503 })
  }

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  // Validate the upload BEFORE spending a quota credit: a malformed request
  // should never cost the user an import, and doing it in this order means
  // those paths need no refund.
  let file: File | null = null
  let userName = ''
  try {
    const form = await req.formData()
    const entry = form.get('image')
    if (entry instanceof File) file = entry
    const name = form.get('name')
    // Only used to point the model at the right row on multi-employee
    // schedules — not a security input, but cap it defensively.
    if (typeof name === 'string') userName = name.slice(0, 80)
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: 'No image provided.' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image is too large (8 MB max).' }, { status: 400 })
  }

  const raw = Buffer.from(await file.arrayBuffer())
  const mimeType = sniffImageType(raw)
  if (!mimeType) {
    return NextResponse.json({ error: 'Please upload a JPEG, PNG, or WebP image.' }, { status: 400 })
  }

  // Atomically claim the import slot. Checking and spending in one locked
  // statement is what stops fifty simultaneous uploads from all passing a
  // check that none of them had yet incremented.
  const { data: reserveRows, error: reserveErr } = await supabase.rpc('reserve_schedule_import')
  const reservation = reserveRows?.[0]
  if (reserveErr || !reservation) {
    return NextResponse.json({ error: 'Could not verify your import quota. Please try again.' }, { status: 500 })
  }
  if (!reservation.reserved) {
    return NextResponse.json(
      { error: `You've used all ${reservation.import_limit} schedule imports for this month. Upgrade to Pro for unlimited imports.` },
      { status: 403 }
    )
  }

  // From here on the credit is spent, so every exit path that isn't a
  // successful read must hand it back. The finally block below does that for
  // all of them at once rather than relying on each early return remembering.
  let creditUsed = false
  try {
  const imageB64 = raw.toString('base64')
  const geminiModel = optionalServerEnv.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  // Google mints look-alike keys for two different surfaces (the key prefix
  // does NOT distinguish them): AI Studio keys work on the free-tier
  // generativelanguage endpoint, Vertex express keys only on the
  // billing-gated aiplatform endpoint. Same request/response shape on both —
  // try the free endpoint first and fall back on an auth error.
  const geminiBases = [
    'https://generativelanguage.googleapis.com/v1beta/models',
    'https://aiplatform.googleapis.com/v1/publishers/google/models',
  ]

  // Build the request body once, then drop our own references to the large
  // intermediates. An 8 MB upload otherwise sits in memory four times over
  // (ArrayBuffer + Buffer + base64 string + serialized body) for the whole
  // duration of the network wait.
  const body = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: imageB64 } },
        { text: buildGeminiPrompt(userName) },
      ],
    }],
    generationConfig: { temperature: 0 },
  })
  file = null

  let content: string
  try {
    const deadline = Date.now() + MODEL_BUDGET_MS
    let res: Response | null = null
    for (const base of geminiBases) {
      const remaining = deadline - Date.now()
      // Not enough of the budget left for a meaningful attempt — better to
      // fail cleanly than be killed mid-request by the function timeout.
      if (remaining <= 5_000) break
      res = await fetch(`${base}/${geminiModel}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body,
        signal: AbortSignal.timeout(remaining),
      })
      // 401/403 = wrong surface for this key type — try the other one.
      if (res.status !== 401 && res.status !== 403) break
    }
    if (!res) throw new Error('Ran out of time budget before reaching the model')
    if (res.status === 429) {
      console.error('[schedule-import] Gemini rate limit hit (429)')
      return NextResponse.json(
        { error: "Schedule import is really popular right now — please try again in a moment." },
        { status: 429 }
      )
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[schedule-import] Gemini HTTP ${res.status}:`, detail.slice(0, 500))
      return NextResponse.json({ error: 'The schedule reader is unavailable right now. Please try again in a minute.' }, { status: 502 })
    }
    const json = await res.json() as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    }
    // eslint-disable-next-line no-console -- operational metrics, not debug noise
    console.log(
      `[schedule-import] model=${geminiModel} prompt_tokens=${json.usageMetadata?.promptTokenCount ?? '?'}` +
      ` output_tokens=${json.usageMetadata?.candidatesTokenCount ?? '?'}`
    )
    content = (json.candidates?.[0]?.content?.parts ?? [])
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text)
      .join('')
  } catch (err) {
    console.error('[schedule-import] Gemini request failed:', err)
    return NextResponse.json({ error: 'Could not reach the schedule reader. Please try again.' }, { status: 502 })
  }

  let shifts: z.infer<typeof parsedShiftSchema>[]
  try {
    const parsed = JSON.parse(extractJson(content)) as { shifts?: unknown[] }
    shifts = (parsed.shifts ?? [])
      .map(s => {
        if (s && typeof s === 'object') {
          const o = s as Record<string, unknown>
          o.start_time = normalizeTime(o.start_time)
          o.end_time = normalizeTime(o.end_time)
        }
        // Gemini's schema names the date start_date and includes an
        // end_date; map to the client shape (overnight is re-derived from
        // end <= start on save, so end_date itself is validated then dropped).
        const g = geminiShiftSchema.safeParse(s)
        if (!g.success) return g
        const { start_date, start_time, end_time, title } = g.data
        return parsedShiftSchema.safeParse({ date: start_date, start_time, end_time, title })
      })
      .filter((r): r is { success: true; data: z.infer<typeof parsedShiftSchema> } => r.success)
      .map(r => r.data)
  } catch {
    console.error('[schedule-import] model returned unparseable content:', content.slice(0, 500))
    return NextResponse.json({ error: 'Could not read a schedule from that photo. Try a clearer, well-lit shot.' }, { status: 422 })
  }

  if (shifts.length === 0) {
    // A readable photo with no shifts shouldn't cost an import — leaving
    // creditUsed false makes the finally block refund it.
    return NextResponse.json({
      shifts: [],
      remaining: remainingFrom(reservation.used - 1, reservation.import_limit),
    })
  }

  // A real result: the credit reserved up front is now genuinely spent, so
  // the finally block must not hand it back.
  creditUsed = true

  return NextResponse.json({
    shifts,
    remaining: remainingFrom(reservation.used, reservation.import_limit),
  })
  } finally {
    if (!creditUsed) {
      await supabase.rpc('release_schedule_import')
    }
  }
}

/** -1 = unlimited */
function remainingFrom(used: number, limit: number): number {
  return limit < 0 ? -1 : Math.max(0, limit - used)
}
