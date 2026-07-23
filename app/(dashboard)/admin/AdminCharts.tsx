'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { PlusCircle, UserX, Clock, ArrowRightLeft } from 'lucide-react'

export interface PostStats {
  shifts_total: number
  shifts_active: number
  shifts_user_removed: number
  shifts_expired: number
  shifts_covered: number
  shifts_leader_removed: number
  shifts_trade: number
  shifts_giveaway: number
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

  const postsAdded = stats.shifts_total + stats.requests_total
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

  const tradeTotal = stats.shifts_trade + stats.shifts_giveaway

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

      <OutcomeChart title="Shift Post Outcomes" data={shiftData} />
      <OutcomeChart title="Request Post Outcomes" data={requestData} />

      {/* Bonus: what kind of shifts get posted */}
      {tradeTotal > 0 && (
        <div className="card">
          <h3 className="font-accent font-bold text-text mb-3">Trades vs. Giveaways</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-text/10 flex">
              <div
                className="h-full"
                style={{ width: `${(stats.shifts_trade / tradeTotal) * 100}%`, backgroundColor: ACTIVE.color }}
                title={`${stats.shifts_trade} trades`}
              />
              <div
                className="h-full"
                style={{ width: `${(stats.shifts_giveaway / tradeTotal) * 100}%`, backgroundColor: COVERED.color }}
                title={`${stats.shifts_giveaway} giveaways`}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-text/60">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: ACTIVE.color }} />
              Trades — {stats.shifts_trade.toLocaleString()}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COVERED.color }} />
              Giveaways — {stats.shifts_giveaway.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
