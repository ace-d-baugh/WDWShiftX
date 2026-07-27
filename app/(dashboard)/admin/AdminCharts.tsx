'use client'

import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PlusCircle, ArrowRightLeft, Repeat, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface PostStats {
  shifts_added: number
  shifts_active: number
  shifts_user_removed: number
  shifts_expired: number
  shifts_covered: number
  shifts_leader_removed: number
  shifts_trade_only: number
  shifts_giveaway_only: number
  shifts_both: number
  requests_total: number
  requests_active: number
  requests_user_removed: number
  requests_expired: number
  requests_leader_removed: number
  requests_fulfilled: number
  matches_total: number
}

interface AdminChartsProps {
  stats: PostStats | null
  boards: { id: string; name: string }[]
}

// Fixed categorical order + color per outcome — same entity always gets the
// same color across every chart (validated for CVD/contrast in light & dark
// via the dataviz skill's palette script; every slice also carries its own
// legend + value label, so identity never depends on color alone).
const ACTIVE = { label: 'Active', color: '#7A3FE0' }
const EXPIRED = { label: 'Timed Out', color: '#D9720F' }
const USER_REMOVED = { label: 'Self-Deleted', color: '#1E8FD1' }
const COVERED = { label: 'Traded/Given Away', color: '#AA8F09' }
const LEADER_REMOVED = { label: 'Removed by Mod', color: '#D14D5C' }
const FULFILLED = { label: 'Fulfilled', color: '#3F9142' }

// Same three colors ShiftCard.tsx already uses for these badges
// (text-info/text-success/text-primary), darkened for chart-mark use.
const TRADE = { label: 'Trade', color: '#1E8FD1' }
const GIVEAWAY = { label: 'Giveaway', color: '#4C9A3A' }
const BOTH = { label: 'Give/Trade', color: '#7A3FE0' }

function OutcomePie({ title, data }: { title: string; data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) {
    return (
      <div className="card">
        <h3 className="font-accent font-bold text-text mb-3">{title}</h3>
        <p className="text-sm text-text/40 italic text-center py-12">No data yet.</p>
      </div>
    )
  }
  return (
    <div className="card">
      <h3 className="font-accent font-bold text-text mb-3">{title}</h3>
      <div className="h-64 text-text/60">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ value, percent }) => `${value} (${Math.round((percent ?? 0) * 100)}%)`}
              labelLine={false}
            >
              {data.map(d => <Cell key={d.label} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--color-card, #fff)', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number | string | readonly (number | string)[] | undefined) => [`${value ?? 0}`, 'Posts']}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => <span className="text-xs" style={{ color: 'currentColor' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatTile({ icon: Icon, color, value, label, sub }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string; value: string; label: string; sub?: string
}) {
  return (
    <div className="card flex flex-col items-center text-center gap-1 py-4">
      <Icon className="w-5 h-5" style={{ color }} />
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="text-xs text-text/50">{label}</p>
      {sub && <p className="text-[11px] text-text/40">{sub}</p>}
    </div>
  )
}

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0

