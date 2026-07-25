'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { PlusCircle, UserX, Clock, ArrowRightLeft } from 'lucide-react'

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
}

interface AdminChartsProps {
  stats: PostStats | null
}

// Fixed categorical order + color per outcome — same entity always gets the
// same color across both charts (validated for CVD/contrast in light & dark
// via the dataviz skill's palette script; every bar also carries its own
// axis + value label, so identity never depends on color alone).
const ACTIVE = { key: 'active', label: 'Active', color: '#7A3FE0' }
const EXPIRED = { key: 'expired', label: 'Timed Out', color: '#D9720F' }
const USER_REMOVED = { key: 'user_removed', label: 'Self-Deleted', color: '#1E8FD1' }
const COVERED = { key: 'covered', label: 'Traded/Given Away', color: '#AA8F09' }
const LEADER_REMOVED = { key: 'leader_removed', label: 'Removed by Mod', color: '#D14D5C' }

// Same three colors ShiftCard.tsx already uses for these badges
// (text-info/text-success/text-primary), darkened for chart-mark use and
// validated for contrast/CVD separation.
const TRADE = { label: 'Trade', color: '#1E8FD1' }
const GIVEAWAY = { label: 'Giveaway', color: '#4C9A3A' }
const BOTH = { label: 'Give/Trade', color: '#7A3FE0' }

function OutcomeChart({ title, data }: { title: string; data: { label: string; value: number; color: string }[] }) {
  return (
    <div className="card">
      <h3 className="font-accent font-bold text-text mb-3">{title}</h3>
      <div className="h-64 text-text/60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: 'currentColor', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
            <Tooltip
              cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
              contentStyle={{ background: 'var(--color-card, #fff)', border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number | string | readonly (number | string)[] | undefined) => [`${value ?? 0}`, 'Posts']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {data.map(d => <Cell key={d.label} fill={d.color} />)}
              <LabelList dataKey="value" position="top" fill="currentColor" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function AdminCharts({ stats }: AdminChartsProps) {
  if (!stats) {
    return <p className="text-sm text-text/50 italic text-center py-8">Stats unavailable.</p>
  }

  // Every wall-posted shift has exactly one of trade-only/giveaway-only/both
  // true, so these three (already wall-scoped by definition) sum to the full
  // wall-posted count — no separate RPC column needed.
  const shiftsPosted = stats.shifts_trade_only + stats.shifts_giveaway_only + stats.shifts_both
  const shiftsPostedPct = stats.shifts_added > 0 ? Math.round((shiftsPosted / stats.shifts_added) * 100) : 0

  const postsAdded = shiftsPosted + stats.requests_total
  const selfDeleted = stats.shifts_user_removed + stats.requests_user_removed
  const timedOut = stats.shifts_expired + stats.requests_expired
  const tradedAway = stats.shifts_covered

  const tiles = [
    { label: 'Posts Added', value: postsAdded, icon: PlusCircle, color: ACTIVE.color },
    { label: 'Self-Deleted', value: selfDeleted, icon: UserX, color: USER_REMOVED.color },
    { label: 'Timed Out', value: timedOut, icon: Clock, color: EXPIRED.color },
    { label: 'Traded / Given Away', value: tradedAway, icon: ArrowRightLeft, color: COVERED.color },
  ]

  const shiftData = [
    { label: ACTIVE.label, value: stats.shifts_active, color: ACTIVE.color },
    { label: EXPIRED.label, value: stats.shifts_expired, color: EXPIRED.color },
    { label: USER_REMOVED.label, value: stats.shifts_user_removed, color: USER_REMOVED.color },
    { label: COVERED.label, value: stats.shifts_covered, color: COVERED.color },
    { label: LEADER_REMOVED.label, value: stats.shifts_leader_removed, color: LEADER_REMOVED.color },
  ]

  const requestData = [
    { label: ACTIVE.label, value: stats.requests_active, color: ACTIVE.color },
    { label: EXPIRED.label, value: stats.requests_expired, color: EXPIRED.color },
    { label: USER_REMOVED.label, value: stats.requests_user_removed, color: USER_REMOVED.color },
    { label: LEADER_REMOVED.label, value: stats.requests_leader_removed, color: LEADER_REMOVED.color },
  ]

  const tradeTypeData = [
    { label: TRADE.label, value: stats.shifts_trade_only, color: TRADE.color },
    { label: GIVEAWAY.label, value: stats.shifts_giveaway_only, color: GIVEAWAY.color },
    { label: BOTH.label, value: stats.shifts_both, color: BOTH.color },
  ]
  const tradeTypeTotal = stats.shifts_trade_only + stats.shifts_giveaway_only + stats.shifts_both

  return (
    <div className="space-y-4">
      {/* Headline tiles — the exact four numbers asked for, at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="card flex flex-col items-center text-center gap-1 py-4">
            <t.icon className="w-5 h-5" style={{ color: t.color }} />
            <p className="text-2xl font-bold text-text">{t.value.toLocaleString()}</p>
            <p className="text-xs text-text/50">{t.label}</p>
          </div>
        ))}
      </div>

      {/* How much of the calendar is personal-only vs. actually posted to the
          Wall — context for the outcome chart below, which only covers the
          posted subset */}
      <div className="card flex items-center justify-center gap-4 sm:gap-8 py-4 text-center">
        <div>
          <p className="text-2xl font-bold text-text">{stats.shifts_added.toLocaleString()}</p>
          <p className="text-xs text-text/50">Shifts Added to Calendar</p>
        </div>
        <div className="text-text/30 text-xl">→</div>
        <div>
          <p className="text-2xl font-bold text-text">
            {shiftsPosted.toLocaleString()}{' '}
            <span className="text-sm font-normal text-text/50">({shiftsPostedPct}%)</span>
          </p>
          <p className="text-xs text-text/50">Posted to the Wall</p>
        </div>
      </div>

      <OutcomeChart title="Shift Post Outcomes" data={shiftData} />
      <OutcomeChart title="Request Post Outcomes" data={requestData} />

      {/* Bonus: what kind of shifts get posted — same Trade/Giveaway/Give-Trade
          colors as the badges on the Wall itself */}
      {tradeTypeTotal > 0 && <OutcomeChart title="Trade vs. Giveaway vs. Both" data={tradeTypeData} />}
    </div>
  )
}
