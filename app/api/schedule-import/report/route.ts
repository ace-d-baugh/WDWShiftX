import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'
import { optionalServerEnv } from '@/lib/env'
import { EMAIL_FROM, SUPPORT_EMAIL } from '@/lib/email-constants'

// Task 15 follow-up: when the schedule reader disappoints, the user can send
// the exact photo it saw to support@wdwshiftx.com so real-world failures feed
// back into prompt/pipeline improvements. Explicit user action only — the
// image is never forwarded automatically.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const CONTEXT_LABEL: Record<string, string> = {
  no_shifts: 'Reader found no shifts',
  review: 'Results were incomplete or wrong (review step)',
}

// Best-effort spam brake for the support inbox: per-user timestamps kept in
// module scope. Serverless caveat — each warm instance has its own map, so
// this blunts rapid-fire bursts (which hit the same warm instance) rather
// than guaranteeing a global cap. Good enough for an authenticated,
// email-sending endpoint at beta scale.
const RATE_WINDOW_MS = 10 * 60_000
const RATE_MAX_PER_WINDOW = 3
const recentReports = new Map<string, number[]>()

function reportRateLimited(userId: string): boolean {
  const now = Date.now()
  const times = (recentReports.get(userId) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (times.length >= RATE_MAX_PER_WINDOW) {
    recentReports.set(userId, times)
    return true
  }
  times.push(now)
  recentReports.set(userId, times)
  return false
}

export async function POST(req: NextRequest) {
  if (!optionalServerEnv.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Reporting is not configured.' }, { status: 503 })
  }

  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (reportRateLimited(user.id)) {
    return NextResponse.json(
      { error: "You've sent several reports recently — thank you! Please try again in a few minutes." },
      { status: 429 }
    )
  }

  let file: File | null = null
  let context = ''
  let shiftsJson = ''
  try {
    const form = await req.formData()
    const entry = form.get('image')
    if (entry instanceof File) file = entry
    const c = form.get('context')
    if (typeof c === 'string' && c in CONTEXT_LABEL) context = c
    const s = form.get('shifts')
    // What the reader returned — invaluable for diagnosing partial misses.
    if (typeof s === 'string') shiftsJson = s.slice(0, 10_000)
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 })
  }
  if (!file || !ALLOWED_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Invalid image.' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeName = escHtml(profile?.display_name ?? 'Unknown')
  const safeEmail = escHtml(user.email ?? 'no email')

  const resend = new Resend(optionalServerEnv.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: SUPPORT_EMAIL,
    replyTo: user.email,
    subject: `Schedule import feedback — ${CONTEXT_LABEL[context] ?? 'unspecified'}`,
    html: `
      <h2 style="margin:0 0 12px;">Schedule import feedback</h2>
      <p style="margin:0 0 4px;"><strong>What happened:</strong> ${CONTEXT_LABEL[context] ?? 'unspecified'}</p>
      <p style="margin:0 0 4px;"><strong>User:</strong> ${safeName} (${safeEmail})</p>
      <p style="margin:0 0 4px;"><strong>User id:</strong> ${user.id}</p>
      <p style="margin:0 0 12px;"><strong>Sent:</strong> ${new Date().toISOString()}</p>
      ${shiftsJson ? `<p style="margin:0 0 4px;"><strong>What the reader returned:</strong></p><pre style="background:#f4f4f4;padding:8px;border-radius:4px;font-size:12px;white-space:pre-wrap;">${shiftsJson.replace(/</g, '&lt;')}</pre>` : '<p style="margin:0 0 12px;">Reader returned zero shifts.</p>'}
      <p style="margin:12px 0 0;font-size:12px;color:#777;">The photo the reader processed is attached. Reply to this email to reach the user.</p>
    `,
    attachments: [{
      filename: 'schedule.jpg',
      content: Buffer.from(await file.arrayBuffer()).toString('base64'),
    }],
  })

  if (error) {
    console.error('[schedule-import/report] Resend error:', error)
    return NextResponse.json({ error: 'Could not send the report. Please try again.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
