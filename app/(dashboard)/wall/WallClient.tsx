'use client'

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from 'react'
import Link from 'next/link'
import { parseISO, format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Plus, RefreshCw, Inbox, Search, SlidersHorizontal, ChevronDown, X, Check, Layers, CalendarDays, LayoutGrid } from 'lucide-react'
import { getSettings } from '@/lib/settings'
import { createClient } from '@/lib/supabase/client'
import { deactivateShift, deactivateRequest } from '@/app/actions/posts'
import { PushPromptBanner } from '@/components/features/PushPromptBanner'
import { IosInstallPrompt } from '@/components/features/IosInstallPrompt'
import { ShiftCard, type ShiftData } from '@/components/features/ShiftCard'
import type { MyClaim, PendingClaim } from '@/components/features/ClaimSection'
import { RequestCard, type RequestData } from '@/components/features/RequestCard'
import { WallSkeleton } from '@/components/ui/WallSkeleton'
import { Checkbox } from '@/components/ui/Checkbox'
import { sampleWallShifts, useSampleMode } from '@/lib/tour/sample-data'
import { getSpecialEventBadges } from '@/lib/special-events'
import { PartyLegendModal } from '@/components/features/PartyLegendModal'
import { cn } from '@/lib/utils'

const ET = 'America/New_York'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBR  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Fixed Sun→Sat order for the day pills, independent of the user's week-start
// setting (which still governs the calendar popups elsewhere on the page).
const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6]
// date-fns 'i' → 1=Mon..7=Sun; %7 maps to 0=Sun..6=Sat (JS getDay / settings.weekStart)
const shiftWeekday = (iso: string) => Number(formatInTimeZone(parseISO(iso), ET, 'i')) % 7
const requestWeekday = (dateStr: string) => Number(formatInTimeZone(`${dateStr}T12:00:00Z`, ET, 'i')) % 7

interface Board { id: string; name: string }

// Shared between the full wall load and the single-row realtime upsert
const SHIFT_SELECT = `
  id, shift_title, created_by, user_id, board_id,
  start_time, end_time, is_trade, is_giveaway, is_overtime_approved,
  details, is_active, expires_at, created_at, bundle_id,
  boards(name),
  users!user_id(notify_via_email, notify_via_sms, phone_number)
`

const REQUEST_SELECT = `
  id, created_by, user_id, board_id, request_title, preferred_times, requested_date,
  details, is_active, expires_at, created_at,
  boards(name),
  users!user_id(notify_via_email, notify_via_sms, phone_number)
`

type PosterContact = { notify_via_email: boolean; notify_via_sms: boolean; phone_number: string | null } | null

function posterContactReady(poster: PosterContact): boolean {
  return (poster?.notify_via_email ?? false) ||
         ((poster?.notify_via_sms ?? false) && !!poster?.phone_number)
}

function mapShiftRow(s: Record<string, unknown>) {
  return {
    id: s.id as string,
    shift_title: s.shift_title as string,
    created_by: s.created_by as string,
    user_id: s.user_id as string | null,
    board_id: s.board_id as string | null,
    board_name: (s.boards as { name: string } | null)?.name ?? '',
    start_time: s.start_time as string,
    end_time: s.end_time as string,
    is_trade: s.is_trade as boolean,
    is_giveaway: s.is_giveaway as boolean,
    is_overtime_approved: s.is_overtime_approved as boolean,
    details: s.details as string | null,
    is_active: s.is_active as boolean,
    expires_at: s.expires_at as string,
    created_at: s.created_at as string,
    bundle_id: (s.bundle_id as string | null) ?? null,
    contactReady: posterContactReady(s.users as PosterContact),
  }
}

function mapRequestRow(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    created_by: r.created_by as string,
    user_id: r.user_id as string | null,
    board_id: r.board_id as string | null,
    board_name: (r.boards as { name: string } | null)?.name ?? '',
    request_title: (r.request_title as string | null) ?? 'Shift Wanted',
    preferred_times: r.preferred_times as import('@/lib/database.types').PreferredTime[],
    requested_date: r.requested_date as string,
    details: r.details as string | null,
    is_active: r.is_active as boolean,
    expires_at: r.expires_at as string,
    created_at: r.created_at as string,
    contactReady: posterContactReady(r.users as PosterContact),
  }
}

/** Read-only trigger for the filter's calendar popup, with a clear button
 *  once a date is picked (react-datepicker's isClearable supplies onClear). */
