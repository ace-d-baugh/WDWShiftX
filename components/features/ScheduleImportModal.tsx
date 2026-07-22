'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Plus, ScanLine, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

import { fetchMyBoards, type MyBoard as Board } from '@/lib/boards'

interface ParsedShift {
  date: string
  start_time: string
  end_time: string
  title?: string
}

interface ImportRow {
  include: boolean
  date: string
  start: string
  end: string
  title: string
}

interface ExistingShift {
  id: string
  start_time: string
  end_time: string
  shift_title: string
}

// [start, end) of a row, with the same overnight roll-forward used on save.
function rowSpan(r: ImportRow): { s: Date; e: Date } | null {
  if (!r.date || !r.start || !r.end) return null
  const s = new Date(`${r.date}T${r.start}`)
  const e = new Date(`${r.date}T${r.end}`)
  if (e <= s) e.setDate(e.getDate() + 1)
  return { s, e }
}

interface ScheduleImportModalProps {
  userId: string
  displayName: string
  open: boolean
  onClose: () => void
}

type Step = 'pick' | 'reading' | 'review' | 'saving' | 'done'

// Downscale + re-encode to JPEG before upload: keeps HEIC photos out of the
// pipeline (iOS decodes them locally) and shrinks multi-MB camera shots so
// uploads stay fast and token costs stay low.
//
// Scaling is by pixel AREA, not longest side: a 1600px max-dimension cap
// crushed wide weekly-grid screenshots (e.g. 2000×661 → 1600×529), shrinking
// the text height until Gemini found zero shifts, while tall list layouts
// sailed through. Small screenshots now upload untouched; only genuinely
// large photos shrink — and never below ~720px on the short side, which is
// where the text height lives.
async function toJpeg(file: File, maxArea = 1600 * 1750): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image. Try a JPEG or PNG photo.'))
      el.src = url
    })
    const area = img.naturalWidth * img.naturalHeight
    let scale = Math.min(1, Math.sqrt(maxArea / area))
    const shortSide = Math.min(img.naturalWidth, img.naturalHeight)
    if (shortSide * scale < 720) scale = Math.min(1, 720 / shortSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    // JPEG has no alpha — transparent PNG screenshots would render on black,
    // tanking the reader's OCR. Paint white first.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not process that image.')), 'image/jpeg', 0.85)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Interactive photo viewer for the review step: wheel or pinch to zoom
// (anchored on the pointer, so you can inspect one cell of the schedule),
// drag to pan while zoomed, double-click/double-tap to toggle. At rest the
// container allows vertical touch panning so it doesn't trap modal scrolling.
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 })
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])

  // Live pointer positions (container-relative) and the gesture they anchor.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<
    | { kind: 'pan'; px: number; py: number; x: number; y: number }
    | { kind: 'pinch'; dist: number; cx: number; cy: number; scale: number; x: number; y: number }
    | null
  >(null)

  // Keep scale in [1, 6] and the image edges pinned to the viewport edges.
  const clamp = React.useCallback((scale: number, x: number, y: number) => {
    const el = ref.current
    const s = Math.min(6, Math.max(1, scale))
    if (!el) return { scale: s, x: 0, y: 0 }
    const { width, height } = el.getBoundingClientRect()
    return {
      scale: s,
      x: Math.min(0, Math.max(width - width * s, x)),
      y: Math.min(0, Math.max(height - height * s, y)),
    }
  }, [])

  // Native listener because React's onWheel can't reliably preventDefault
  // (passive by default) — and the page must not scroll while zooming.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const factor = Math.exp(-e.deltaY * 0.0022)
      setT(prev => {
        const s = Math.min(6, Math.max(1, prev.scale * factor))
        const r = s / prev.scale
        return clamp(s, px - (px - prev.x) * r, py - (py - prev.y) * r)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [clamp])

  // (Re)anchor the active gesture from whatever pointers are down — also
  // called on pointer-up so a pinch hands off cleanly to a one-finger pan.
  const startGesture = () => {
    const pts = [...pointers.current.values()]
    const { scale, x, y } = tRef.current
    if (pts.length >= 2) {
      const [a, b] = pts
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        scale, x, y,
      }
    } else if (pts.length === 1 && scale > 1) {
      gesture.current = { kind: 'pan', px: pts[0].x, py: pts[0].y, x, y }
    } else {
      gesture.current = null
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    pointers.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    e.currentTarget.setPointerCapture(e.pointerId)
    startGesture()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    const rect = e.currentTarget.getBoundingClientRect()
    pointers.current.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const s = Math.min(6, Math.max(1, g.scale * (dist / (g.dist || 1))))
      const r = s / g.scale
      setT(clamp(s, cx - (g.cx - g.x) * r, cy - (g.cy - g.y) * r))
    } else if (g.kind === 'pan' && pointers.current.size === 1) {
      const p = [...pointers.current.values()][0]
      setT(prev => clamp(prev.scale, g.x + (p.x - g.px), g.y + (p.y - g.py)))
    }
  }

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    startGesture()
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    setT(prev => prev.scale > 1
      ? { scale: 1, x: 0, y: 0 }
      : clamp(2.5, px * (1 - 2.5), py * (1 - 2.5)))
  }

  const zoomed = t.scale > 1
  return (
    <div
      ref={ref}
      className={`h-full w-full overflow-hidden select-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
      style={{ touchAction: zoomed ? 'none' : 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={onDoubleClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image can't optimize it */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full object-contain"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transformOrigin: '0 0' }}
      />
    </div>
  )
}

export function ScheduleImportModal({ userId, displayName, open, onClose }: ScheduleImportModalProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('pick')
  const [error, setError] = useState<string | null>(null)
  const [boards, setBoards] = useState<Board[]>([])
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [boardId, setBoardId] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [remaining, setRemaining] = useState<number | null>(null) // -1 = unlimited
  const [savedCount, setSavedCount] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingShifts, setExistingShifts] = useState<ExistingShift[]>([])
  const [replacedCount, setReplacedCount] = useState(0)

  // "Send this photo to our team" feedback (explicit user action only)
  const lastJpegRef = useRef<Blob | null>(null)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  const sendReport = async (context: 'no_shifts' | 'review') => {
    const blob = lastJpegRef.current
    if (!blob || reportState === 'sending' || reportState === 'sent') return
    setReportState('sending')
    try {
      const form = new FormData()
      form.append('image', blob, 'schedule.jpg')
      form.append('context', context)
      if (context === 'review') {
        form.append('shifts', JSON.stringify(rows.map(({ date, start, end, title }) => ({ date, start, end, title }))))
      }
      const res = await fetch('/api/schedule-import/report', { method: 'POST', body: form })
      if (!res.ok) throw new Error()
      setReportState('sent')
    } catch {
      setReportState('failed')
    }
  }

  // Revoke the previous object URL whenever it's replaced, and on unmount.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!open) return
    setStep('pick')
    setError(null)
    setRows([])
    setPreviewUrl(null)
    setExistingShifts([])
    setReplacedCount(0)
    lastJpegRef.current = null
    setReportState('idle')
    setBoardsLoading(true)

    const load = async () => {
      // Pending memberships count too (Task 22 v3): the calendar works while
      // a join request awaits approval — only wall posting stays gated.
      const [list, { data: statusRows }] = await Promise.all([
        fetchMyBoards(supabase, userId),
        supabase.rpc('get_schedule_import_status'),
      ])
      setBoards(list)
      if (list.length === 1) setBoardId(list[0].id)

      const status = statusRows?.[0]
      if (status) {
        setRemaining(status.import_limit < 0 ? -1 : Math.max(0, status.import_limit - status.used))
      }
      setBoardsLoading(false)
    }
    load()
  }, [open, supabase, userId])

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setStep('reading')
    try {
      const jpeg = await toJpeg(file)
      // Keep the exact image the reader sees so the review step can show it
      // next to the extracted rows — and so "send to our team" reports carry
      // the same pixels the model processed.
      lastJpegRef.current = jpeg
      setReportState('idle')
      setPreviewUrl(URL.createObjectURL(jpeg))
      const form = new FormData()
      form.append('image', jpeg, 'schedule.jpg')
      // Lets the reader isolate this user's row on multi-employee schedules.
      form.append('name', displayName)

      const res = await fetch('/api/schedule-import', { method: 'POST', body: form })
      const json = await res.json() as { error?: string; shifts?: ParsedShift[]; remaining?: number }
      if (!res.ok) throw new Error(json.error ?? 'Import failed. Please try again.')

      if (typeof json.remaining === 'number') setRemaining(json.remaining)
      const parsed = json.shifts ?? []
      if (parsed.length === 0) {
        setError('No shifts were found in that photo. Try a clearer, well-lit shot of the schedule.')
        setStep('pick')
        return
      }
      setRows(parsed.map(s => ({
        include: true,
        date: s.date,
        start: s.start_time,
        end: s.end_time,
        title: (s.title ?? '').slice(0, 35),
      })))
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.')
      setStep('pick')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const setRow = (i: number, patch: Partial<ImportRow>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  // When a board is picked, fetch the user's existing shifts around the
  // imported dates. Conflicts are derived from this list at render/save time
  // (so editing a row's times updates the warning live); rows that conflict
  // at fetch time start unchecked so a double-import can't slip through on a
  // blind "Add All".
  useEffect(() => {
    if (step !== 'review' || !boardId) return
    setExistingShifts([]) // don't show a previous board's conflicts while fetching
    let cancelled = false
    const loadExisting = async () => {
      const dates = rows.map(r => r.date).filter(Boolean).sort()
      if (dates.length === 0) return
      const from = new Date(`${dates[0]}T00:00:00`)
      from.setDate(from.getDate() - 1) // catch overnight shifts started the day before
      const to = new Date(`${dates[dates.length - 1]}T00:00:00`)
      to.setDate(to.getDate() + 2)
      const { data: existing } = await supabase
        .from('shifts')
        .select('id, start_time, end_time, shift_title')
        .eq('user_id', userId).eq('board_id', boardId).eq('is_active', true)
        .gte('start_time', from.toISOString()).lt('start_time', to.toISOString())
      if (cancelled || !existing) return
      setExistingShifts(existing)
      setRows(prev => prev.map(r => {
        const span = rowSpan(r)
        const conflicted = span && existing.some(x => new Date(x.start_time) < span.e && new Date(x.end_time) > span.s)
        return conflicted ? { ...r, include: false } : r
      }))
    }
    loadExisting()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rows deliberately omitted: this only fetches + sets initial checkbox state per board pick; conflicts themselves are derived live via conflictsFor
  }, [step, boardId, supabase, userId])

  const conflictsFor = (r: ImportRow): ExistingShift[] => {
    const span = rowSpan(r)
    if (!span) return []
    return existingShifts.filter(x => new Date(x.start_time) < span.e && new Date(x.end_time) > span.s)
  }

  const fmtShift = (x: ExistingShift) => {
    const s = new Date(x.start_time)
    const e = new Date(x.end_time)
    const day = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    const hm = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    return `"${x.shift_title}" (${day}, ${hm(s)}–${hm(e)})`
  }

  // The reader doesn't always catch every shift on a busy schedule — let
  // people fill in anything it missed rather than leave the modal empty-handed.
  const addRow = () =>
    setRows(prev => [...prev, { include: true, date: '', start: '', end: '', title: '' }])

  const included = rows.filter(r => r.include && r.date && r.start && r.end)
  const allIncluded = rows.length > 0 && rows.every(r => r.include)
  const someIncluded = rows.some(r => r.include)

  const handleSave = async () => {
    if (!boardId || included.length === 0) return
    setError(null)
    setStep('saving')
    try {
      const inserts = included.map(r => {
        const start = new Date(`${r.date}T${r.start}`)
        const end = new Date(`${r.date}T${r.end}`)
        // An end time at or before the start means the shift runs past
        // midnight (common for closing/late shifts) — roll end to next day.
        if (end <= start) end.setDate(end.getDate() + 1)
        return {
          created_by: displayName,
          user_id: userId,
          board_id: boardId,
          shift_title: r.title.trim() || 'Shift',
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          is_trade: false,
          is_giveaway: false,
          is_overtime_approved: false,
          details: null,
          is_active: true,
        }
      })
      const { error: insertErr } = await supabase.from('shifts').insert(inserts)
      if (insertErr) throw insertErr

      // Replace: soft-delete the existing shifts each included row overlapped
      // (same deactivate_own_shift RPC the Calendar's Delete action uses).
      // Runs after the insert so a failure here can't lose the old shifts
      // without the new ones existing.
      const replaceIds = [...new Set(included.flatMap(r => conflictsFor(r).map(x => x.id)))]
      if (replaceIds.length > 0) {
        const results = await Promise.all(
          replaceIds.map(id => supabase.rpc('deactivate_own_shift', { p_shift_id: id }))
        )
        if (results.some(res => res.error)) {
          setError('Shifts were added, but removing the replaced shift(s) failed — delete them from your Calendar manually.')
        }
      }
      setReplacedCount(replaceIds.length)
      setSavedCount(inserts.length)
      setStep('done')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shifts.')
      setStep('review')
    }
  }

  const quotaExhausted = remaining === 0

  return (
    <Modal open={open} onClose={onClose} title="Import Schedule from Photo" size="lg">
      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
          <p className="text-warning">{error}</p>
          {step === 'pick' && lastJpegRef.current && (
            reportState === 'sent' ? (
              <p className="mt-2 text-xs text-success">
                Photo sent — thank you! We&apos;ll use it to make the reader better.
              </p>
            ) : (
              <p className="mt-2 text-xs text-text/60">
                Think the reader should have gotten this one?{' '}
                <button
                  type="button"
                  onClick={() => sendReport('no_shifts')}
                  disabled={reportState === 'sending'}
                  className="text-primary underline min-h-0 min-w-0 disabled:opacity-50"
                >
                  {reportState === 'sending' ? 'Sending…' : 'Send this photo to our team'}
                </button>{' '}
                so we can improve it for everyone.
                {reportState === 'failed' && <span className="text-warning"> Couldn&apos;t send — please try again.</span>}
              </p>
            )
          )}
        </div>
      )}

      {!boardsLoading && boards.length === 0 && (
        <div className="py-8 text-center text-sm text-text/60">
          You haven&apos;t joined any boards yet.{' '}
          <a href="/profile#my-boards" className="text-primary underline">Join or create a board</a> first.
        </div>
      )}

      {(boardsLoading || boards.length > 0) && step === 'pick' && (
        <div className="space-y-4">
          <p className="text-sm text-text/70">
            Take a photo of your printed or on-screen schedule and WDWShiftX will read
            the shifts for you. You&apos;ll review everything before it&apos;s saved.
          </p>
          {remaining !== null && remaining >= 0 && (
            <p className="text-xs text-text/50">
              {remaining} of 4 free imports left this month.
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={quotaExhausted}
            className="w-full gap-2"
          >
            <Camera className="w-4 h-4" /> Choose or Take a Photo
          </Button>
          {quotaExhausted && (
            <p className="text-xs text-warning">
              You&apos;ve used all 4 imports this month. Upgrade to Pro for unlimited imports.
            </p>
          )}
        </div>
      )}

      {step === 'reading' && (
        <div className="flex flex-col items-center gap-3 py-10">
          <LoadingSpinner />
          <p className="text-sm text-text/70 flex items-center gap-1.5">
            <ScanLine className="w-4 h-4 text-primary" /> Reading your schedule…
          </p>
          <p className="text-xs text-text/40">This usually takes a few seconds.</p>
        </div>
      )}

      {/* Flex column so the photo preview and shifts table shrink (down to
        * their min-h floors) and scroll internally on short screens, keeping
        * the board picker and action buttons in view. */}
      {(step === 'review' || step === 'saving') && (
        <div className="flex min-h-0 flex-col gap-4">
          {previewUrl && (
            <div className="flex min-h-0 flex-col">
              <p className="text-xs text-text/50 mb-1">
                Your photo — scroll, pinch, or double-click to zoom in; drag to pan:
              </p>
              <div className="min-h-16 h-60 shrink rounded-lg border border-border overflow-hidden bg-black/5">
                <ZoomableImage key={previewUrl} src={previewUrl} alt="Your uploaded schedule" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text/60 mb-1">Add these shifts to board</label>
            <select className="input text-sm h-9" value={boardId} onChange={e => setBoardId(e.target.value)}>
              <option value="">Select a board…</option>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}{b.pending ? ' (pending approval)' : ''}</option>)}
            </select>
            {boards.find(b => b.id === boardId)?.pending && (
              <p className="mt-1 text-[11px] text-info">
                This board hasn&apos;t approved you yet — these shifts go on your calendar now, and
                posting to the wall unlocks once a board admin approves you.
              </p>
            )}
          </div>

          <div className="min-h-24 shrink rounded-lg border border-border overflow-auto">
            <table className="w-full text-sm">
              {/* Sticky (with a shadow standing in for the collapsed border-b,
                * which doesn't travel with position:sticky) so the column
                * labels and select-all stay visible while the rows scroll. */}
              <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--color-border))]">
                <tr className="text-left text-xs text-text/50">
                  <th className="px-2 py-2 w-8">
                    <Checkbox
                      checked={allIncluded}
                      indeterminate={someIncluded && !allIncluded}
                      onChange={() => setRows(prev => prev.map(r => ({ ...r, include: !allIncluded })))}
                      aria-label="Select all shifts"
                    />
                  </th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">End</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2 w-8"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const conflicts = conflictsFor(r)
                  return (
                  <React.Fragment key={i}>
                  <tr className={`${conflicts.length === 0 ? 'border-b' : ''} border-border last:border-0 ${r.include ? '' : 'opacity-40'}`}>
                    <td className="px-2 py-1.5">
                      <Checkbox checked={r.include} onChange={e => setRow(i, { include: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="date" className="input text-xs h-8 min-w-[8.5rem]" value={r.date}
                        onChange={e => setRow(i, { date: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="time" className="input text-xs h-8 min-w-[6rem]" value={r.start}
                        onChange={e => setRow(i, { start: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="time" className="input text-xs h-8 min-w-[6rem]" value={r.end}
                        onChange={e => setRow(i, { end: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="text" className="input text-xs h-8 min-w-[7rem]" value={r.title} maxLength={35}
                        placeholder="Shift" onChange={e => setRow(i, { title: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                        className="p-1 text-text/30 hover:text-warning min-h-0 min-w-0"
                        aria-label="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  {conflicts.length > 0 && (
                    <tr className={`border-b border-border last:border-0 ${r.include ? '' : 'opacity-40'}`}>
                      <td colSpan={6} className="px-2 pb-2 pt-0 text-left">
                        <p className="text-[11px] text-warning leading-snug">
                          Overlaps {conflicts.map(fmtShift).join(' and ')} already on your calendar.
                          If you add this shift, it will replace the one currently on your calendar —
                          or edit the times above so they don&apos;t overlap.
                        </p>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/70 transition-colors min-h-0"
          >
            <Plus className="w-4 h-4" /> Add a Shift Manually
          </button>

          <p className="text-xs text-text/40">
            Missing a shift? The reader doesn&apos;t always catch every row on a busy schedule — add it above.
            Shifts ending at or before their start time are saved as overnight shifts (ending the next day).{' '}
            {reportState === 'sent' ? (
              <span className="text-success">Photo sent — thank you!</span>
            ) : (
              <>
                Results way off?{' '}
                <button
                  type="button"
                  onClick={() => sendReport('review')}
                  disabled={reportState === 'sending'}
                  className="text-primary underline min-h-0 min-w-0 disabled:opacity-50"
                >
                  {reportState === 'sending' ? 'Sending…' : 'Send this photo to our team'}
                </button>{' '}
                so we can improve the reader.
                {reportState === 'failed' && <span className="text-warning"> Couldn&apos;t send — please try again.</span>}
              </>
            )}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={step === 'saving'}>Cancel</Button>
            <Button
              size="sm"
              loading={step === 'saving'}
              disabled={!boardId || included.length === 0}
              onClick={handleSave}
              className="gap-1.5"
            >
              <Check className="w-4 h-4" /> Add {included.length} Shift{included.length === 1 ? '' : 's'} to Calendar
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-success" />
          </div>
          <p className="text-sm text-text">
            Added {savedCount} shift{savedCount === 1 ? '' : 's'} to your calendar{replacedCount > 0 ? ` (replaced ${replacedCount} existing shift${replacedCount === 1 ? '' : 's'})` : ''}.
          </p>
          {remaining !== null && remaining >= 0 && (
            <p className="text-xs text-text/50">{remaining} of 4 free imports left this month.</p>
          )}
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  )
}
