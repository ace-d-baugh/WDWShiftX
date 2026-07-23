'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Camera, Crown, Plus, RefreshCw, Undo2 } from 'lucide-react'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO, addMonths, startOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { getSettings, fmtTime, type UserSettings } from '@/lib/settings'
import { ScheduleImportModal } from '@/components/features/ScheduleImportModal'
import { reactivateShift } from '@/app/actions/claims'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const ET = 'America/New_York'

// ── Prop types ──────────────────────────────────────────────────────────────

interface MyShift {
  id: string; shift_title: string; start_time: string; end_time: string
  is_trade: boolean; is_giveaway: boolean; board_id: string | null
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

// ── Calendar client ───────────────────────────────────────────────────────────

export function CalendarClient({ userId, displayName, importEnabled, today, myShifts, boardShifts, boardRequests, boards, isPro }: CalendarClientProps) {
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [importOpen, setImportOpen] = useState(false)

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

  useEffect(() => { setSettings(getSettings()) }, [])

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
            className="btn btn-outline gap-1.5 text-sm px-4 py-2 min-h-0 h-10 no-underline"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Sync Calendar</span>
            <span className="hidden min-[505px]:inline sm:hidden">Sync</span>
            {!isPro && <Crown className="w-3.5 h-3.5 text-secondary-accent" fill="#ffea80" strokeWidth={0} aria-label="Pro feature" />}
          </Link>
          <Link href="/wall/new-shift?from=calendar" className="btn btn-primary gap-1.5 text-sm px-4 py-2 min-h-0 h-10 no-underline">
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

      {/* Dot legend */}
      <div className="flex items-center gap-5 mb-6 flex-wrap text-xs text-text/60">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />Trade + Giveaway</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-info inline-block" />Trade</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />Giveaway</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />Request</span>
      </div>

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

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        'bg-card p-1.5 min-h-[90px] flex flex-col',
                        isPast && 'opacity-50'
                      )}
                    >
                      {/* Day number */}
                      <span className={cn(
                        'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full shrink-0',
                        isToday ? 'bg-primary text-white' : 'text-text/60'
                      )}>
                        {day}
                      </span>

                      {/* User's personal shifts — given-away ones stay visible
                          (not filtered out) with a muted/struck marker and a
                          reactivate action, and sit fine alongside a new,
                          fully-active shift at the same time since each is
                          just its own row here, never a shared slot. */}
                      <div className="flex-1 space-y-0.5">
                        {(data?.myShifts ?? []).map(s => (
                          s.given_away ? (
                            <button
                              key={s.id}
                              onClick={() => setReactivateTarget(s)}
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
                              onClick={() => router.push(`/wall/edit-shift/${s.id}?from=calendar`)}
                              className={cn(
                                'w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight transition-colors border-l-2',
                                s.is_trade && s.is_giveaway ? 'border-l-primary bg-primary/5 hover:bg-primary/10' :
                                s.is_trade    ? 'border-l-info    bg-info/5    hover:bg-info/10'    :
                                s.is_giveaway ? 'border-l-success bg-success/5 hover:bg-success/10' :
                                                'border-l-text/20 bg-text/5   hover:bg-text/10'
                              )}
                            >
                              <div className="font-medium text-text truncate">{s.shift_title}</div>
                              <div className="text-text/50 tabular-nums">
                                {fmtTime(s.start_time, settings?.timeFormat ?? '12h')}–{fmtTime(s.end_time, settings?.timeFormat ?? '12h')}
                              </div>
                            </button>
                          )
                        ))}
                      </div>

                      {/* Activity dots — big tappable circles in one row at
                          the bottom of the cell. The three wall dots (offers)
                          overlap like an avatar stack: giveaway in front,
                          trade behind it, both at the back (-ml-2 ≈ 40%
                          overlap at the 20px desktop size). The request dot
                          sits alone on the other side of the row, same size,
                          since it opens the Requests tab instead. */}
                      {data && (data.hasBoth || data.hasTradeOnly || data.hasGiveawayOnly || data.hasRequest) && (
                        <div className="flex items-center mt-auto pt-1">
                          <div className="flex items-center">
                            {data.hasBoth && (
                              <button
                                onClick={() => router.push(`/wall?tab=offers&date=${dateStr}`)}
                                title="Trade + Giveaway on this day"
                                className="relative z-0 min-h-0 min-w-0"
                              >
                                <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-primary ring-1 ring-card hover:opacity-70 transition-opacity" />
                              </button>
                            )}
                            {data.hasTradeOnly && (
                              <button
                                onClick={() => router.push(`/wall?tab=offers&date=${dateStr}`)}
                                title="Trade shift on this day"
                                className={cn('relative z-10 min-h-0 min-w-0', data.hasBoth && '-ml-1 min-[505px]:-ml-2')}
                              >
                                <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-info ring-1 ring-card hover:opacity-70 transition-opacity" />
                              </button>
                            )}
                            {data.hasGiveawayOnly && (
                              <button
                                onClick={() => router.push(`/wall?tab=offers&date=${dateStr}`)}
                                title="Giveaway shift on this day"
                                className={cn('relative z-20 min-h-0 min-w-0', (data.hasBoth || data.hasTradeOnly) && '-ml-1 min-[505px]:-ml-2')}
                              >
                                <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-success ring-1 ring-card hover:opacity-70 transition-opacity" />
                              </button>
                            )}
                          </div>
                          {data.hasRequest && (
                            <button
                              onClick={() => router.push(`/wall?tab=requests&date=${dateStr}`)}
                              title="Shift request on this day"
                              className="ml-auto relative z-30 min-h-0 min-w-0"
                            >
                              <span className="block w-2.5 h-2.5 min-[505px]:w-4 min-[505px]:h-4 sm:w-5 sm:h-5 rounded-full bg-accent hover:opacity-70 transition-opacity" />
                            </button>
                          )}
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
    </div>
  )
}
