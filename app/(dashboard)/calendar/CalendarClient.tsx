'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Camera, Crown, Layers, LayoutGrid, List as ListIcon,
  MoreVertical, Pencil, Plus, RefreshCw, Trash2, Undo2,
} from 'lucide-react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO, addMonths, startOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { getSettings, fmtTime, type UserSettings } from '@/lib/settings'
import { ScheduleImportModal } from '@/components/features/ScheduleImportModal'
import { reactivateShift } from '@/app/actions/claims'
import { deactivateShift, dissolveBundle } from '@/app/actions/posts'
import { bundleBreakupWarning } from '@/lib/bundles'
import {
  isSampleId, sampleBoardRequests, sampleBoardShifts, sampleCalendarShifts, useSampleMode,
} from '@/lib/tour/sample-data'
import { getSpecialEventBadges } from '@/lib/special-events'
import { PartyLegendModal } from '@/components/features/PartyLegendModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const ET = 'America/New_York'

/**
 * Title colour for a shift, matching the Wall's cards: purple when the owner
 * will trade *or* give it away, blue for trade only, green for giveaway only.
 * A shift that isn't on the Wall has no type, so it stays the theme's ordinary
 * text colour — same as its left bar.
 */
function shiftTypeColor(s: { is_trade: boolean; is_giveaway: boolean }): string {
  if (s.is_trade && s.is_giveaway) return 'text-primary'
  if (s.is_trade) return 'text-info'
  if (s.is_giveaway) return 'text-success'
  return 'text-text'
}

// ── Prop types ──────────────────────────────────────────────────────────────

interface MyShift {
  id: string; shift_title: string; start_time: string; end_time: string
  is_trade: boolean; is_giveaway: boolean; board_id: string | null
  /** Set when the shift is part of a take-them-all-together bundle. */
  bundle_id: string | null
  /** true if this was given away/traded (claim accepted) — shown with a
   * marker instead of disappearing, with a reactivate option. */
  given_away: boolean
}
interface BoardShift {
  id: string; start_time: string; is_trade: boolean; is_giveaway: boolean; board_id: string | null
}
interface BoardRequest {
  id: string; requested_date: string; board_id: string | null
}

interface CalendarClientProps {
  userId: string
  displayName: string
  importEnabled: boolean
  today: string
  myShifts: MyShift[]
  boardShifts: BoardShift[]
  boardRequests: BoardRequest[]
  boards: { id: string; name: string }[]
  isPro: boolean
}

// ── Day data ─────────────────────────────────────────────────────────────────

interface DayData {
  myShifts: MyShift[]
  hasTradeOnly: boolean
  hasGiveawayOnly: boolean
  hasBoth: boolean
  hasRequest: boolean
}

function buildDayMap(
  myShifts: MyShift[],
  boardShifts: BoardShift[],
  boardRequests: BoardRequest[]
): Map<string, DayData> {
  const map = new Map<string, DayData>()

  const ensure = (key: string) => {
    if (!map.has(key)) {
      map.set(key, { myShifts: [], hasTradeOnly: false, hasGiveawayOnly: false, hasBoth: false, hasRequest: false })
    }
    return map.get(key)!
  }

  myShifts.forEach(s => {
    const key = formatInTimeZone(parseISO(s.start_time), ET, 'yyyy-MM-dd')
    ensure(key).myShifts.push(s)
  })

  boardShifts.forEach(s => {
    const key = formatInTimeZone(parseISO(s.start_time), ET, 'yyyy-MM-dd')
    const d = ensure(key)
    if (s.is_trade && s.is_giveaway) d.hasBoth = true
    else if (s.is_trade)    d.hasTradeOnly    = true
    else if (s.is_giveaway) d.hasGiveawayOnly = true
  })

  boardRequests.forEach(r => {
    const d = ensure(r.requested_date)
    d.hasRequest = true
  })

  return map
}

function hasAnyDots(data?: DayData): boolean {
  return !!data && (data.hasBoth || data.hasTradeOnly || data.hasGiveawayOnly || data.hasRequest)
}