export function AdminCharts({ stats: initialStats, boards }: AdminChartsProps) {
  const supabase = createClient()
  const [boardId, setBoardId] = useState('')
  const [stats, setStats] = useState<PostStats | null>(initialStats)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .rpc('get_post_stats_admin', { p_board_id: boardId || null })
      .single()
      .then(({ data }) => {
        if (!cancelled) { setStats((data as PostStats) ?? null); setLoading(false) }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text/60">Board</span>
          <select
            className="input text-sm h-9 max-w-xs"
            value={boardId}
            onChange={e => setBoardId(e.target.value)}
          >
            <option value="">All Boards</option>
            {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        {loading && <Loader2 className="w-4 h-4 text-text/40 animate-spin" />}
      </div>

      {!stats ? (
        <p className="text-sm text-text/50 italic text-center py-8">Stats unavailable.</p>
      ) : (
        <StatsBody stats={stats} />
      )}
    </div>
  )
}

function StatsBody({ stats: raw }: { stats: PostStats }) {
  // Defensive against a field the RPC didn't actually send this call (e.g. a
  // stale client bundle briefly out of sync with a renamed column right after
  // deploy) — every downstream number should degrade to 0, never to NaN.
  const stats: PostStats = {
    shifts_added: raw.shifts_added ?? 0,
    shifts_active: raw.shifts_active ?? 0,
    shifts_user_removed: raw.shifts_user_removed ?? 0,
    shifts_expired: raw.shifts_expired ?? 0,
    shifts_covered: raw.shifts_covered ?? 0,
    shifts_leader_removed: raw.shifts_leader_removed ?? 0,
    shifts_trade_only: raw.shifts_trade_only ?? 0,
    shifts_giveaway_only: raw.shifts_giveaway_only ?? 0,
    shifts_both: raw.shifts_both ?? 0,
    requests_total: raw.requests_total ?? 0,
    requests_active: raw.requests_active ?? 0,
    requests_user_removed: raw.requests_user_removed ?? 0,
    requests_expired: raw.requests_expired ?? 0,
    requests_leader_removed: raw.requests_leader_removed ?? 0,
    requests_fulfilled: raw.requests_fulfilled ?? 0,
    matches_total: raw.matches_total ?? 0,
  }

  // Every wall-posted shift has exactly one of trade-only/giveaway-only/both
  // true, so these three (already wall-scoped by definition) sum to the full
  // wall-posted count — no separate RPC column needed.
  const shiftsPosted = stats.shifts_trade_only + stats.shifts_giveaway_only + stats.shifts_both
  const shiftsPostedPct = pct(shiftsPosted, stats.shifts_added)
  const tradeSuccessPct = pct(stats.shifts_covered, shiftsPosted)
  const matchesPct = pct(stats.matches_total, stats.requests_total)

  const shiftOutcomeData = [
    { label: ACTIVE.label, value: stats.shifts_active, color: ACTIVE.color },
    { label: EXPIRED.label, value: stats.shifts_expired, color: EXPIRED.color },
    { label: USER_REMOVED.label, value: stats.shifts_user_removed, color: USER_REMOVED.color },
    { label: COVERED.label, value: stats.shifts_covered, color: COVERED.color },
    { label: LEADER_REMOVED.label, value: stats.shifts_leader_removed, color: LEADER_REMOVED.color },
  ].filter(d => d.value > 0)

  const shiftTypeData = [
    { label: TRADE.label, value: stats.shifts_trade_only, color: TRADE.color },
    { label: GIVEAWAY.label, value: stats.shifts_giveaway_only, color: GIVEAWAY.color },
    { label: BOTH.label, value: stats.shifts_both, color: BOTH.color },
  ].filter(d => d.value > 0)

  const requestOutcomeData = [
    { label: ACTIVE.label, value: stats.requests_active, color: ACTIVE.color },
    { label: EXPIRED.label, value: stats.requests_expired, color: EXPIRED.color },
    { label: USER_REMOVED.label, value: stats.requests_user_removed, color: USER_REMOVED.color },
    { label: LEADER_REMOVED.label, value: stats.requests_leader_removed, color: LEADER_REMOVED.color },
    { label: FULFILLED.label, value: stats.requests_fulfilled, color: FULFILLED.color },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* ── Shifts ────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-accent text-lg font-bold text-text">Shifts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile icon={PlusCircle} color={ACTIVE.color} value={stats.shifts_added.toLocaleString()} label="Added to Site" />
          <StatTile
            icon={ArrowRightLeft} color={TRADE.color}
            value={`${shiftsPosted.toLocaleString()} (${shiftsPostedPct}%)`}
            label="Posted to Wall" sub="of all shifts added"
          />
          <StatTile
            icon={Repeat} color={COVERED.color}
            value={`${stats.shifts_covered.toLocaleString()} (${tradeSuccessPct}%)`}
            label="Successfully Traded/Given Away" sub="of shifts posted to Wall"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <OutcomePie title="Posted Shift Outcomes" data={shiftOutcomeData} />
          <OutcomePie title="Posted Shift Types" data={shiftTypeData} />
        </div>
      </section>

      {/* ── Requests ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-accent text-lg font-bold text-text">Requests</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatTile icon={PlusCircle} color={ACTIVE.color} value={stats.requests_total.toLocaleString()} label="Added to Wall" />
          <StatTile
            icon={Repeat} color={FULFILLED.color}
            value={`${stats.matches_total.toLocaleString()} (${matchesPct}%)`}
            label="Matches Made to Existing Shifts" sub="of requests added"
          />
        </div>
        <OutcomePie title="Request Post Outcomes" data={requestOutcomeData} />
      </section>
    </div>
  )
}
