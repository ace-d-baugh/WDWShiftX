'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { HeartHandshake as Handshake, Check, X, Undo2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { finalizeClaim, withdrawClaim } from '@/app/actions/claims'
import { getSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import type { ClaimStatus } from '@/lib/database.types'

interface ClaimRow {
  id: string
  status: ClaimStatus
  created_at: string
  claimant_id: string
  owner_id: string
  shift: { shift_title: string; start_time: string; end_time: string } | null
  claimant_name: string
  owner_name: string
}

const STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted — awaiting confirmation',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  completed: 'Completed ✅',
  fell_through: 'Fell through',
}

const STATUS_COLOR: Record<ClaimStatus, string> = {
  pending: 'bg-info/15 text-info',
  accepted: 'bg-primary/15 text-primary',
  declined: 'bg-text/10 text-text/50',
  withdrawn: 'bg-text/10 text-text/50',
  completed: 'bg-success/15 text-success',
  fell_through: 'bg-warning/15 text-warning',
}

/**
 * Trade Loop (Task 21) — the user's trade record on the Profile page:
 * reliability stats, claims needing action (confirm / withdraw), and history.
 */
export function TradeRecordSection({ userId }: { userId: string }) {
  const supabase = createClient()
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [stats, setStats] = useState({ picked_up: 0, covered: 0, fell_through: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tz, setTz] = useState('America/New_York')

  useEffect(() => { setTz(getSettings().timezone) }, [])

  const load = useCallback(async () => {
    const [claimsRes, statsRes] = await Promise.all([
      supabase
        .from('shift_claims')
        .select(`
          id, status, created_at, claimant_id, owner_id,
          shift:shifts!shift_id(shift_title, start_time, end_time),
          claimant:users!claimant_id(display_name),
          owner:users!owner_id(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.rpc('get_trade_stats_for_users', { p_user_ids: [userId] }),
    ])

    const rows = ((claimsRes.data ?? []) as unknown as Record<string, unknown>[]).map(c => ({
      id: c.id as string,
      status: c.status as ClaimStatus,
      created_at: c.created_at as string,
      claimant_id: c.claimant_id as string,
      owner_id: c.owner_id as string,
      shift: c.shift as ClaimRow['shift'],
      claimant_name: (c.claimant as { display_name: string | null } | null)?.display_name ?? 'A board member',
      owner_name: (c.owner as { display_name: string | null } | null)?.display_name ?? 'A board member',
    }))
    setClaims(rows)

    const s = (statsRes.data ?? [])[0]
    if (s) setStats({ picked_up: s.picked_up, covered: s.covered, fell_through: s.fell_through })
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { load().catch(() => setLoading(false)) }, [load])

  const run = async (key: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(key)
    setError(null)
    const res = await fn()
    setBusy(null)
    if (res.error) setError(res.error)
    else load()
  }

  const shiftLine = (c: ClaimRow) => {
    if (!c.shift) return 'Shift no longer available'
    const day = formatInTimeZone(parseISO(c.shift.start_time), tz, 'EEE, MMM d')
    const start = formatInTimeZone(parseISO(c.shift.start_time), tz, 'h:mm a')
    const end = formatInTimeZone(parseISO(c.shift.end_time), tz, 'h:mm a')
    return `${day} · ${start} → ${end}`
  }

  // Claims the user must act on: accepted trades they own (confirm outcome)
  // and their own pending claims (withdraw).
  const needsAction = claims.filter(c =>
    (c.status === 'accepted' && c.owner_id === userId) ||
    (c.status === 'pending' && c.claimant_id === userId)
  )
  const history = claims.filter(c => !needsAction.includes(c))

  const completedTotal = stats.picked_up + stats.covered

  return (
    <div id="trade-record" className="card shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
          <Handshake className="w-5 h-5 text-success" />
        </div>
        <div className="flex-1">
          <h2 className="font-accent font-bold text-text">Trade Record</h2>
          <p className="text-xs text-text/50">Claims you&apos;ve made and received, and your reliability record</p>
        </div>
      </div>

      {/* Reliability stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-md bg-success/10 px-3 py-2 text-center">
          <p className="text-lg font-bold text-success leading-tight">{completedTotal}</p>
          <p className="text-[11px] text-text/60">Trades completed</p>
        </div>
        <div className="rounded-md bg-primary-light/60 px-3 py-2 text-center">
          <p className="text-lg font-bold text-primary leading-tight">{stats.covered}</p>
          <p className="text-[11px] text-text/60">Shifts covered</p>
        </div>
        <div className={cn('rounded-md px-3 py-2 text-center', stats.fell_through > 0 ? 'bg-warning/10' : 'bg-text/5')}>
          <p className={cn('text-lg font-bold leading-tight', stats.fell_through > 0 ? 'text-warning' : 'text-text/40')}>
            {stats.fell_through}
          </p>
          <p className="text-[11px] text-text/60">Fell through</p>
        </div>
      </div>

      {error && <p className="mb-3 text-xs text-warning">{error}</p>}

      {loading ? (
        <p className="text-sm text-text/40 py-2">Loading…</p>
      ) : claims.length === 0 ? (
        <p className="text-sm text-text/50 py-2">
          No trades yet. Tap <strong>&ldquo;I Can Help&rdquo;</strong> on a post on{' '}
          <Link href="/wall" className="text-primary hover:underline">The Wall</Link> to start your record.
        </p>
      ) : (
        <div className="space-y-4">
          {needsAction.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text/60 uppercase tracking-wide mb-2">Needs your attention</p>
              <ul className="space-y-2">
                {needsAction.map(c => (
                  <li key={c.id} className="rounded-md border border-border px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{c.shift?.shift_title ?? 'Shift'}</p>
                        <p className="text-[11px] text-text/50 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {shiftLine(c)}
                        </p>
                        <p className="text-[11px] text-text/50">
                          {c.owner_id === userId ? <>Claimed by <strong>{c.claimant_name}</strong></> : <>Your claim to <strong>{c.owner_name}</strong></>}
                        </p>
                      </div>
                      {c.status === 'accepted' && c.owner_id === userId ? (
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <p className="text-[11px] text-text/60">Did the trade go through?</p>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => run(`done-${c.id}`, () => finalizeClaim(c.id, true))}
                              disabled={busy !== null}
                              className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-success/90 disabled:opacity-50 min-h-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {busy === `done-${c.id}` ? 'Saving…' : 'Yes, completed'}
                            </button>
                            <button
                              onClick={() => run(`fell-${c.id}`, () => finalizeClaim(c.id, false))}
                              disabled={busy !== null}
                              className="inline-flex items-center gap-1 rounded-md border border-warning/50 px-2.5 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/10 disabled:opacity-50 min-h-0"
                            >
                              <X className="w-3.5 h-3.5" />
                              {busy === `fell-${c.id}` ? 'Saving…' : 'Fell through'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => run(`withdraw-${c.id}`, () => withdrawClaim(c.id))}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 text-xs text-text/50 hover:text-warning transition-colors min-h-0 shrink-0"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          {busy === `withdraw-${c.id}` ? 'Withdrawing…' : 'Withdraw claim'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text/60 uppercase tracking-wide mb-2">History</p>
              <ul className="space-y-1.5">
                {history.map(c => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0', STATUS_COLOR[c.status])}>
                      {STATUS_LABEL[c.status]}
                    </span>
                    <span className="truncate text-text/70">{c.shift?.shift_title ?? 'Shift'}</span>
                    <span className="text-[11px] text-text/40 shrink-0 ml-auto">
                      {c.owner_id === userId ? `with ${c.claimant_name}` : `with ${c.owner_name}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