const FilterDateInput = forwardRef<HTMLInputElement, {
  value?: string; onClick?: () => void; placeholder?: string; onClear?: () => void
}>(({ value, onClick, placeholder, onClear }, ref) => (
  <div className="relative">
    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 dark:text-primary pointer-events-none z-10" />
    <input
      ref={ref}
      readOnly
      value={value ?? ''}
      onClick={onClick}
      placeholder={placeholder ?? 'Any Date'}
      className={`input text-sm pl-9 ${value ? 'pr-8' : ''} cursor-pointer`}
    />
    {value && onClear && (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClear() }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text/40 hover:text-text min-h-0 min-w-0 z-10"
        aria-label="Clear date"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
))
FilterDateInput.displayName = 'FilterDateInput'

interface WallClientProps {
  userId: string
  boards: Board[]
  hasBoards: boolean
  initialTab?: Tab
  initialDate?: string
}

type Tab = 'offers' | 'requests'

export function WallClient({ userId, boards, hasBoards, initialTab = 'offers', initialDate = '' }: WallClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const settings = getSettings()
  const [tab, setTab] = useState<Tab>(initialTab)
  const sampleMode = useSampleMode()
  const [shifts, setShifts] = useState<ShiftData[]>([])
  const [requests, setRequests] = useState<RequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState(initialDate)
  const [boardFilters, setBoardFilters] = useState<Set<string>>(new Set())
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false)
  const boardDropdownRef = useRef<HTMLDivElement>(null)
  // Type filter (offers only): independent trade/giveaway toggles over the raw
  // flags — a Give/Trade post (both flags) matches either one. Both on by
  // default; unchecking both intentionally shows nothing.
  const [typeFilters, setTypeFilters] = useState<{ trade: boolean; giveaway: boolean }>({ trade: true, giveaway: true })
  // Days filter: weekday indices (0=Sun..6=Sat) shown as pills. All on by
  // default; unchecking every day intentionally shows nothing (same rule as
  // the Type filter above).
  const [dayFilters, setDayFilters] = useState<Set<number>>(() => new Set(ALL_DAYS))
  // Controlled so a second click on the field closes the calendar (toggle).
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [myPostsOnly, setMyPostsOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  /** Set by tapping a card's bundle icon — narrows the Wall to one bundle. */
  const [bundleFilter, setBundleFilter] = useState<string | null>(null)

  // Trade Loop (Task 21): claim state for the visible shifts
  const [myClaims, setMyClaims] = useState<Map<string, MyClaim>>(new Map())
  const [pendingByShift, setPendingByShift] = useState<Map<string, PendingClaim[]>>(new Map())
  const [awaitingFinalize, setAwaitingFinalize] = useState(0)
  // Bare pending-claim counts for every visible shift, not just the ones the
  // current user owns — shift_claims RLS only lets a claimant/owner see
  // individual rows, so the "I'll take this (N)" count for a bystander comes
  // from this identity-free aggregate instead.
  const [claimCounts, setClaimCounts] = useState<Map<string, number>>(new Map())
  // Same idea for bundles: one claim covers the whole set, so every card in a
  // bundle shows that bundle's count rather than its own (always zero).
  const [bundleClaimCounts, setBundleClaimCounts] = useState<Map<string, number>>(new Map())

  // Collapsed state for day-group accordions, persisted per user
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())

  // Party Legend — one modal shared by every MNSSHP/HHN/MVMCP badge on the page
  const [partyLegendOpen, setPartyLegendOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`wall-collapsed-${userId}`)
      if (raw) setCollapsedKeys(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [userId])

  const toggleCollapsed = useCallback((t: Tab, dayKey: string) => {
    const k = `${t}|${dayKey}`
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      try {
        localStorage.setItem(`wall-collapsed-${userId}`, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [userId])

  const attachCommentCounts = useCallback(async <T extends { id: string }>(
    items: T[],
    postType: 'shift' | 'request'
  ): Promise<(T & { comment_count: number; interested_count: number })[]> => {
    if (items.length === 0) return []
    const ids = items.map(i => i.id)
    const { data } = await supabase
      .from('comments')
      .select('post_id, user_id, is_interested')
      .eq('post_type', postType)
      .eq('is_active', true)
      .in('post_id', ids)

    const counts = new Map<string, { total: number; interested: Set<string> }>()
    ;(data ?? []).forEach((c: { post_id: string; user_id: string | null; is_interested: boolean }) => {
      const entry = counts.get(c.post_id) ?? { total: 0, interested: new Set<string>() }
      entry.total += 1
      if (c.is_interested && c.user_id) entry.interested.add(c.user_id)
      counts.set(c.post_id, entry)
    })

    return items.map(i => ({
      ...i,
      comment_count: counts.get(i.id)?.total ?? 0,
      interested_count: counts.get(i.id)?.interested.size ?? 0,
    }))
  }, [supabase])

  const loadShifts = useCallback(async (silent = false) => {
    if (!hasBoards) { if (!silent) setLoading(false); return }
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('shifts')
        .select(SHIFT_SELECT)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .or('is_trade.eq.true,is_giveaway.eq.true')
        .order('start_time', { ascending: true })

      if (error) throw error

      const mapped = (data ?? []).map((s: Record<string, unknown>) => mapShiftRow(s))
      setShifts(await attachCommentCounts(mapped, 'shift'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [hasBoards, attachCommentCounts, supabase])

  const loadRequests = useCallback(async (silent = false) => {
    if (!hasBoards) { if (!silent) setLoading(false); return }
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(REQUEST_SELECT)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('requested_date', { ascending: true })

      if (error) throw error

      const mapped = (data ?? []).map((r: Record<string, unknown>) => mapRequestRow(r))
      setRequests(await attachCommentCounts(mapped, 'request'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [hasBoards, attachCommentCounts, supabase])

  // Realtime upserts: fetch just the changed row (with its joins and counts)
  // instead of reloading the whole wall on every event. A row that no longer
  // matches the wall filters (inactive, expired, or not visible under RLS)
  // comes back null and is removed from the list.
  const upsertShift = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('shifts')
      .select(SHIFT_SELECT)
      .eq('id', id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .or('is_trade.eq.true,is_giveaway.eq.true')
      .maybeSingle()

    if (!data) {
      setShifts(prev => prev.filter(s => s.id !== id))
      return
    }
    const [shift] = await attachCommentCounts([mapShiftRow(data as Record<string, unknown>)], 'shift')
    setShifts(prev => {
      const next = prev.filter(s => s.id !== id)
      next.push(shift)
      next.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.created_at.localeCompare(b.created_at))
      return next
    })
  }, [supabase, attachCommentCounts])

  const upsertRequest = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('requests')
      .select(REQUEST_SELECT)
      .eq('id', id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (!data) {
      setRequests(prev => prev.filter(r => r.id !== id))
      return
    }
    const [request] = await attachCommentCounts([mapRequestRow(data as Record<string, unknown>)], 'request')
    setRequests(prev => {
      const next = prev.filter(r => r.id !== id)
      next.push(request)
      next.sort((a, b) => a.requested_date.localeCompare(b.requested_date) || a.created_at.localeCompare(b.created_at))
      return next
    })
  }, [supabase, attachCommentCounts])

  // Trade Loop (Task 21): load claim state for the visible shifts — the
  // current user's own claims, pending claims on their posts (with each
  // claimant's reliability record), completed-trade badges for posters, and
  // how many accepted trades are past their shift end awaiting confirmation.
  const loadClaimData = useCallback(async (shiftList: ShiftData[]) => {
    const shiftIds = shiftList.map(s => s.id)
    const bundleIds = [...new Set(shiftList.map(s => s.bundle_id).filter((b): b is string => !!b))]

    const [mineRes, pendingRes, acceptedRes, countsRes, bundleCountsRes] = await Promise.all([
      shiftIds.length
        ? supabase
            .from('shift_claims')
            .select('id, shift_id, bundle_id, status')
            .eq('claimant_id', userId)
            .or(`shift_id.in.(${shiftIds.join(',')})${bundleIds.length ? `,bundle_id.in.(${bundleIds.join(',')})` : ''}`)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('shift_claims')
        .select('id, shift_id, bundle_id, claimant_id, claimant:users!claimant_id(display_name)')
        .eq('owner_id', userId)
        .eq('status', 'pending'),
      supabase
        .from('shift_claims')
        .select('id, shifts!shift_id(end_time)')
        .eq('owner_id', userId)
        .eq('status', 'accepted'),
      // Bare counts for every visible shift, not just ones this user owns —
      // powers the "I'll take this (N)" count for bystanders.
      shiftIds.length
        ? supabase.rpc('get_shift_claim_counts', { p_shift_ids: shiftIds })
        : Promise.resolve({ data: [] }),
      bundleIds.length
        ? supabase.rpc('get_bundle_claim_counts', { p_bundle_ids: bundleIds })
        : Promise.resolve({ data: [] }),
    ])

    // Latest claim per shift (a declined claimant may have claimed again).
    // A bundle claim is anchored to one shift but applies to every card in
    // the bundle, so fan it out across the bundle's siblings.
    const bundleMembers = new Map<string, string[]>()
    for (const s of shiftList) {
      if (!s.bundle_id) continue
      bundleMembers.set(s.bundle_id, [...(bundleMembers.get(s.bundle_id) ?? []), s.id])
    }

    const mine = new Map<string, MyClaim>()
    for (const c of (mineRes.data ?? []) as { id: string; shift_id: string; bundle_id: string | null; status: MyClaim['status'] }[]) {
      const targets = c.bundle_id ? (bundleMembers.get(c.bundle_id) ?? [c.shift_id]) : [c.shift_id]
      for (const t of targets) {
        if (!mine.has(t)) mine.set(t, { id: c.id, status: c.status })
      }
    }

    // No reliability stats are fetched here any more. They used to be pulled
    // for every poster and every pending claimant and shown to other members;
    // a person's trade record is now theirs alone (Profile -> Trade Record),
    // plus Overlord.
    const pendingRows = (pendingRes.data ?? []) as unknown as {
      id: string; shift_id: string; bundle_id: string | null; claimant_id: string
      claimant: { display_name: string | null } | null
    }[]

    const pending = new Map<string, PendingClaim[]>()
    for (const c of pendingRows) {
      const size = c.bundle_id ? (bundleMembers.get(c.bundle_id)?.length ?? 0) : 0
      const list = pending.get(c.shift_id) ?? []
      list.push({
        id: c.id,
        claimant_id: c.claimant_id,
        claimant_name: c.claimant?.display_name ?? 'A board member',
        bundleSize: size || undefined,
      })
      pending.set(c.shift_id, list)
    }

    const now = Date.now()
    const awaiting = ((acceptedRes.data ?? []) as unknown as { id: string; shifts: { end_time: string } | null }[])
      .filter(c => c.shifts && parseISO(c.shifts.end_time).getTime() < now)
      .length

    const counts = new Map<string, number>()
    for (const row of (countsRes.data ?? []) as { shift_id: string; pending_count: number }[]) {
      counts.set(row.shift_id, row.pending_count)
    }

    const bundleCounts = new Map<string, number>()
    for (const row of (bundleCountsRes.data ?? []) as { bundle_id: string; pending_count: number }[]) {
      bundleCounts.set(row.bundle_id, row.pending_count)
    }

    setMyClaims(mine)
    setPendingByShift(pending)
    setAwaitingFinalize(awaiting)
    setClaimCounts(counts)
    setBundleClaimCounts(bundleCounts)
  }, [supabase, userId])

  // Refresh claim state whenever the shift list changes (initial load,
  // realtime upserts, and post-action reloads all funnel through setShifts).
  // Debounced so a burst of realtime events coalesces into one 3-query fetch.
  useEffect(() => {
    if (!hasBoards) return
    const t = setTimeout(() => { loadClaimData(shifts).catch(() => {}) }, 300)
    return () => clearTimeout(t)
  }, [hasBoards, shifts, loadClaimData])

  const handleClaimChanged = useCallback(() => {
    // Accepting archives the post, so reload the list; the effect above
    // re-pulls claim state for whatever remains visible.
    loadShifts(true)
  }, [loadShifts])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      loadShifts()
      loadRequests()
      return
    }
    if (tab === 'offers') loadShifts()
    else loadRequests()
  }, [tab, loadShifts, loadRequests])

  // Realtime subscriptions — new/updated/removed shifts and requests apply
  // to the list the moment they land.
  useEffect(() => {
    if (!hasBoards) return

    // Scope realtime to this user's boards — otherwise every shifts/requests
    // change site-wide pings every open wall. Trade-off: filtered DELETE
    // events don't fire (the old row only carries its PK), so a hard delete
    // (board-deletion cascade) surfaces on the next refresh; normal removals
    // are soft (is_active UPDATE) and still arrive live.
    const boardFilter = `board_id=in.(${boards.map(b => b.id).join(',')})`

    const shiftsChannel = supabase
      .channel('realtime:shifts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: boardFilter },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setShifts(prev => prev.filter(s => s.id !== (payload.old as { id: string }).id))
          } else if (payload.eventType === 'UPDATE' && !(payload.new as { is_active: boolean }).is_active) {
            setShifts(prev => prev.filter(s => s.id !== (payload.new as { id: string }).id))
          } else {
            upsertShift((payload.new as { id: string }).id)
          }
        }
      )
      .subscribe()

    const requestsChannel = supabase
      .channel('realtime:requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: boardFilter },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setRequests(prev => prev.filter(r => r.id !== (payload.old as { id: string }).id))
          } else if (payload.eventType === 'UPDATE' && !(payload.new as { is_active: boolean }).is_active) {
            setRequests(prev => prev.filter(r => r.id !== (payload.new as { id: string }).id))
          } else {
            upsertRequest((payload.new as { id: string }).id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(shiftsChannel)
      supabase.removeChannel(requestsChannel)
    }
  }, [hasBoards, boards, supabase, upsertShift, upsertRequest])

  // Un-post path: the card already wrote to the server, so just prune it and
  // re-pull — dissolving a bundle also rewrites its siblings' bundle_id.
  const handleShiftRemoved = useCallback((id: string) => {
    setShifts(prev => prev.filter(s => s.id !== id))
    loadShifts(true)
  }, [loadShifts])

  const handleDeactivateShift = async (id: string) => {
    setDeactivateError(null)
    setShifts(prev => prev.filter(s => s.id !== id))
    const result = await deactivateShift(id)
    if (result.error) {
      setDeactivateError(result.error)
      loadShifts()
    }
  }

  const handleDeactivateRequest = async (id: string) => {
    setDeactivateError(null)
    setRequests(prev => prev.filter(r => r.id !== id))
    const result = await deactivateRequest(id)
    if (result.error) {
      setDeactivateError(result.error)
      loadRequests()
    }
  }

  // Fulfilling already wrote to the server (RequestCard called fulfillRequest
  // itself) — just prune it from the list here.
  const handleRequestFulfilled = (id: string) => {
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  const toggleBoard = (id: string) => {
    setBoardFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleDay = (day: number) => {
    setDayFilters(prev => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boardDropdownRef.current && !boardDropdownRef.current.contains(e.target as Node)) {
        setBoardDropdownOpen(false)
      }
    }
    if (boardDropdownOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [boardDropdownOpen])

  // Day-pill order follows the user's week-start preference, same as the
  // calendar and the date picker below.
  const orderedDayIndices = useMemo(
    () => Array.from({ length: 7 }, (_, i) => (settings.weekStart + i) % 7),
    [settings.weekStart]
  )

  const refresh = () => {
    if (tab === 'offers') loadShifts()
    else loadRequests()
  }

  // While the tour is running, three demo shifts (one per posting type) are
  // folded into the list so the walkthrough always has one clean example of
  // each to point at — on a busy Wall as well as an empty one. They live only
  // in memory and vanish the moment the tour ends. Sorted back into start-time
  // order so the day grouping below still comes out chronological.
  const displayShifts = useMemo(() => {
    if (!sampleMode) return shifts
    return [...sampleWallShifts(), ...shifts].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    )
  }, [shifts, sampleMode])

  const filteredShifts = useMemo(() => {
    let list = displayShifts
    if (bundleFilter)       list = list.filter(s => s.bundle_id === bundleFilter)
    if (myPostsOnly)        list = list.filter(s => s.user_id === userId)
    if (boardFilters.size)  list = list.filter(s => s.board_id != null && boardFilters.has(s.board_id))
    // Always applied: with both types off, this yields nothing (by design).
    list = list.filter(s =>
      (typeFilters.trade && s.is_trade) || (typeFilters.giveaway && s.is_giveaway)
    )
    // Always applied: with every day off, this yields nothing (by design).
    list = list.filter(s => dayFilters.has(shiftWeekday(s.start_time)))
    if (dateFilter)         list = list.filter(s => formatInTimeZone(parseISO(s.start_time), ET, 'yyyy-MM-dd') === dateFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.shift_title.toLowerCase().includes(q) ||
        s.created_by.toLowerCase().includes(q) ||
        s.board_name.toLowerCase().includes(q) ||
        (s.details ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [displayShifts, search, dateFilter, boardFilters, typeFilters, dayFilters, myPostsOnly, bundleFilter, userId])

  const filteredRequests = useMemo(() => {
    let list = requests
    if (myPostsOnly)        list = list.filter(r => r.user_id === userId)
    if (boardFilters.size)  list = list.filter(r => r.board_id != null && boardFilters.has(r.board_id))
    list = list.filter(r => dayFilters.has(requestWeekday(r.requested_date)))
    if (dateFilter)         list = list.filter(r => r.requested_date === dateFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.created_by.toLowerCase().includes(q) ||
        r.board_name.toLowerCase().includes(q) ||
        (r.details ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [requests, search, dateFilter, boardFilters, dayFilters, myPostsOnly, userId])

  // Group shifts by their start date in ET
  const shiftDayGroups = useMemo(() => {
    const groups = new Map<string, { dayLabel: string; items: ShiftData[] }>()
    filteredShifts.forEach(shift => {
      const dayKey = formatInTimeZone(parseISO(shift.start_time), ET, 'yyyy-MM-dd')
      const dayLabel = formatInTimeZone(parseISO(shift.start_time), ET, 'EEEE, MMMM d, yyyy')
      if (!groups.has(dayKey)) groups.set(dayKey, { dayLabel, items: [] })
      groups.get(dayKey)!.items.push(shift)
    })
    return [...groups.entries()].map(([dayKey, v]) => ({ dayKey, ...v }))
  }, [filteredShifts])

  // Group requests by requested_date
  const requestDayGroups = useMemo(() => {
    const groups = new Map<string, { dayLabel: string; items: RequestData[] }>()
    filteredRequests.forEach(req => {
      const dayKey = req.requested_date
      // Use noon UTC so ET conversion never crosses a date boundary
      const dayLabel = formatInTimeZone(req.requested_date + 'T12:00:00Z', ET, 'EEEE, MMMM d, yyyy')
      if (!groups.has(dayKey)) groups.set(dayKey, { dayLabel, items: [] })
      groups.get(dayKey)!.items.push(req)
    })
    return [...groups.entries()].map(([dayKey, v]) => ({ dayKey, ...v }))
  }, [filteredRequests])

  // Bundle groupings come from the full shift list, not the filtered one — a
  // bundle's size shouldn't shrink just because a date filter hid one card.
  const bundlesById = useMemo(() => {
    const m = new Map<string, ShiftData[]>()
    for (const s of shifts) {
      if (!s.bundle_id) continue
      m.set(s.bundle_id, [...(m.get(s.bundle_id) ?? []), s])
    }
    return m
  }, [shifts])

  const handleFilterBundle = useCallback((bundleId: string) => {
    setBundleFilter(bundleId)
    setTab('offers')
    setFiltersOpen(true)
  }, [])

  const hasActiveFilters = !!bundleFilter || myPostsOnly || boardFilters.size > 0 ||
    !(typeFilters.trade && typeFilters.giveaway) || dayFilters.size < ALL_DAYS.length ||
    !!dateFilter || !!search.trim()

  const clearFilters = () => {
    setBundleFilter(null)
    setMyPostsOnly(false)
    setBoardFilters(new Set())
    setTypeFilters({ trade: true, giveaway: true })
    setDayFilters(new Set(ALL_DAYS))
    setDateFilter('')
    setSearch('')
  }

  const currentPostCount = tab === 'offers' ? displayShifts.length : requests.length

  const tabLabel = (t: Tab) => {
    const count = t === 'offers' ? filteredShifts.length : filteredRequests.length
    return (
      <span className="flex items-center gap-1.5">
        {t === 'offers' ? 'Shift Offers' : 'Shift Requests'}
        <span className={cn(
          'text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center leading-none',
          tab === t ? 'bg-primary/20 text-primary' : 'bg-text/10 text-text/50'
        )}>
          {count}
        </span>
      </span>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-accent text-2xl font-bold text-text">The Wall</h1>
          <p className="text-sm text-text/60">Browse and post shift offers and requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-2 rounded-md text-text/50 hover:text-primary hover:bg-primary-light transition-colors min-h-0 min-w-0"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {hasBoards && (
            <Link
              href={tab === 'offers' ? '/wall/new-shift' : '/wall/new-request'}
              data-tour="wall-post"
              className="btn btn-primary gap-1.5 text-sm px-4 py-2 min-h-0 h-10"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{tab === 'offers' ? 'Post Shift' : 'Post Request'}</span>
              <span className="sm:hidden">{tab === 'offers' ? 'Offer' : 'Request'}</span>
            </Link>
          )}
        </div>
      </div>

      <PushPromptBanner />

      {/* iOS Safari tab: push needs a Home Screen install first (Task 23) */}
      <IosInstallPrompt />

      {/* Trade Loop: accepted trades past their shift end, awaiting confirmation */}
      {awaitingFinalize > 0 && (
        <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-text/80">
            🤝 {awaitingFinalize === 1 ? 'A trade you accepted has' : `${awaitingFinalize} trades you accepted have`} passed —
            did {awaitingFinalize === 1 ? 'it' : 'they'} go through?
          </span>
          <Link href="/profile#trade-record" className="text-primary font-medium underline text-xs min-h-0 min-w-0">
            Confirm in your Trade Record
          </Link>
        </div>
      )}

      {/* Deactivate error */}
      {deactivateError && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm flex items-center justify-between">
          <span>{deactivateError}</span>
          <button onClick={() => setDeactivateError(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div data-tour="wall-tabs" className="flex border-b border-border mb-5">
        {(['offers', 'requests'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-0 min-w-0',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-text/50 hover:text-text'
            )}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {/* Filters — trigger and panel share a wrapper so the tour can expand the
          panel and highlight the whole control as one region. */}
      {(currentPostCount > 1 || hasActiveFilters) && (
        <div data-tour="wall-filters-area">
          {/* Header row: the Filters toggle, with Clear Filters pinned to the
              end so it appears/disappears without shifting the panel below. */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              data-tour="wall-filters"
              data-tour-open={String(filtersOpen)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary min-h-0 min-w-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-label="filters active" />
              )}
              <ChevronDown className={cn('w-4 h-4 transition-transform', filtersOpen && 'rotate-180')} />
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-sm font-medium text-warning hover:text-warning/80 transition-colors min-h-0 min-w-0"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>

          {/* Grid-rows 0fr/1fr collapse trick (same as DayGroup/LetterSection
              elsewhere) so opening/closing Filters animates its height
              instead of the panel just popping in and out. Always mounted —
              only the wrapper's row height and the inner overflow-hidden
              clip decide whether it's visible. */}
          <div className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-spring',
            filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}>
          <div className="overflow-hidden">
            <div className="mb-6 p-4 bg-primary-light rounded-lg space-y-3">
              {/* Bundle chip (Clear Filters now lives on the Filters header) */}
              {bundleFilter && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/15 text-primary px-2 py-1 rounded-full">
                    <Layers className="w-3 h-3" />
                    Showing 1 bundle ({bundlesById.get(bundleFilter)?.length ?? 0})
                  </span>
                </div>
              )}

              {/* Board — its own full-width row, first among the filters.
                  Only meaningful once there's more than one board to
                  actually filter between. */}
              {boards.length > 1 && (
              <div ref={boardDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setBoardDropdownOpen(o => !o)}
                    aria-label="Filter by board"
                    className="input text-sm h-9 w-full flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <LayoutGrid className="w-4 h-4 shrink-0 text-text/40" />
                      <span className="truncate text-left">
                        {boardFilters.size === 0
                          ? 'All Boards'
                          : boardFilters.size === 1
                            ? (boards.find(b => boardFilters.has(b.id))?.name ?? '1 Board')
                            : `${boardFilters.size} Boards`}
                      </span>
                    </span>
                    <ChevronDown className={cn('w-4 h-4 shrink-0 text-text/40 transition-transform', boardDropdownOpen && 'rotate-180')} />
                  </button>

                  {boardDropdownOpen && (
                    <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[180px] bg-card border border-border rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setBoardFilters(new Set())}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-primary-light/40 transition-colors min-h-0 min-w-0"
                      >
                        <span className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center', boardFilters.size === 0 ? 'bg-primary border-primary' : 'border-border bg-background')}>
                          {boardFilters.size === 0 && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className="font-medium">All Boards</span>
                      </button>

                      {boardFilters.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setBoardFilters(new Set())}
                          className="w-full flex items-center px-3 py-1 text-xs text-primary hover:text-primary/70 transition-colors min-h-0 min-w-0"
                        >
                          Clear selection
                        </button>
                      )}

                      <div className="h-px bg-border mx-2 my-1" />

                      {boards.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBoard(b.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-primary-light/40 transition-colors min-h-0 min-w-0"
                        >
                          <span className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center', boardFilters.has(b.id) ? 'bg-primary border-primary' : 'border-border bg-background')}>
                            {boardFilters.has(b.id) && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span className="truncate">{b.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* My Posts + (offers) Trade/Giveaway share a row with the Days
                  pills on wide screens; stacks on mobile. sm:order flips
                  which column each sits in on wide screens (Days first, so
                  it lands directly above the Date picker below it) without
                  touching DOM order, which is what keeps mobile's stack
                  order as My Posts/Trade/Giveaway then Days. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-around gap-y-2 flex-wrap sm:order-2">
                  <label className="flex items-center gap-2 cursor-pointer min-h-0">
                    <Checkbox
                      checked={myPostsOnly}
                      onChange={e => setMyPostsOnly(e.target.checked)}
                    />
                    <span className="text-sm text-text whitespace-nowrap">My Posts</span>
                  </label>

                  {tab === 'offers' && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer min-h-0">
                        <Checkbox
                          checked={typeFilters.trade}
                          onChange={e => setTypeFilters(t => ({ ...t, trade: e.target.checked }))}
                        />
                        <span className="text-sm font-bold text-info">Trade</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer min-h-0">
                        <Checkbox
                          checked={typeFilters.giveaway}
                          onChange={e => setTypeFilters(t => ({ ...t, giveaway: e.target.checked }))}
                        />
                        <span className="text-sm font-bold text-success">Giveaway</span>
                      </label>
                    </>
                  )}
                </div>

                {/* Days — always-visible pills, ordered from the user's
                    week-start preference. Colored (primary) when included,
                    gray when clicked off. All colored by default. */}
                <div className="flex flex-wrap justify-around gap-y-1.5 sm:order-1" role="group" aria-label="Filter by day of week">
                  {orderedDayIndices.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      aria-pressed={dayFilters.has(d)}
                      title={DAY_NAMES[d]}
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors min-h-0 min-w-0',
                        dayFilters.has(d)
                          ? 'bg-primary text-white hover:bg-primary/90'
                          : 'bg-text/10 text-text/40 hover:bg-text/15'
                      )}
                    >
                      {DAY_ABBR[d]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Search share a row on wide screens; Date stacks above
                  Search on mobile. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date — react-datepicker so it's a real calendar popup on
                    every browser, matching the post/edit forms (the native
                    input[type=date] renders as a bare text field in some). */}
                <div>
                  <DatePicker
                    open={datePickerOpen}
                    onInputClick={() => setDatePickerOpen(o => !o)}
                    onClickOutside={() => setDatePickerOpen(false)}
                    preventOpenOnFocus
                    selected={dateFilter ? parseISO(`${dateFilter}T12:00:00`) : null}
                    onChange={(d: Date | null) => { setDateFilter(d ? format(d, 'yyyy-MM-dd') : ''); setDatePickerOpen(false) }}
                    dateFormat={settings.dateFormat === 'dmy' ? 'dd/MM/yyyy' : 'MM/dd/yyyy'}
                    calendarStartDay={settings.weekStart as 0 | 1 | 2 | 3 | 4 | 5 | 6}
                    minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                    placeholderText="Any Date"
                    isClearable
                    customInput={<FilterDateInput />}
                    popperPlacement="bottom-start"
                    wrapperClassName="w-full"
                  />
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
                  <input
                    className="input pl-9 pr-8 text-sm"
                    placeholder={tab === 'offers' ? 'Search Shifts...' : 'Search Requests...'}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text/40 hover:text-text min-h-0 min-w-0 p-0.5"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <WallSkeleton tab={tab} />
      ) : tab === 'offers' ? (
        displayShifts.length === 0 ? (
          <EmptyState
            message={hasBoards ? 'No shift offers found' : 'No shifts to see here yet'}
            subtext={!hasBoards
              ? "You'll see your boards' shift posts once a board admin approves you into a board. Haven't joined one yet? Join or create one from your profile."
              : 'Be the first to post a shift!'}
            href={hasBoards ? '/wall/new-shift' : '/profile#my-boards'}
            btnLabel={hasBoards ? 'Post a Shift' : 'Join or Create a Board'}
          />
        ) : filteredShifts.length === 0 ? (
          <div className="text-center py-16 px-4 text-text/50 text-sm">
            {search.trim() ? <>No shifts match &ldquo;{search}&rdquo;.</> : 'No shifts match your filters.'}
          </div>
        ) : (
          <div className="space-y-5">
            {shiftDayGroups.map((group, gi) => (
              <div
                key={group.dayKey}
                className="animate-fade-in-up"
                style={{ animationDelay: `${gi * 60}ms` }}
              >
                <DayGroup
                  dayLabel={group.dayLabel}
                  dateKey={group.dayKey}
                  count={group.items.length}
                  isCollapsed={collapsedKeys.has(`offers|${group.dayKey}`)}
                  onToggle={() => toggleCollapsed('offers', group.dayKey)}
                  onOpenPartyLegend={() => setPartyLegendOpen(true)}
                >
                  {group.items.map((shift, ci) => (
                    <div
                      key={shift.id}
                      className="animate-card-in"
                      style={{ animationDelay: `${Math.min(gi * 60 + ci * 45, 480)}ms` }}
                    >
                      <ShiftCard
                        shift={shift}
                        currentUserId={userId}
                        onDeactivate={handleDeactivateShift}
                        onRemoved={handleShiftRemoved}
                        myClaim={myClaims.get(shift.id)}
                        pendingClaims={pendingByShift.get(shift.id)}
                        claimCount={shift.bundle_id
                          ? bundleClaimCounts.get(shift.bundle_id) ?? 0
                          : claimCounts.get(shift.id) ?? 0}
                        onClaimChanged={handleClaimChanged}
                        bundleSize={shift.bundle_id ? bundlesById.get(shift.bundle_id)?.length : undefined}
                        bundleSiblings={shift.bundle_id
                          ? bundlesById.get(shift.bundle_id)?.map(s => ({
                              id: s.id, shift_title: s.shift_title, start_time: s.start_time,
                            }))
                          : undefined}
                        onFilterBundle={handleFilterBundle}
                      />
                    </div>
                  ))}
                </DayGroup>
              </div>
            ))}
          </div>
        )
      ) : (
        requests.length === 0 ? (
          <EmptyState
            message={hasBoards ? 'No shift requests found' : 'No requests to see here yet'}
            subtext={!hasBoards
              ? "You'll see your boards' shift requests once a board admin approves you into a board. Haven't joined one yet? Join or create one from your profile."
              : 'Need a shift? Post a request!'}
            href={hasBoards ? '/wall/new-request' : '/profile#my-boards'}
            btnLabel={hasBoards ? 'Post a Request' : 'Join or Create a Board'}
          />
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16 px-4 text-text/50 text-sm">
            {search.trim() ? <>No requests match &ldquo;{search}&rdquo;.</> : 'No requests match your filters.'}
          </div>
        ) : (
          <div className="space-y-5">
            {requestDayGroups.map((group, gi) => (
              <div
                key={group.dayKey}
                className="animate-fade-in-up"
                style={{ animationDelay: `${gi * 60}ms` }}
              >
                <DayGroup
                  dayLabel={group.dayLabel}
                  dateKey={group.dayKey}
                  count={group.items.length}
                  isCollapsed={collapsedKeys.has(`requests|${group.dayKey}`)}
                  onToggle={() => toggleCollapsed('requests', group.dayKey)}
                  onOpenPartyLegend={() => setPartyLegendOpen(true)}
                >
                  {group.items.map((request, ci) => (
                    <div
                      key={request.id}
                      className="animate-card-in"
                      style={{ animationDelay: `${Math.min(gi * 60 + ci * 45, 480)}ms` }}
                    >
                      <RequestCard
                        request={request}
                        currentUserId={userId}
                        onDeactivate={handleDeactivateRequest}
                        onFulfilled={handleRequestFulfilled}
                      />
                    </div>
                  ))}
                </DayGroup>
              </div>
            ))}
          </div>
        )
      )}

      <PartyLegendModal open={partyLegendOpen} onClose={() => setPartyLegendOpen(false)} />
    </div>
  )
}

// ── Day-group accordion ────────────────────────────────────────────────────────

function DayGroup({
  dayLabel, dateKey, count, isCollapsed, onToggle, onOpenPartyLegend, children,
}: {
  dayLabel: string
  /** "yyyy-MM-dd" — looked up against the special-event calendar for the
   *  MNSSHP/HHN/MVMCP badges next to the chevron. */
  dateKey: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
  /** Tapping a badge opens the Party Legend instead of toggling the day. */
  onOpenPartyLegend: () => void
  children: React.ReactNode
}) {
  const eventBadges = getSpecialEventBadges(dateKey)
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header — a div playing button (not a real <button>) because the
          badges below need to be a genuine nested <button> of their own, and
          a <button> can't contain one. Space/Enter replicate native activation. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        data-tour="wall-days"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-card hover:bg-primary-light/30 active:bg-primary-light/50 transition-colors duration-150 min-h-0 cursor-pointer"
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="font-accent font-bold text-text text-sm truncate">{dayLabel}</span>
          <span className="text-[11px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full shrink-0 leading-none">
            {count}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {eventBadges.length > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onOpenPartyLegend() }}
              className="flex items-center gap-1 text-sm leading-none min-h-0 min-w-0 p-0.5 -m-0.5 rounded hover:bg-primary-light/60 transition-colors"
              aria-label="Party Legend — what these badges mean"
              title="What do these mean? Tap for the Party Legend"
            >
              {eventBadges.map((b, i) => (
                <span key={i} role="img" aria-label={b.label}>{b.emoji}</span>
              ))}
            </button>
          )}
          <ChevronDown className={cn(
            'w-4 h-4 text-text/40 transition-transform duration-300 ease-spring shrink-0',
            !isCollapsed && 'rotate-180'
          )} />
        </span>
      </div>

      {/* Animated content — grid-rows trick avoids JS height measurement */}
      <div className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-spring',
        isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
      )}>
        <div className="overflow-hidden">
          <div className="max-h-[68rem] overflow-y-auto scrollbar-thin">
            <div className="p-4 space-y-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ message, subtext, href, btnLabel }: {
  message: string; subtext: string; href: string; btnLabel: string
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
        <Inbox className="w-8 h-8 text-primary/50" />
      </div>
      <h3 className="font-accent text-xl font-bold text-text mb-2">{message}</h3>
      <p className="text-text/50 text-sm mb-6">{subtext}</p>
      <Link href={href} className="btn btn-primary gap-1.5">
        <Plus className="w-4 h-4" /> {btnLabel}
      </Link>
    </div>
  )
}
