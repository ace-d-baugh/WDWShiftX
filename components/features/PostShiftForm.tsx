'use client'

import { useState, useEffect, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { createClient } from '@/lib/supabase/client'
import { shiftSchema } from '@/lib/validations/shifts'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Plus, Save, X, ArrowLeft, ChevronDown, Calendar, Trash2, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { notifyShiftPosted } from '@/app/actions/notifications'
import { deactivateShift, dissolveBundle } from '@/app/actions/posts'
import { getSettings } from '@/lib/settings'
import { bundleBreakupWarning } from '@/lib/bundles'

import { fetchMyBoards, type MyBoard as Board } from '@/lib/boards'

type ShiftForm = {
  board_id: string
  shift_title: string
  start_time: string
  end_time: string
  is_trade: boolean
  is_giveaway: boolean
  is_overtime_approved: boolean
  details: string
}

const blank = (board_id = ''): ShiftForm => ({
  board_id, shift_title: '', start_time: '', end_time: '',
  is_trade: false, is_giveaway: false, is_overtime_approved: false, details: '',
})

/** A brand-new shift created inline as part of a bundle (title + times only —
 *  board, wall flags and details are inherited from the parent shift). */
type BundleExtra = { shift_title: string; start_time: string; end_time: string }

/** Bundle state for one top-level shift form. */
type BundleState = {
  enabled: boolean
  /** Existing future shifts picked from "Select from your schedule". */
  selectedIds: string[]
  extras: BundleExtra[]
  /** "Add to an existing bundle": everything here joins that bundle instead
   *  of a new one being created. Single-select — at most one bundle. */
  joinBundleId: string | null
}

const blankBundle = (): BundleState => ({ enabled: false, selectedIds: [], extras: [], joinBundleId: null })

/** A future shift of the current user, offered in the schedule picker. */
interface ScheduleShift {
  id: string
  shift_title: string
  start_time: string
  end_time: string
  board_id: string | null
  bundle_id: string | null
}

export interface ShiftInitialData {
  board_id: string | null
  shift_title: string
  start_time: string
  end_time: string
  is_trade: boolean
  is_giveaway: boolean
  is_overtime_approved: boolean
  details: string | null
  /** Present when the shift being edited already belongs to a bundle. */
  bundle_id?: string | null
}

interface PostShiftFormProps {
  userId: string
  displayName: string
  onSuccess?: () => void
  shiftId?: string
  initialData?: ShiftInitialData
  wallExpanded?: boolean   // true = wall open by default, false (calendar) = collapsed
  returnTo?: string        // where to navigate after a successful submit (defaults to /wall)
  /** yyyy-MM-dd to prefill on a blank form — set when the user starts from a
   *  specific day on the calendar. Times default to a 9–5 they can adjust. */
  initialDate?: string
}

function toLocal(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function toDate(dt: string): Date | null {
  return dt ? new Date(dt) : null
}

function isActualToday(date: Date): boolean {
  const t = new Date()
  return date.getFullYear() === t.getFullYear() &&
    date.getMonth()    === t.getMonth()    &&
    date.getDate()     === t.getDate()
}

function fromDate(d: Date | null): string {
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Next calendar day at the same wall-clock time (setDate handles DST/month
 *  rollover, unlike adding 24h of milliseconds). */
function nextDay(dt: string): string {
  if (!dt) return ''
  const d = new Date(dt)
  d.setDate(d.getDate() + 1)
  return fromDate(d)
}

function buildDateFormat(dateFormat: 'mdy' | 'dmy', timeFormat: '12h' | '24h'): string {
  return `${dateFormat === 'dmy' ? 'dd/MM/yyyy' : 'MM/dd/yyyy'} ${timeFormat === '24h' ? 'HH:mm' : 'h:mm aa'}`
}

interface DateInputProps {
  value?: string
  onClick?: () => void
  placeholder?: string
  hasError?: boolean
  onClear?: () => void
}
const DateTimeInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onClick, placeholder, hasError, onClear }, ref) => (
    <div className="relative">
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 dark:text-primary pointer-events-none z-10" />
      <input ref={ref} readOnly value={value ?? ''} onClick={onClick}
        placeholder={placeholder ?? 'Select date & time'}
        className={`input pl-9 ${value ? 'pr-8' : ''} cursor-pointer ${hasError ? 'border-warning' : ''}`} />
      {value && onClear && (
        <button type="button" onClick={e => { e.stopPropagation(); onClear() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text/40 hover:text-text min-h-0 min-w-0 z-10"
          aria-label="Clear date">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
)
DateTimeInput.displayName = 'DateTimeInput'

function isTouched(f: ShiftForm) {
  return !!f.shift_title || !!f.start_time || !!f.end_time ||
    f.is_trade || f.is_giveaway || f.is_overtime_approved || !!f.details
}

export function PostShiftForm({ userId, displayName, onSuccess, shiftId, initialData, wallExpanded = true, returnTo = '/wall', initialDate }: PostShiftFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!shiftId

  const [boards, setBoards] = useState<Board[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showUnpostConfirm, setShowUnpostConfirm] = useState(false)

  const firstForm: ShiftForm = initialData ? {
    board_id:             initialData.board_id ?? '',
    shift_title:          initialData.shift_title,
    start_time:           toLocal(initialData.start_time),
    end_time:             toLocal(initialData.end_time),
    is_trade:             initialData.is_trade,
    is_giveaway:          initialData.is_giveaway,
    is_overtime_approved: initialData.is_overtime_approved,
    details:              initialData.details ?? '',
  } : initialDate
    ? { ...blank(), start_time: `${initialDate}T09:00`, end_time: `${initialDate}T17:00` }
    : blank()

  const [forms, setForms] = useState<ShiftForm[]>([firstForm])
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>[]>([{}])
  const [wallOpen, setWallOpen] = useState<boolean[]>([isEdit ? true : wallExpanded])
  const [bundles, setBundles] = useState<BundleState[]>([blankBundle()])
  const [scheduleShifts, setScheduleShifts] = useState<ScheduleShift[]>([])
  const existingBundleId = initialData?.bundle_id ?? null

  useEffect(() => {
    const load = async () => {
      // Pending memberships included (Task 22 v3): calendar-only adds work
      // while a join request awaits approval; wall posting stays gated below.
      const [list, { data: mine }] = await Promise.all([
        fetchMyBoards(supabase, userId),
        // Bundle picker source: the poster's own upcoming shifts.
        supabase
          .from('shifts')
          .select('id, shift_title, start_time, end_time, board_id, bundle_id')
          .eq('user_id', userId)
          .eq('is_active', true)
          .gt('start_time', new Date().toISOString())
          .order('start_time'),
      ])
      setBoards(list)
      const schedule = (mine ?? []) as ScheduleShift[]
      setScheduleShifts(schedule)
      if (!isEdit && list.length === 1) {
        setForms(prev => prev.map(f => f.board_id ? f : { ...f, board_id: list[0].id }))
      }
      // Editing a shift that's already bundled: switch bundling on and tick
      // its current partners, so unchecking one drops it from the bundle.
      if (existingBundleId) {
        setBundles([{
          enabled: true,
          selectedIds: schedule
            .filter(s => s.bundle_id === existingBundleId && s.id !== shiftId)
            .map(s => s.id),
          extras: [],
          joinBundleId: null,
        }])
      }
      setDataLoading(false)
    }
    load()
  }, [userId, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (i: number, name: string, value: unknown) => {
    setForms(prev => prev.map((f, idx) => idx === i ? { ...f, [name]: value } : f))
    setFormErrors(prev => prev.map((e, idx) => idx === i ? { ...e, [name]: undefined } : e))
  }

  const onChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setField(i, name, type === 'checkbox' ? (e.target as HTMLInputElement).checked : value)
  }

  const addForm = () => {
    setForms(prev => [...prev, blank(prev[prev.length - 1].board_id)])
    setFormErrors(prev => [...prev, {}])
    setWallOpen(prev => [...prev, prev[prev.length - 1]])  // inherit last form's state
    setBundles(prev => [...prev, blankBundle()])
  }

  const removeForm = (i: number) => {
    setForms(prev => prev.filter((_, idx) => idx !== i))
    setFormErrors(prev => prev.filter((_, idx) => idx !== i))
    setWallOpen(prev => prev.filter((_, idx) => idx !== i))
    setBundles(prev => prev.filter((_, idx) => idx !== i))
  }

  const toggleWall = (i: number) =>
    setWallOpen(prev => prev.map((v, idx) => idx === i ? !v : v))

  // ── Bundle helpers ─────────────────────────────────────────────────────────

  const setBundle = (i: number, patch: Partial<BundleState>) =>
    setBundles(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b))

  const bundleAt = (i: number): BundleState => bundles[i] ?? blankBundle()

  const toggleBundleShift = (i: number, shiftId: string) => {
    const b = bundleAt(i)
    setBundle(i, {
      selectedIds: b.selectedIds.includes(shiftId)
        ? b.selectedIds.filter(id => id !== shiftId)
        : [...b.selectedIds, shiftId],
    })
  }

  /**
   * New bundled shifts copy the previous shift's title and times, moved to the
   * next day — bundles are overwhelmingly consecutive-day blocks, so each
   * "+ Add" walks the calendar forward instead of stacking duplicates on one
   * date. Seeds off the parent for the first extra, then off the last extra.
   */
  const addBundleExtra = (i: number) => {
    const f = forms[i]
    const b = bundleAt(i)
    const prev = b.extras[b.extras.length - 1] ?? {
      shift_title: f.shift_title, start_time: f.start_time, end_time: f.end_time,
    }
    setBundle(i, {
      extras: [...b.extras, {
        shift_title: prev.shift_title,
        start_time: nextDay(prev.start_time),
        end_time: nextDay(prev.end_time),
      }],
    })
  }

  const setExtraField = (i: number, ei: number, name: keyof BundleExtra, value: string) => {
    const b = bundleAt(i)
    setBundle(i, { extras: b.extras.map((x, idx) => idx === ei ? { ...x, [name]: value } : x) })
  }

  const removeExtra = (i: number, ei: number) => {
    const b = bundleAt(i)
    setBundle(i, { extras: b.extras.filter((_, idx) => idx !== ei) })
  }

  /** Own upcoming shifts eligible to join this form's bundle: same board, not
   *  the shift being edited, and either unbundled or already in *this*
   *  bundle (so current members show up ticked and can be unticked). */
  const bundleCandidates = (i: number): ScheduleShift[] => {
    const f = forms[i]
    if (!f.board_id) return []
    return scheduleShifts.filter(s =>
      s.board_id === f.board_id && s.id !== shiftId &&
      (!s.bundle_id || s.bundle_id === existingBundleId)
    )
  }

  const bundleCount = (i: number): number => {
    const b = bundleAt(i)
    return b.enabled ? b.selectedIds.length + b.extras.filter(x => x.shift_title.trim() && x.start_time && x.end_time).length : 0
  }

  /** Other bundles this form's shift could join: bundles among the user's
   *  upcoming shifts on the same board. Hidden while editing an
   *  already-bundled shift — that bundle is managed via the picker above,
   *  and merging two bundles isn't a thing. */
  const joinableBundles = (i: number): { id: string; members: ScheduleShift[] }[] => {
    const f = forms[i]
    if (!f.board_id || existingBundleId) return []
    const byId = new Map<string, ScheduleShift[]>()
    for (const s of scheduleShifts) {
      if (!s.bundle_id || s.board_id !== f.board_id) continue
      byId.set(s.bundle_id, [...(byId.get(s.bundle_id) ?? []), s])
    }
    return [...byId.entries()].map(([id, members]) => ({ id, members }))
  }

  // Date-able strings compare fine across formats: local "YYYY-MM-DDTHH:mm"
  // and ISO-with-offset both land on epoch ms.
  const timesOverlap = (aS: string, aE: string, bS: string, bE: string) =>
    new Date(aS) < new Date(bE) && new Date(bS) < new Date(aE)

  /**
   * First scheduling conflict introduced through this form's bundle section,
   * or null. Anything ADDED via bundling — an inline bundled shift, or the
   * parent shift when it joins an existing bundle — must not overlap any of
   * the user's other shifts.
   */
  const bundleOverlapError = (i: number): string | null => {
    const b = bundleAt(i)
    if (!b.enabled) return null
    const f = forms[i]
    const existing = scheduleShifts.filter(s => s.id !== shiftId)
    const label = (s: ScheduleShift) => `${s.shift_title} (${fmtScheduleRow(s)})`

    const extras = b.extras.filter(x => x.shift_title.trim() && x.start_time && x.end_time)
    for (const [ei, x] of extras.entries()) {
      for (const s of existing) {
        if (timesOverlap(x.start_time, x.end_time, s.start_time, s.end_time))
          return `Bundled Shift ${ei + 1} overlaps ${label(s)}.`
      }
      if (f.start_time && f.end_time && timesOverlap(x.start_time, x.end_time, f.start_time, f.end_time))
        return `Bundled Shift ${ei + 1} overlaps the shift above.`
      for (let pj = 0; pj < ei; pj++) {
        if (timesOverlap(x.start_time, x.end_time, extras[pj].start_time, extras[pj].end_time))
          return `Bundled Shifts ${pj + 1} and ${ei + 1} overlap each other.`
      }
    }

    if (b.joinBundleId && f.start_time && f.end_time) {
      for (const s of existing.filter(s => s.bundle_id === b.joinBundleId)) {
        if (timesOverlap(f.start_time, f.end_time, s.start_time, s.end_time))
          return `This shift overlaps ${label(s)} in the selected bundle.`
      }
    }
    return null
  }

  const settings = getSettings()
  const dateFormat = buildDateFormat(settings.dateFormat, settings.timeFormat)
  const timeFormat = settings.timeFormat === '24h' ? 'HH:mm' : 'h:mm aa'
  const minDate = new Date(new Date().setHours(0, 0, 0, 0))

  /** "Mar 4 · 8:00 AM → 6:00 PM" for a row in the schedule picker. */
  const fmtScheduleRow = (s: ScheduleShift) => {
    const hour12 = settings.timeFormat !== '24h'
    const t: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12 }
    const start = new Date(s.start_time)
    const end = new Date(s.end_time)
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ` +
      `${start.toLocaleTimeString(undefined, t)} → ${end.toLocaleTimeString(undefined, t)}`
  }

  /**
   * Create the bundle row and attach every member to it. Existing shifts
   * picked from the schedule inherit the parent's wall flags — otherwise a
   * calendar-only pick would leave a hole in the bundle on the Wall.
   * No-ops when bundling is off or nothing was actually selected.
   */
  const applyBundle = async (
    parentShiftId: string,
    f: ShiftForm,
    b: BundleState,
    isTrade: boolean,
    isGiveaway: boolean,
  ) => {
    const extras = b.extras.filter(x => x.shift_title.trim() && x.start_time && x.end_time)

    // Editing a shift that's already bundled: amend that bundle in place
    // rather than spawning a second one alongside it.
    if (existingBundleId) {
      if (!b.enabled || b.selectedIds.length + extras.length === 0) {
        await dissolveBundle(existingBundleId)
        return
      }

      const previous = scheduleShifts
        .filter(s => s.bundle_id === existingBundleId && s.id !== parentShiftId)
        .map(s => s.id)

      // Unticked members leave the bundle but stay on the Wall on their own.
      const dropped = previous.filter(id => !b.selectedIds.includes(id))
      if (dropped.length) {
        const { error } = await supabase.from('shifts')
          .update({ bundle_id: null }).in('id', dropped).eq('user_id', userId)
        if (error) throw error
      }

      const added = b.selectedIds.filter(id => !previous.includes(id))
      if (added.length) {
        const { error } = await supabase.from('shifts')
          .update({ bundle_id: existingBundleId, is_trade: isTrade, is_giveaway: isGiveaway })
          .in('id', added).eq('user_id', userId)
        if (error) throw error
      }

      if (extras.length) {
        const { error } = await supabase.from('shifts').insert(extras.map(x => ({
          created_by: displayName, user_id: userId, board_id: f.board_id,
          shift_title: x.shift_title,
          start_time: new Date(x.start_time).toISOString(),
          end_time: new Date(x.end_time).toISOString(),
          is_trade: isTrade, is_giveaway: isGiveaway,
          is_overtime_approved: f.is_overtime_approved,
          details: f.details || null, is_active: true, bundle_id: existingBundleId,
        })))
        if (error) throw error
      }
      return
    }

    // Joining an existing bundle needs no companions — the parent shift
    // alone can join. Creating a fresh bundle still needs at least one.
    if (!b.enabled || (!b.joinBundleId && b.selectedIds.length + extras.length === 0)) return

    let bundle_id: string
    if (b.joinBundleId) {
      bundle_id = b.joinBundleId
    } else {
      const { data: bundleRow, error: bundleErr } = await supabase
        .from('shift_bundles')
        .insert({ user_id: userId, board_id: f.board_id })
        .select('id')
        .single()
      if (bundleErr) throw bundleErr
      bundle_id = bundleRow.id
    }

    const { error: parentErr } = await supabase
      .from('shifts').update({ bundle_id })
      .eq('id', parentShiftId).eq('user_id', userId)
    if (parentErr) throw parentErr

    if (b.selectedIds.length) {
      const { error } = await supabase
        .from('shifts')
        .update({ bundle_id, is_trade: isTrade, is_giveaway: isGiveaway })
        .in('id', b.selectedIds).eq('user_id', userId)
      if (error) throw error
    }

    if (extras.length) {
      const { error } = await supabase.from('shifts').insert(extras.map(x => ({
        created_by: displayName, user_id: userId, board_id: f.board_id,
        shift_title: x.shift_title,
        start_time: new Date(x.start_time).toISOString(),
        end_time: new Date(x.end_time).toISOString(),
        is_trade: isTrade, is_giveaway: isGiveaway,
        is_overtime_approved: f.is_overtime_approved,
        details: f.details || null, is_active: true, bundle_id,
      })))
      if (error) throw error
    }
  }

  /**
   * True when saving would quietly pull a bundled shift off the Wall: it was
   * posted as a Trade/Giveaway, both boxes are now clear, and it belongs to a
   * bundle. That breaks up the bundle, so it gets a confirmation first.
   */
  const unpostBreaksBundle =
    isEdit && !!existingBundleId &&
    !!initialData && (initialData.is_trade || initialData.is_giveaway) &&
    !forms[0].is_trade && !forms[0].is_giveaway

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    // Validate each form (skip completely blank subsequent ones)
    const newErrors: Record<string, string | undefined>[] = forms.map(() => ({}))
    let hasErrors = false

    forms.forEach((f, i) => {
      if (i > 0 && !isTouched(f)) return
      const startUTC = f.start_time ? new Date(f.start_time).toISOString() : ''
      const endUTC   = f.end_time   ? new Date(f.end_time).toISOString()   : ''
      const result = shiftSchema.safeParse({ ...f, start_time: startUTC, end_time: endUTC })
      if (!result.success) {
        result.error.errors.forEach(err => {
          const field = err.path[0] as string
          if (!newErrors[i][field]) newErrors[i][field] = err.message
        })
        hasErrors = true
      }
    })

    if (hasErrors) { setFormErrors(newErrors); return }

    if (unpostBreaksBundle) { setShowUnpostConfirm(true); return }
    await save()
  }

  const save = async () => {
    setShowUnpostConfirm(false)
    setLoading(true)
    try {
      // Wall flags are calendar-only while board membership is pending —
      // the DB trigger enforces this too; forcing them off here keeps the
      // insert from erroring and the UX honest.
      const wallAllowed = (boardId: string) => !boards.find(b => b.id === boardId)?.pending

      if (isEdit) {
        const f = forms[0]
        const allowWall = wallAllowed(f.board_id)
        const isTrade    = allowWall && f.is_trade
        const isGiveaway = allowWall && f.is_giveaway
        const startUTC = f.start_time ? new Date(f.start_time).toISOString() : ''
        const endUTC   = f.end_time   ? new Date(f.end_time).toISOString()   : ''
        const { error } = await supabase.from('shifts').update({
          board_id: f.board_id, shift_title: f.shift_title,
          start_time: startUTC, end_time: endUTC,
          is_trade: isTrade, is_giveaway: isGiveaway,
          is_overtime_approved: f.is_overtime_approved, details: f.details || null,
        }).eq('id', shiftId!).eq('user_id', userId)
        if (error) throw error
        // Off the Wall entirely — the bundle can't stand with a member that
        // nobody can claim, so it breaks up (same rule as Delete).
        if (existingBundleId && !isTrade && !isGiveaway) {
          await dissolveBundle(existingBundleId)
        } else {
          await applyBundle(shiftId!, f, bundleAt(0), isTrade, isGiveaway)
        }
      } else {
        for (const [i, f] of forms.entries()) {
          if (i > 0 && !isTouched(f)) continue
          const allowWall = wallAllowed(f.board_id)
          const isTrade    = allowWall && f.is_trade
          const isGiveaway = allowWall && f.is_giveaway
          const startUTC = f.start_time ? new Date(f.start_time).toISOString() : ''
          const endUTC   = f.end_time   ? new Date(f.end_time).toISOString()   : ''
          const { data: inserted, error } = await supabase.from('shifts').insert({
            created_by: displayName, user_id: userId, board_id: f.board_id,
            shift_title: f.shift_title, start_time: startUTC, end_time: endUTC,
            is_trade: isTrade, is_giveaway: isGiveaway,
            is_overtime_approved: f.is_overtime_approved, details: f.details || null, is_active: true,
          }).select('id').single()
          if (error) throw error
          await applyBundle(inserted.id, f, bundleAt(i), isTrade, isGiveaway)
          // Match alerts only make sense for posts others can actually see
          if (isTrade || isGiveaway) {
            notifyShiftPosted({ boardId: f.board_id, startTimeIso: startUTC, shiftTitle: f.shift_title, posterName: displayName, posterUserId: userId }).catch(() => {})
          }
        }
      }
      onSuccess?.()
      router.push(returnTo)
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : isEdit ? 'Failed to update shift.' : 'Failed to post shift.')
    } finally {
      setLoading(false)
    }
  }

  // Every active shift sharing this shift's bundle. The edited shift is in
  // scheduleShifts only when it's still upcoming, so count it back in.
  const bundleSize = (() => {
    if (!existingBundleId) return 0
    const members = scheduleShifts.filter(s => s.bundle_id === existingBundleId)
    return members.some(s => s.id === shiftId) ? members.length : members.length + 1
  })()

  const handleDelete = async () => {
    if (!shiftId) return
    setDeleteLoading(true)
    // Same rule as the Wall's Delete: losing a member invalidates the
    // all-or-nothing offer, so the bundle breaks up first.
    if (existingBundleId) await dissolveBundle(existingBundleId)
    const result = await deactivateShift(shiftId)
    setDeleteLoading(false)
    if (result.error) {
      setServerError(result.error)
      setShowDeleteConfirm(false)
      return
    }
    router.push(returnTo)
  }

  if (dataLoading) return <div className="card shadow-sm flex items-center justify-center py-12 text-text/50">Loading...</div>

  if (boards.length === 0) return (
    <div className="card shadow-sm py-8 text-center text-sm text-text/60">
      You haven&apos;t joined any boards yet.{' '}
      <a href="/profile#my-boards" className="text-primary underline">Join or create a board</a> first.
    </div>
  )

  const submitCount = forms.filter((f, i) => i === 0 || isTouched(f)).length

  const isFormComplete = (f: ShiftForm) =>
    (boards.length <= 1 || !!f.board_id) &&
    !!f.shift_title.trim() &&
    !!f.start_time &&
    !!f.end_time

  const hasTimeConflict = forms.some(f =>
    f.start_time && f.end_time && new Date(f.end_time) <= new Date(f.start_time)
  ) || bundles.some(b => b.enabled && b.extras.some(x =>
    x.start_time && x.end_time && new Date(x.end_time) <= new Date(x.start_time)
  ))

  // An inline bundled shift must be fully filled in or left entirely blank —
  // a half-filled one is silently dropped by applyBundle, which would be a
  // surprise. Blank ones are the "added it, changed my mind" case.
  const bundleExtrasValid = bundles.every(b => !b.enabled || b.extras.every(x => {
    const filled = [x.shift_title.trim(), x.start_time, x.end_time].filter(Boolean).length
    return filled === 0 || filled === 3
  }))

  const canSubmit = !hasTimeConflict && bundleExtrasValid &&
    forms.every((_, i) => !bundleOverlapError(i)) &&
    forms.every((f, i) => i === 0 ? isFormComplete(f) : !isTouched(f) || isFormComplete(f))

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">{serverError}</div>
      )}

      {forms.map((f, i) => {
        const errs = formErrors[i] ?? {}
        const partial = i > 0 && isTouched(f) && Object.keys(errs).some(k => errs[k])
        const isPastShift = isEdit && !!f.start_time && new Date(f.start_time).getTime() < Date.now()
        // Pending board: shifts save to the calendar only — wall posting locked
        const boardPending = !!boards.find(b => b.id === f.board_id)?.pending

        return (
          <div key={i} className="card shadow-sm">
            {/* Card header — only when there's more than one form or in edit mode */}
            {(forms.length > 1 || isEdit) && (
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <span className="text-sm font-semibold text-text">
                  {isEdit ? 'Shift Details' : `Shift ${i + 1}`}
                </span>
                {isEdit && (
                  <button type="button" onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 text-xs text-warning hover:text-warning/80 min-h-0 min-w-0 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Shift
                  </button>
                )}
                {i > 0 && (
                  <button type="button" onClick={() => removeForm(i)}
                    className="flex items-center gap-1 text-xs text-warning hover:text-warning/80 min-h-0 min-w-0 transition-colors">
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            )}

            {partial && (
              <div className="mb-3 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs">
                Please complete all required fields or remove this shift.
              </div>
            )}

            <div className="space-y-4">
              {/* Board — hidden when user belongs to only one board (auto-selected) */}
              {boards.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-text mb-1">Board <span className="text-warning">*</span></label>
                  <select name="board_id" value={f.board_id} onChange={onChange(i)}
                    className={`input ${errs.board_id ? 'border-warning' : ''}`}>
                    <option value="">Select board...</option>
                    {boards.map(b => <option key={b.id} value={b.id}>{b.name}{b.pending ? ' (pending approval)' : ''}</option>)}
                  </select>
                  {errs.board_id && <p className="mt-1 text-xs text-warning">{errs.board_id}</p>}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">Shift Title <span className="text-warning">*</span></label>
                <input name="shift_title" type="text" value={f.shift_title} onChange={onChange(i)}
                  className={`input placeholder:text-text/30 ${errs.shift_title ? 'border-warning' : ''}`}
                  placeholder="e.g., Morning Opening" maxLength={35} />
                <p className="mt-1 text-xs text-text/40">Use the exact title as it appears on your schedule.</p>
                {errs.shift_title && <p className="mt-1 text-xs text-warning">{errs.shift_title}</p>}
              </div>

              {/* Times */}
              {(() => {
                const endBeforeStart = !!(f.start_time && f.end_time &&
                  new Date(f.end_time) <= new Date(f.start_time))
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text mb-1">Start Time <span className="text-warning">*</span></label>
                      <DatePicker
                        selected={toDate(f.start_time)}
                        onChange={(d: Date | null) => setField(i, 'start_time', fromDate(d))}
                        showTimeSelect
                        timeIntervals={5}
                        timeFormat={timeFormat}
                        dateFormat={dateFormat}
                        calendarStartDay={settings.weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6}
                        minDate={minDate}
                        dayClassName={d => isActualToday(d) ? 'rdp-today' : ''}
                        placeholderText="Select date & time"
                        customInput={<DateTimeInput hasError={!!errs.start_time} onClear={() => setField(i, 'start_time', '')} />}
                        popperPlacement="bottom-start"
                        wrapperClassName="w-full"
                      />
                      {errs.start_time && <p className="mt-1 text-xs text-warning">{errs.start_time}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text mb-1">End Time <span className="text-warning">*</span></label>
                      <DatePicker
                        selected={toDate(f.end_time)}
                        onChange={(d: Date | null) => setField(i, 'end_time', fromDate(d))}
                        showTimeSelect
                        timeIntervals={5}
                        timeFormat={timeFormat}
                        dateFormat={dateFormat}
                        calendarStartDay={settings.weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6}
                        minDate={toDate(f.start_time) ?? minDate}
                        dayClassName={d => isActualToday(d) ? 'rdp-today' : ''}
                        placeholderText="Select date & time"
                        customInput={<DateTimeInput hasError={!!errs.end_time || endBeforeStart} onClear={() => setField(i, 'end_time', '')} />}
                        popperPlacement="bottom-start"
                        wrapperClassName="w-full"
                      />
                      {endBeforeStart
                        ? <p className="mt-1 text-xs text-warning">End time must be after start time.</p>
                        : errs.end_time && <p className="mt-1 text-xs text-warning">{errs.end_time}</p>}
                    </div>
                  </div>
                )
              })()}

              {/* Post to Wall + Details — accordion (hidden once the shift is in the past,
                  locked while board membership is pending approval) */}
              {isPastShift ? (
                <div className="rounded-lg border border-border px-3 py-2.5 text-xs text-text/40 bg-primary-light/10">
                  This shift has already passed — Posting to the wall is no longer available.
                </div>
              ) : boardPending ? (
                <div className="rounded-lg border border-info/20 px-3 py-2.5 text-xs text-text/60 bg-info/5">
                  This board hasn&apos;t approved you yet — this shift will be added to your calendar
                  only. Posting to the wall unlocks once a board admin approves you.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleWall(i)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-primary-light/20 hover:bg-primary-light/40 transition-colors min-h-0 text-left"
                  >
                    <span className="text-sm font-medium text-text">
                      Post to Wall
                      {(f.is_trade || f.is_giveaway) && (
                        <span className="ml-2 text-xs text-primary font-normal">
                          ({[f.is_giveaway && 'Giveaway', f.is_trade && 'Trade'].filter(Boolean).join(' + ')})
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn('w-4 h-4 text-text/40 transition-transform duration-200 shrink-0', (wallOpen[i] ?? wallExpanded) && 'rotate-180')} />
                  </button>

                  {(wallOpen[i] ?? wallExpanded) && (
                    <div className="px-3 pt-3 pb-3 space-y-4 border-t border-border">
                      <div>
                        <p className="text-xs text-text/50 mb-2">Leave unchecked to add to your calendar only.</p>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer min-h-0">
                            <Checkbox name="is_giveaway" checked={f.is_giveaway} onChange={onChange(i)} />
                            <span className="text-sm text-text">Giveaway</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer min-h-0">
                            <Checkbox name="is_trade" checked={f.is_trade} onChange={onChange(i)} />
                            <span className="text-sm text-text">Trade</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer min-h-0">
                            <Checkbox name="is_overtime_approved" checked={f.is_overtime_approved} onChange={onChange(i)} />
                            <span className="text-sm text-text">OT Approved</span>
                          </label>
                        </div>
                        {errs.is_trade && <p className="mt-1 text-xs text-warning">{errs.is_trade}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-text/70 mb-1">Details (optional)</label>
                        <textarea name="details" value={f.details} onChange={onChange(i)}
                          className="input h-20 resize-none text-sm" placeholder="Any additional details..." maxLength={500} />
                      </div>

                      {/* Bundle — shifts that must move together as one trade */}
                      {(() => {
                        const b = bundleAt(i)
                        const candidates = bundleCandidates(i)
                        const total = bundleCount(i)
                        return (
                          <div className="pt-3 border-t border-border">
                            <label className="flex items-center gap-2 cursor-pointer min-h-0">
                              <Checkbox
                                checked={b.enabled}
                                onChange={e => setBundle(i, { enabled: e.target.checked })}
                              />
                              <span className="text-sm text-text flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-primary" />
                                Bundle with other shifts?
                              </span>
                            </label>
                            <p className="mt-1 ml-6 text-xs text-text/40">
                              Bundled shifts are taken together — one person covers all of them.
                            </p>
                            {existingBundleId && (
                              <p className="mt-2 text-xs text-primary bg-primary-light/40 border border-primary/20 rounded-md px-3 py-2 leading-relaxed">
                                This shift is already bundled. Untick anyone below to drop them from
                                the bundle — they stay on the Wall as their own single shift. Unchecking
                                &ldquo;Bundle with other shifts?&rdquo; breaks up the whole bundle.
                              </p>
                            )}

                            {b.enabled && (
                              <div className="mt-3 space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-text/70 mb-1.5">
                                    Select from your schedule
                                  </label>
                                  {!f.board_id ? (
                                    <p className="text-xs text-text/40 rounded-md border border-border px-3 py-2">
                                      Pick a board first to see your upcoming shifts.
                                    </p>
                                  ) : candidates.length === 0 ? (
                                    <p className="text-xs text-text/40 rounded-md border border-border px-3 py-2">
                                      No other unbundled upcoming shifts on this board — use
                                      &ldquo;Add Another Bundled Shift&rdquo; below.
                                    </p>
                                  ) : (
                                    <div className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
                                      {candidates.map(s => (
                                        <label key={s.id}
                                          className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-primary-light/30 min-h-0">
                                          <Checkbox
                                            checked={b.selectedIds.includes(s.id)}
                                            onChange={() => toggleBundleShift(i, s.id)}
                                          />
                                          <span className="min-w-0">
                                            <span className="block text-sm text-text truncate">{s.shift_title}</span>
                                            <span className="block text-[11px] text-text/50">{fmtScheduleRow(s)}</span>
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {b.extras.map((x, ei) => {
                                  const extraEndBeforeStart = !!(x.start_time && x.end_time &&
                                    new Date(x.end_time) <= new Date(x.start_time))
                                  return (
                                    <div key={ei} className="rounded-lg border border-primary/30 bg-primary-light/20 p-3 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-primary">Bundled Shift {ei + 1}</span>
                                        <button type="button" onClick={() => removeExtra(i, ei)}
                                          className="flex items-center gap-1 text-xs text-warning hover:text-warning/80 min-h-0 min-w-0 transition-colors">
                                          <X className="w-3.5 h-3.5" /> Remove
                                        </button>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-text/70 mb-1">Shift Title</label>
                                        <input type="text" value={x.shift_title}
                                          onChange={e => setExtraField(i, ei, 'shift_title', e.target.value)}
                                          className="input text-sm placeholder:text-text/30"
                                          placeholder="e.g., Morning Opening" maxLength={35} />
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-xs font-medium text-text/70 mb-1">Start Time</label>
                                          <DatePicker
                                            selected={toDate(x.start_time)}
                                            onChange={(d: Date | null) => setExtraField(i, ei, 'start_time', fromDate(d))}
                                            showTimeSelect timeIntervals={5}
                                            timeFormat={timeFormat} dateFormat={dateFormat}
                                            calendarStartDay={settings.weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6}
                                            minDate={minDate}
                                            dayClassName={d => isActualToday(d) ? 'rdp-today' : ''}
                                            placeholderText="Select date & time"
                                            customInput={<DateTimeInput onClear={() => setExtraField(i, ei, 'start_time', '')} />}
                                            popperPlacement="bottom-start" wrapperClassName="w-full"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-text/70 mb-1">End Time</label>
                                          <DatePicker
                                            selected={toDate(x.end_time)}
                                            onChange={(d: Date | null) => setExtraField(i, ei, 'end_time', fromDate(d))}
                                            showTimeSelect timeIntervals={5}
                                            timeFormat={timeFormat} dateFormat={dateFormat}
                                            calendarStartDay={settings.weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6}
                                            minDate={toDate(x.start_time) ?? minDate}
                                            dayClassName={d => isActualToday(d) ? 'rdp-today' : ''}
                                            placeholderText="Select date & time"
                                            customInput={<DateTimeInput hasError={extraEndBeforeStart} onClear={() => setExtraField(i, ei, 'end_time', '')} />}
                                            popperPlacement="bottom-start" wrapperClassName="w-full"
                                          />
                                          {extraEndBeforeStart && (
                                            <p className="mt-1 text-xs text-warning">End time must be after start time.</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}

                                <button type="button" onClick={() => addBundleExtra(i)}
                                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/70 transition-colors min-h-0">
                                  <Plus className="w-4 h-4" /> Add Another Bundled Shift
                                </button>

                                {/* Third path: join one of the user's existing
                                    bundles instead of creating a new one.
                                    Star-checkboxes act as a radio — checking
                                    one clears the others. */}
                                {(() => {
                                  const avail = joinableBundles(i)
                                  if (avail.length === 0) return null
                                  return (
                                    <div>
                                      <label className="block text-xs font-medium text-text/70 mb-1.5">
                                        Add to an existing bundle
                                      </label>
                                      <div className="rounded-md border border-border divide-y divide-border">
                                        {avail.map((bd, bi) => (
                                          <label key={bd.id}
                                            className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-primary-light/30 min-h-0">
                                            <Checkbox
                                              checked={b.joinBundleId === bd.id}
                                              onChange={() => setBundle(i, {
                                                joinBundleId: b.joinBundleId === bd.id ? null : bd.id,
                                              })}
                                            />
                                            <span className="min-w-0 flex-1">
                                              <span className="flex items-center gap-1 text-xs font-semibold text-primary mb-0.5">
                                                <Layers className="w-3 h-3" />
                                                Bundle {bi + 1} · {bd.members.length} shift{bd.members.length === 1 ? '' : 's'}
                                              </span>
                                              {bd.members.map(s => (
                                                <span key={s.id} className="block text-[11px] text-text/60">
                                                  {s.shift_title} — {fmtScheduleRow(s)}
                                                </span>
                                              ))}
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                      <p className="mt-1 text-[11px] text-text/40">
                                        Pick one — this shift (and anything selected above) joins that bundle.
                                      </p>
                                    </div>
                                  )
                                })()}

                                {(() => {
                                  const overlapErr = bundleOverlapError(i)
                                  if (overlapErr) return (
                                    <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
                                      {overlapErr} Bundled shifts can&apos;t overlap another shift on your schedule.
                                    </p>
                                  )
                                  const joined = b.joinBundleId
                                    ? joinableBundles(i).find(bd => bd.id === b.joinBundleId)?.members.length ?? 0
                                    : 0
                                  const grand = total + joined + 1
                                  return grand > 1 ? (
                                    <p className="text-xs text-primary font-medium">
                                      This bundle will hold {grand} shifts, taken together.
                                    </p>
                                  ) : null
                                })()}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Add another (create mode only) */}
      {!isEdit && (
        <button type="button" onClick={addForm}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/70 transition-colors min-h-0">
          <Plus className="w-4 h-4" /> Add Another Shift
        </button>
      )}

      {/* Cancel + Submit */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="danger-outline" onClick={() => router.back()} className="gap-1.5 shrink-0">
          <ArrowLeft className="w-4 h-4" /> Cancel
        </Button>
        <Button type="submit" loading={loading} disabled={!canSubmit} className="flex-1 gap-1.5">
          {isEdit
            ? <><Save className="w-4 h-4" /> Update Shift</>
            : submitCount > 1
              ? <><Plus className="w-4 h-4" /> Post {submitCount} Shifts</>
              : <><Plus className="w-4 h-4" /> Post Shift</>}
        </Button>
      </div>
    </form>
    {isEdit && (
      <>
        <ConfirmDialog
          open={showDeleteConfirm}
          title="Delete Shift"
          message={`Are you sure you want to delete this shift? This removes it from your calendar and the Wall. This cannot be undone.${bundleBreakupWarning(bundleSize, 'deleting it')}`}
          confirmLabel="Delete"
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
        <ConfirmDialog
          open={showUnpostConfirm}
          title="Take this shift off the Wall?"
          message={`Clearing both Giveaway and Trade removes this shift from the Wall — it stays on your calendar, and you can post it again later.${bundleBreakupWarning(bundleSize, 'removing it')}`}
          confirmLabel="Save changes"
          loading={loading}
          onConfirm={save}
          onCancel={() => setShowUnpostConfirm(false)}
        />
      </>
    )}
    </>
  )
}
