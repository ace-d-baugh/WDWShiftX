'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { Plus, RefreshCw, Inbox, Search, SlidersHorizontal, ChevronDown, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deactivateShift, deactivateRequest } from '@/app/actions/posts'
import { PushPromptBanner } from '@/components/features/PushPromptBanner'
import { IosInstallPrompt } from '@/components/features/IosInstallPrompt'
import { ShiftCard, type ShiftData } from '@/components/features/ShiftCard'
import type { MyClaim, PendingClaim, TradeStats } from '@/components/features/ClaimSection'
import { RequestCard, type RequestData } from '@/components/features/RequestCard'
import { WallSkeleton } from '@/components/ui/WallSkeleton'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/utils'

const ET = 'America/New_York'

interface Board { id: string; name: string }

// Shared between the full wall load and the single-row realtime upsert
const SHIFT_SELECT = `
  id, shift_title, created_by, user_id, board_id,
  start_time, end_time, is_trade, is_giveaway, is_overtime_approved,
  details, is_active, expires_at, created_at,
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

interface WallClientProps {
  userId: string
  displayName: string
  boards: Board[]
  hasBoards: boolean
  initialTab?: Tab
  initialDate?: string
  /** Pro/Trial perk: apply realtime updates live. Basic gets a refresh banner. */
  liveWall?: boolean
}

type Tab = 'offers' | 'requests'

export function WallClient({ userId, displayName, boards, hasBoards, initialTab = 'offers', initialDate = '', liveWall = false }: WallClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<Tab>(initialTab)
  const [shifts, setShifts] = useState<ShiftData[]>([])
  const [requests, setRequests] = useState<RequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState(initialDate)
  const [boardFilters, setBoardFilters] = useState<Set<string>>(new Set())
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false)
  const boardDropdownRef = useRef<HTMLDivElement>(null)
  const [myPostsOnly, setMyPostsOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  // Trade Loop (Task 21): claim state for the visible shifts
  const [myClaims, setMyClaims] = useState<Map<string, MyClaim>>(new Map())
  const [pendingByShift, setPendingByShift] = useState<Map<string, PendingClaim[]>>(new Map())
  const [statsByUser, setStatsByUser] = useState<Map<string, TradeStats>>(new Map())
  const [awaitingFinalize, setAwaitingFinalize] = useState(0)
  // Bare pending-claim counts for every visible shift, not just the ones the
  // current user owns — shift_claims RLS only lets a claimant/owner see
  // individual rows, so the "I'll take this (N)" count for a bystander comes
  // from this identity-free aggregate instead.
  const [claimCounts, setClaimCounts] = useState<Map<string, number>>(new Map())

  // Collapsed state for day-group accordions, persisted per user
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())

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

    const [mineRes, pendingRes, acceptedRes, countsRes] = await Promise.all([
      shiftIds.length
        ? supabase
            .from('shift_claims')
            .select('id, shift_id, status')
            .eq('claimant_id', userId)
            .in('shift_id', shiftIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('shift_claims')
        .select('id, shift_id, claimant_id, claimant:users!claimant_id(display_name)')
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
    ])

    // Latest claim per shift (a declined claimant may have claimed again)
    const mine = new Map<string, MyClaim>()
    for (const c of (mineRes.data ?? []) as { id: string; shift_id: string; status: MyClaim['status'] }[]) {
      if (!mine.has(c.shift_id)) mine.set(c.shift_id, { id: c.id, status: c.status })
    }

    // Reliability stats for everyone we'll display: posters + pending claimants
    const pendingRows = (pendingRes.data ?? []) as unknown as {
      id: string; shift_id: string; claimant_id: string
      claimant: { display_name: string | null } | null
    }[]
    const statUserIds = [...new Set([
      ...shiftList.map(s => s.user_id).filter((id): id is string => !!id),
      ...pendingRows.map(c => c.claimant_id),
    ])]
    const stats = new Map<string, TradeStats>()
    if (statUserIds.length) {
      const { data } = await supabase.rpc('get_trade_stats_for_users', { p_user_ids: statUserIds })
      for (const row of data ?? []) {
        stats.set(row.user_id, { picked_up: row.picked_up, covered: row.covered, fell_through: row.fell_through })
      }
    }

    const pending = new Map<string, PendingClaim[]>()
    for (const c of pendingRows) {
      const list = pending.get(c.shift_id) ?? []
      list.push({
        id: c.id,
        claimant_id: c.claimant_id,
        claimant_name: c.claimant?.display_name ?? 'A board member',
        stats: stats.get(c.claimant_id),
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

    setMyClaims(mine)
    setPendingByShift(pending)
    setStatsByUser(stats)
    setAwaitingFinalize(awaiting)
    setClaimCounts(counts)
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

  // Realtime subscriptions. Pro/Trial (liveWall): changes are applied to the
  // list the moment they land. Basic: the same events only raise a "new
  // activity" banner — the refresh is manual, which is the upsell.
  const [newActivity, setNewActivity] = useState(false)

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
          if (!liveWall) { setNewActivity(true); return }
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
          if (!liveWall) { setNewActivity(true); return }
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
  }, [hasBoards, boards, liveWall, supabase, upsertShift, upsertRequest])

  const handleManualRefresh = () => {
    setNewActivity(false)
    loadShifts(true)
    loadRequests(true)
  }

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

  const toggleBoard = (id: string) => {
    setBoardFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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

  const refresh = () => {
    if (tab === 'offers') loadShifts()
    else loadRequests()
  }

  const filteredShifts = useMemo(() => {
    let list = shifts
    if (myPostsOnly)        list = list.filter(s => s.user_id === userId)
    if (boardFilters.size)  list = list.filter(s => s.board_id != null && boardFilters.has(s.board_id))
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
  }, [shifts, search, dateFilter, boardFilters, myPostsOnly, userId])

  const filteredRequests = useMemo(() => {
    let list = requests
    if (myPostsOnly)        list = list.filter(r => r.user_id === userId)
    if (boardFilters.size)  list = list.filter(r => r.board_id != null && boardFilters.has(r.board_id))
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
  }, [requests, search, dateFilter, boardFilters, myPostsOnly, userId])

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

  const currentPostCount = tab === 'offers' ? shifts.length : requests.length

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

      {/* Basic-tier realtime gate: something changed, refresh is manual */}
      {newActivity && (
        <div className="mb-4 p-3 rounded-md bg-info/10 border border-info/20 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-text/80">
            New activity on the Wall —{' '}
            <button onClick={handleManualRefresh} className="text-primary font-medium underline min-h-0 min-w-0">
              refresh to see it
            </button>
          </span>
          <Link href="/upgrade" className="text-xs text-text/50 hover:text-primary min-h-0 min-w-0">
            ⭐ Pro members see new posts instantly
          </Link>
        </div>
      )}

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
      <div className="flex border-b border-border mb-5">
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

      {/* Filters */}
      {currentPostCount > 1 && (
        <>
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary mb-4 min-h-0 min-w-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            <ChevronDown className={cn('w-4 h-4 transition-transform', filtersOpen && 'rotate-180')} />
          </button>

          {filtersOpen && (
            <div className="mb-6 p-4 bg-primary-light/40 rounded-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Board multi-select dropdown */}
                <div ref={boardDropdownRef} className="relative">
                  <label className="block text-xs font-medium text-text/60 mb-1">Board</label>
                  <button
                    type="button"
                    onClick={() => setBoardDropdownOpen(o => !o)}
                    className="input text-sm h-9 w-full flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="truncate text-left">
                      {boardFilters.size === 0
                        ? 'All Boards'
                        : boardFilters.size === 1
                          ? (boards.find(b => boardFilters.has(b.id))?.name ?? '1 Board')
                          : `${boardFilters.size} Boards`}
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

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-text/60 mb-1">Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      className={`input text-sm h-9 pr-8${dateFilter ? ' date-has-value' : ''}`}
                      value={dateFilter}
                      min={formatInTimeZone(new Date(), ET, 'yyyy-MM-dd')}
                      onChange={e => setDateFilter(e.target.value)}
                    />
                    {dateFilter && (
                      <button
                        type="button"
                        onClick={() => setDateFilter('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text/40 hover:text-text min-h-0 min-w-0 p-0.5"
                        aria-label="Clear date"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* My posts only */}
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer min-h-0">
                    <Checkbox
                      checked={myPostsOnly}
                      onChange={e => setMyPostsOnly(e.target.checked)}
                    />
                    <span className="text-sm text-text whitespace-nowrap">My posts only</span>
                  </label>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text/40 pointer-events-none" />
                <input
                  className="input pl-9 pr-8 text-sm"
                  placeholder={tab === 'offers' ? 'Search shifts...' : 'Search requests...'}
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
          )}
        </>
      )}

      {/* Content */}
      {loading ? (
        <WallSkeleton tab={tab} />
      ) : tab === 'offers' ? (
        shifts.length === 0 ? (
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
                  count={group.items.length}
                  isCollapsed={collapsedKeys.has(`offers|${group.dayKey}`)}
                  onToggle={() => toggleCollapsed('offers', group.dayKey)}
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
                        currentUserName={displayName}
                        onDeactivate={handleDeactivateShift}
                        myClaim={myClaims.get(shift.id)}
                        pendingClaims={pendingByShift.get(shift.id)}
                        claimCount={claimCounts.get(shift.id) ?? 0}
                        posterStats={shift.user_id ? statsByUser.get(shift.user_id) : undefined}
                        onClaimChanged={handleClaimChanged}
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
                  count={group.items.length}
                  isCollapsed={collapsedKeys.has(`requests|${group.dayKey}`)}
                  onToggle={() => toggleCollapsed('requests', group.dayKey)}
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
                        currentUserName={displayName}
                        onDeactivate={handleDeactivateRequest}
                      />
                    </div>
                  ))}
                </DayGroup>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── Day-group accordion ────────────────────────────────────────────────────────

function DayGroup({
  dayLabel, count, isCollapsed, onToggle, children,
}: {
  dayLabel: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-card hover:bg-primary-light/30 active:bg-primary-light/50 transition-colors duration-150 min-h-0"
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="font-accent font-bold text-text text-sm truncate">{dayLabel}</span>
          <span className="text-[11px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full shrink-0 leading-none">
            {count}
          </span>
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-text/40 transition-transform duration-300 ease-spring shrink-0',
          !isCollapsed && 'rotate-180'
        )} />
      </button>

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