// ── Activity dots — shared between Grid and List ────────────────────────────
// Big tappable circles: the three wall dots (offers) overlap like an avatar
// stack (giveaway in front, trade behind it, both at the back), the request
// dot sits alone on the other side since it opens the Requests tab instead.
//
// `spread` pushes the two groups to opposite ends of a full-width row — offers
// left, requests hard right — which is what the month grid wants inside a day
// cell. A day with only one kind still lands on its own side: the offers group
// is always rendered, so an offers-only day leaves it at flex-start and a
// requests-only day has an empty box holding the left slot. The list view
// leaves it off and keeps both groups together at the end of the row.

function ActivityDots({ data, dateStr, router, spread = false }: {
  data?: DayData
  dateStr: string
  router: ReturnType<typeof useRouter>
  spread?: boolean
}) {
  if (!hasAnyDots(data)) return null
  const d = data!
  return (
    <div
      data-tour="cal-dots"
      className={cn('flex items-center', spread ? 'w-full justify-between gap-1' : 'shrink-0')}
    >
      <div className="flex items-center">
        {d.hasBoth && (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/wall?tab=offers&date=${dateStr}`) }}
            title="Trade + Giveaway on this day"
            className="relative z-0 min-h-0 min-w-0"
          >
            <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-primary ring-1 ring-card hover:opacity-70 transition-opacity" />
          </button>
        )}
        {d.hasTradeOnly && (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/wall?tab=offers&date=${dateStr}`) }}
            title="Trade shift on this day"
            className={cn('relative z-10 min-h-0 min-w-0', d.hasBoth && '-ml-1 min-[505px]:-ml-2')}
          >
            <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-info ring-1 ring-card hover:opacity-70 transition-opacity" />
          </button>
        )}
        {d.hasGiveawayOnly && (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/wall?tab=offers&date=${dateStr}`) }}
            title="Giveaway shift on this day"
            className={cn('relative z-20 min-h-0 min-w-0', (d.hasBoth || d.hasTradeOnly) && '-ml-1 min-[505px]:-ml-2')}
          >
            <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-success ring-1 ring-card hover:opacity-70 transition-opacity" />
          </button>
        )}
      </div>
      {d.hasRequest && (
        <button
          onClick={e => { e.stopPropagation(); router.push(`/wall?tab=requests&date=${dateStr}`) }}
          title="Shift request on this day"
          /* justify-between already separates the groups when spread, so the
             nudge would only push it off the cell's right edge. */
          className={cn('relative z-30 min-h-0 min-w-0', !spread && 'ml-1')}
        >
          <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-accent hover:opacity-70 transition-opacity" />
        </button>
      )}
    </div>
  )
}

type ViewMode = 'grid' | 'list'

// ── Calendar client ───────────────────────────────────────────────────────────

export function CalendarClient({
  userId, displayName, importEnabled, today,
  myShifts: myShiftsProp,
  boardShifts: boardShiftsProp,
  boardRequests: boardRequestsProp,
  boards, isPro,
}: CalendarClientProps) {
  const router = useRouter()

  // While the tour runs, the same three demo shifts the Wall shows are folded
  // onto the calendar (plus one open request, so the Request dot has a day to
  // sit on). Memory only — they disappear when the tour ends.
  const sampleMode = useSampleMode()
  const myShifts = useMemo(
    () => (sampleMode ? [...sampleCalendarShifts(), ...myShiftsProp] : myShiftsProp),
    [sampleMode, myShiftsProp]
  )
  const boardShifts = useMemo(
    () => (sampleMode ? [...sampleBoardShifts(), ...boardShiftsProp] : boardShiftsProp),
    [sampleMode, boardShiftsProp]
  )
  const boardRequests = useMemo(
    () => (sampleMode ? [...sampleBoardRequests(), ...boardRequestsProp] : boardRequestsProp),
    [sampleMode, boardRequestsProp]
  )

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  // Party Legend — one modal shared by every MNSSHP/HHN/MVMCP badge on the page
  const [partyLegendOpen, setPartyLegendOpen] = useState(false)

  const [view, setView] = useState<ViewMode>('grid')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`calendar-view-${userId}`)
      if (saved === 'grid' || saved === 'list') setView(saved)
    } catch {}
  }, [userId])
  const changeView = (v: ViewMode) => {
    setView(v)
    try { localStorage.setItem(`calendar-view-${userId}`, v) } catch {}
  }

  // Hidden board filter for marketing screenshots: clicking the calendar
  // icon in the heading toggles a dropdown that narrows every shift, dot,
  // and request to one board. The toggle only shows/hides the dropdown —
  // the selected filter KEEPS applying while hidden (that's the point:
  // filter to one board, hide the control, capture a clean screenshot).
  // It resets only by choosing "All boards" in the dropdown.
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterBoardId, setFilterBoardId] = useState('')
  const toggleFilter = () => setFilterOpen(open => !open)

  // Reactivate a given-away shift (the claim it was covered by didn't pan out)
  const [reactivateTarget, setReactivateTarget] = useState<MyShift | null>(null)
  const [reactivating, setReactivating] = useState(false)
  const [reactivateError, setReactivateError] = useState<string | null>(null)

  const handleReactivate = async () => {
    if (!reactivateTarget) return
    setReactivating(true)
    setReactivateError(null)
    const result = await reactivateShift(reactivateTarget.id)
    setReactivating(false)
    if (result.error) { setReactivateError(result.error); return }
    setReactivateTarget(null)
    router.refresh()
  }

  // List view's per-shift ⋮ menu: Edit / Remove. Portalled to <body> with a
  // computed fixed position — a day-card uses overflow-hidden for its rounded
  // corners, which would otherwise clip a same-container dropdown (the same
  // containing-block trap the Wall's card menu and Modal already hit).
  // Remove reuses the same bundle-breakup warning and dissolve-then-delete
  // sequence built for the Wall's owner menu, so leaving a bundle mid-way is
  // explained consistently no matter where the user acts from.
  const [menuFor, setMenuFor] = useState<{ id: string; top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [removeTarget, setRemoveTarget] = useState<MyShift | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const bundleSizeOf = (s: MyShift) =>
    s.bundle_id ? myShifts.filter(x => x.bundle_id === s.bundle_id).length : 0

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveError(null)
    if (removeTarget.bundle_id) await dissolveBundle(removeTarget.bundle_id)
    const result = await deactivateShift(removeTarget.id)
    setRemoving(false)
    if (result.error) { setRemoveError(result.error); return }
    setRemoveTarget(null)
    router.refresh()
  }

  useEffect(() => { setSettings(getSettings()) }, [])

  // Close the menu on any scroll — its fixed position wouldn't track the
  // button underneath it otherwise (same guard ShiftCard's ⋮ menu uses).
  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    document.addEventListener('scroll', close, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', close, { capture: true })
  }, [menuFor])

  const todayDate = parseISO(today)
  const fMyShifts      = filterBoardId ? myShifts.filter(s => s.board_id === filterBoardId) : myShifts
  const fBoardShifts   = filterBoardId ? boardShifts.filter(s => s.board_id === filterBoardId) : boardShifts
  const fBoardRequests = filterBoardId ? boardRequests.filter(r => r.board_id === filterBoardId) : boardRequests
  const dayMap = buildDayMap(fMyShifts, fBoardShifts, fBoardRequests)

  const months = Array.from({ length: 4 }, (_, i) => addMonths(startOfMonth(todayDate), i))

  const weekStart = settings?.weekStart ?? 0
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const orderedDays = Array.from({ length: 7 }, (_, i) => DAY_LABELS[(i + weekStart) % 7])

  const todayStr = formatInTimeZone(todayDate, ET, 'yyyy-MM-dd')

  const goCreate = (dateStr: string) => router.push(`/wall/new-shift?from=calendar&date=${dateStr}`)

  // Flat, today-forward day list for the List view — built from the same
  // months/daysInMonth data as the grid, just walked linearly instead of
  // dropped into a 7-column layout, and trimmed to today onward.
  const listDays = months.flatMap(monthStart => {
    const year = monthStart.getFullYear()
    const month = monthStart.getMonth()
    const daysInMonth = getDaysInMonth(monthStart)
    const monthLabel = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const label = new Date(year, month, day, 12).toLocaleDateString('en-US', {
        weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
      })
      return { dateStr, monthLabel, label }
    })
  }).filter(d => d.dateStr >= todayStr)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* The icon doubles as the invisible toggle for the screenshot filter */}
          <button
            type="button"
            onClick={toggleFilter}
            aria-label="My Calendar"
            className="cursor-default min-h-0 min-w-0 p-0 border-0 bg-transparent"
          >
            <CalendarDays className="w-6 h-6 text-primary" />
          </button>
          <h1 className="font-accent text-2xl font-bold text-text">My Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          {importEnabled && (
            <button
              onClick={() => setImportOpen(true)}
              data-tour="cal-import"
              className="btn btn-outline gap-1.5 text-sm px-4 py-2 min-h-0 h-10"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Import Schedule</span>
              <span className="hidden min-[505px]:inline sm:hidden">Import</span>
            </button>
          )}
          {/* Calendar Sync is Pro-only: Basic gets the same button with a
              crown, routed to the upgrade page (the profile sync section
              doesn't exist for them). */}
          <Link
            href={isPro ? '/profile#calendar-sync' : '/upgrade'}
            data-tour="cal-sync"
            className="btn btn-outline gap-1.5 text-sm px-4 py-2 min-h-0 h-10 no-underline"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Sync Calendar</span>
            <span className="hidden min-[505px]:inline sm:hidden">Sync</span>
            {!isPro && <Crown className="w-3.5 h-3.5 text-secondary-accent" fill="#ffea80" strokeWidth={0} aria-label="Pro feature" />}
          </Link>
          <Link href="/wall/new-shift?from=calendar" data-tour="cal-add" className="btn btn-primary gap-1.5 text-sm px-4 py-2 min-h-0 h-10 no-underline">
            <Plus className="w-4 h-4" />
            <span className="hidden min-[505px]:inline">
              <span className="hidden sm:inline">Add </span>Shift
            </span>
          </Link>
        </div>
      </div>

      {importEnabled && (
        <ScheduleImportModal
          userId={userId}
          displayName={displayName}
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}

      {/* Hidden screenshot filter — only exists while toggled via the icon */}
      {filterOpen && (
        <div className="mb-6 flex items-center gap-3">
          <label htmlFor="board-filter" className="text-xs font-medium text-text/60 shrink-0">
            Show board
          </label>
          <select
            id="board-filter"
            className="input text-sm h-9 max-w-xs"
            value={filterBoardId}
            onChange={e => setFilterBoardId(e.target.value)}
          >
            <option value="">All boards</option>
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dot legend + view toggle */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div data-tour="cal-legend" className="flex items-center gap-5 flex-wrap text-xs text-text/60">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />Trade + Giveaway</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-info inline-block" />Trade</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />Giveaway</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />Request</span>
        </div>
        <div data-tour="cal-view" className="flex items-center gap-1 rounded-lg border border-border p-0.5 shrink-0">
          <button
            onClick={() => changeView('grid')}
            aria-label="Grid view" title="Grid view"
            className={cn('p-1.5 rounded-md transition-colors min-h-0 min-w-0', view === 'grid' ? 'bg-primary-light text-primary' : 'text-text/50 hover:text-text')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => changeView('list')}
            aria-label="List view" title="List view"
            className={cn('p-1.5 rounded-md transition-colors min-h-0 min-w-0', view === 'list' ? 'bg-primary-light text-primary' : 'text-text/50 hover:text-text')}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
      <div className="space-y-10">
        {months.map(monthStart => {
          const year  = monthStart.getFullYear()
          const month = monthStart.getMonth()
          const daysInMonth = getDaysInMonth(monthStart)
          // Offset: how many blank cells before the 1st
          const firstDow  = getDay(monthStart) // 0=Sun … 6=Sat
          const offset    = (firstDow - weekStart + 7) % 7
          const cells     = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

          const monthLabel = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' })

          return (
            <div key={`${year}-${month}`}>
              <h2 className="font-accent text-lg font-bold text-text mb-3">{monthLabel}</h2>

              {/* Day-of-week header */}
              <div className="grid grid-cols-7 gap-px mb-px">
                {orderedDays.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-text/40 py-1">{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {cells.map((day, idx) => {
                  if (!day) return <div key={`blank-${idx}`} className="bg-card min-h-[90px]" />

                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const data    = dayMap.get(dateStr)
                  const isToday = dateStr === todayStr
                  const isPast  = dateStr < todayStr
                  const eventBadges = getSpecialEventBadges(dateStr)

                  return (
                    <div
                      key={dateStr}
                      onClick={() => { if (!isPast) goCreate(dateStr) }}
                      /* Scopes the tour's calendar steps to a day it supplied,
                         so they don't land on a real shift from last week. */
                      data-tour-sample={
                        (data?.myShifts ?? []).some(s => isSampleId(s.id)) ? 'true' : undefined
                      }
                      className={cn(
                        'relative bg-card p-1.5 min-h-[90px] flex flex-col',
                        isPast && 'opacity-50',
                        !isPast && 'cursor-pointer hover:bg-primary-light/10 transition-colors'
                      )}
                    >
                      {/* Day number */}
                      <span className={cn(
                        'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full shrink-0',
                        isToday ? 'bg-primary text-white' : 'text-text/60'
                      )}>
                        {day}
                      </span>

                      {/* Special-event badges (MNSSHP/HHN/MVMCP) — top-right
                          corner. Mobile: stacked column, 10px glyphs, centered
                          in a 24px-tall box. Desktop (sm+): a right-aligned row
                          of 24px glyphs. */}
                      {eventBadges.length > 0 && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setPartyLegendOpen(true) }}
                          aria-label="Party Legend — what these badges mean"
                          title="What do these mean? Tap for the Party Legend"
                          className="absolute top-1 right-1 flex flex-col items-center justify-center h-6 gap-0 sm:flex-row sm:h-auto sm:justify-end sm:gap-0.5 min-h-0 min-w-0 p-0"
                        >
                          {eventBadges.map((b, i) => (
                            <span
                              key={i}
                              role="img"
                              aria-label={b.label}
                              className="leading-none text-[10px] sm:text-2xl"
                            >
                              {b.emoji}
                            </span>
                          ))}
                        </button>
                      )}

                      {/* User's personal shifts — given-away ones stay visible
                          (not filtered out) with a muted/struck marker and a
                          reactivate action, and sit fine alongside a new,
                          fully-active shift at the same time since each is
                          just its own row here, never a shared slot. Every
                          shift button stops propagation so tapping it opens
                          that shift, not the day's "add a shift" action. */}
                      <div className="flex-1 space-y-0.5">
                        {(data?.myShifts ?? []).map(s => (
                          s.given_away ? (
                            <button
                              key={s.id}
                              onClick={e => { e.stopPropagation(); setReactivateTarget(s) }}
                              title="Given away — tap to reactivate if it fell through"
                              className="w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight transition-colors border-l-2 border-l-text/20 bg-text/5 hover:bg-text/10 opacity-60"
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="font-medium text-text/60 truncate line-through">{s.shift_title}</span>
                                <span className="shrink-0 text-[8px] font-semibold uppercase tracking-wide text-text/40">Given Away</span>
                              </div>
                              <div className="text-text/40 tabular-nums">
                                {fmtTime(s.start_time, settings?.timeFormat ?? '12h')}–{fmtTime(s.end_time, settings?.timeFormat ?? '12h')}
                              </div>
                            </button>
                          ) : (
                            <button
                              key={s.id}
                              onClick={e => { e.stopPropagation(); router.push(`/wall/edit-shift/${s.id}?from=calendar`) }}
                              data-tour="cal-shift"
                              className={cn(
                                'w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight transition-colors border-l-2',
                                s.is_trade && s.is_giveaway ? 'border-l-primary bg-primary/5 hover:bg-primary/10' :
                                s.is_trade    ? 'border-l-info    bg-info/5    hover:bg-info/10'    :
                                s.is_giveaway ? 'border-l-success bg-success/5 hover:bg-success/10' :
                                                'border-l-text/20 bg-text/5   hover:bg-text/10'
                              )}
                            >
                              <div className="flex items-center gap-0.5 min-w-0">
                                {s.bundle_id && (
                                  <Layers className="w-2.5 h-2.5 shrink-0 text-primary" aria-label="Part of a bundle" />
                                )}
                                <span className={cn('font-medium truncate', shiftTypeColor(s))}>{s.shift_title}</span>
                              </div>
                              <div className="text-text/50 tabular-nums">
                                {fmtTime(s.start_time, settings?.timeFormat ?? '12h')}–{fmtTime(s.end_time, settings?.timeFormat ?? '12h')}
                              </div>
                            </button>
                          )
                        ))}
                      </div>

                      {hasAnyDots(data) && (
                        <div className="mt-auto pt-1" onClick={e => e.stopPropagation()}>
                          <ActivityDots data={data} dateStr={dateStr} router={router} spread />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      ) : (
        // ── List view ──────────────────────────────────────────────────────
        <div className="space-y-4">
          {listDays.map((d, idx) => {
            const data = dayMap.get(d.dateStr)
            const shifts = data?.myShifts ?? []
            const isToday = d.dateStr === todayStr
            const showMonthHeader = idx === 0 || listDays[idx - 1].monthLabel !== d.monthLabel
            const eventBadges = getSpecialEventBadges(d.dateStr)

            return (
              <div key={d.dateStr}>
                {showMonthHeader && (
                  <h2 className="font-accent text-lg font-bold text-text mb-2 mt-2 first:mt-0">{d.monthLabel}</h2>
                )}
                <div className="rounded-lg border border-border overflow-hidden bg-card">
                  {/* Row 1: date header — a link to create a shift on this day.
                      A div playing button, not a real <button>, because the
                      badges need to be a genuine nested <button> of their own. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => goCreate(d.dateStr)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goCreate(d.dateStr) } }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold transition-colors min-h-0 cursor-pointer',
                      isToday ? 'bg-primary-light/40 text-primary' : 'text-text hover:bg-primary-light/20'
                    )}
                  >
                    <span className="truncate">{d.label}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {eventBadges.length > 0 && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setPartyLegendOpen(true) }}
                          aria-label="Party Legend — what these badges mean"
                          title="What do these mean? Tap for the Party Legend"
                          className="flex items-center gap-1 min-h-0 min-w-0 p-0.5 -m-0.5 rounded hover:bg-primary-light/60 transition-colors"
                        >
                          {eventBadges.map((b, i) => (
                            <span key={i} role="img" aria-label={b.label}>{b.emoji}</span>
                          ))}
                        </button>
                      )}
                      <Plus className="w-3.5 h-3.5 text-text/30" />
                    </span>
                  </div>

                  {shifts.length === 0 ? (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border">
                      <span className="text-sm text-text/40">No Shifts</span>
                      <ActivityDots data={data} dateStr={d.dateStr} router={router} />
                    </div>
                  ) : (
                    shifts.map((s, si) => {
                      const isLast = si === shifts.length - 1
                      if (s.given_away) {
                        return (
                          <button
                            key={s.id}
                            onClick={() => setReactivateTarget(s)}
                            title="Given away — tap to reactivate if it fell through"
                            className="w-full text-left px-3 py-2 border-t border-border opacity-60 hover:bg-text/5 transition-colors min-h-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-text/60 truncate line-through">{s.shift_title}</span>
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text/40">Given Away</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <span className="text-xs text-text/40 tabular-nums">
                                {fmtTime(s.start_time, settings?.timeFormat ?? '12h')}–{fmtTime(s.end_time, settings?.timeFormat ?? '12h')}
                              </span>
                              {isLast && <ActivityDots data={data} dateStr={d.dateStr} router={router} />}
                            </div>
                          </button>
                        )
                      }
                      return (
                        <div key={s.id} className="border-t border-border">
                          {/* Row 2: shift title + ⋮ menu (Edit / Remove) */}
                          <div className="flex items-center justify-between gap-2 px-3 pt-2">
                            <button
                              onClick={() => router.push(`/wall/edit-shift/${s.id}?from=calendar`)}
                              className="flex items-center gap-1 min-w-0 text-left hover:underline min-h-0"
                            >
                              {s.bundle_id && <Layers className="w-3 h-3 shrink-0 text-primary" aria-label="Part of a bundle" />}
                              <span className={cn('text-sm font-medium truncate', shiftTypeColor(s))}>{s.shift_title}</span>
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                const rect = e.currentTarget.getBoundingClientRect()
                                const W = 160 // w-40
                                setMenuFor(prev => prev?.id === s.id ? null : {
                                  id: s.id, top: rect.bottom + 4,
                                  left: Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8)),
                                })
                              }}
                              aria-label="More options"
                              className="p-1 rounded text-text/40 hover:text-text hover:bg-primary-light/50 transition-colors min-h-0 min-w-0 shrink-0"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Row 3: start–end time, dots on the last shift only */}
                          <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-0.5">
                            <span className="text-xs text-text/50 tabular-nums">
                              {fmtTime(s.start_time, settings?.timeFormat ?? '12h')}–{fmtTime(s.end_time, settings?.timeFormat ?? '12h')}
                            </span>
                            {isLast && <ActivityDots data={data} dateStr={d.dateStr} router={router} />}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ⋮ menu (List view) — portalled to body so the day-card's
          overflow-hidden (for its rounded corners) can't clip it */}
      {mounted && menuFor && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
          <div
            style={{ position: 'fixed', top: menuFor.top, left: menuFor.left }}
            className="w-40 rounded-lg border border-border bg-card shadow-xl z-50 py-1 overflow-hidden"
          >
            <button
              onClick={() => { const id = menuFor.id; setMenuFor(null); router.push(`/wall/edit-shift/${id}?from=calendar`) }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-text/80 hover:bg-primary-light/50 hover:text-text transition-colors"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" /> Edit
            </button>
            <button
              onClick={() => {
                const target = fMyShifts.find(s => s.id === menuFor.id) ?? null
                setMenuFor(null)
                setRemoveTarget(target)
              }}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm text-warning hover:bg-warning/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" /> Remove
            </button>
          </div>
        </>,
        document.body
      )}

      {/* ── Reactivate a given-away shift ─────────────────────────────── */}
      {reactivateTarget && (
        <Modal open onClose={() => setReactivateTarget(null)} size="sm" title="Reactivate Shift?">
          <p className="text-sm text-text/70 mb-4">
            Put <strong>{reactivateTarget.shift_title}</strong> back on the wall? Use this if the
            handoff didn&apos;t actually go through — anyone can claim it again.
          </p>
          {reactivateError && (
            <div className="mb-3 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs">
              {reactivateError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setReactivateTarget(null)}>Cancel</Button>
            <Button size="sm" loading={reactivating} onClick={handleReactivate} className="gap-1.5">
              <Undo2 className="w-4 h-4" /> Reactivate
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Remove a shift (List view's ⋮ menu) ───────────────────────── */}
      <ConfirmDialog
        open={!!removeTarget}
        title="Delete Shift"
        message={`Are you sure you want to delete this shift? This removes it from your calendar and the Wall. This cannot be undone.${removeTarget ? bundleBreakupWarning(bundleSizeOf(removeTarget), 'deleting it') : ''}`}
        confirmLabel="Delete"
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => { setRemoveTarget(null); setRemoveError(null) }}
      />

      {/* Delete failed (rare — e.g. lost ownership mid-session) */}
      {removeError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm flex items-center justify-between gap-2 shadow-lg">
          <span>{removeError}</span>
          <button onClick={() => setRemoveError(null)} className="shrink-0 underline text-xs">Dismiss</button>
        </div>
      )}

      <PartyLegendModal open={partyLegendOpen} onClose={() => setPartyLegendOpen(false)} />
    </div>
  )
}
