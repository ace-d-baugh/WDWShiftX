'use client'

import { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import { Archive, Clock, LayoutGrid, Timer, ShieldCheck, UserX, HeartHandshake as Handshake, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { RemovedReason } from '@/lib/database.types'

const ET = 'America/New_York'

interface ArchivedShift {
  id: string
  shift_title: string
  created_by: string
  start_time: string
  end_time: string
  is_trade: boolean
  is_giveaway: boolean
  is_overtime_approved: boolean
  created_at: string
  removed_reason: RemovedReason | null
  remover: { display_name: string | null } | null
  boards: { name: string } | null
}

interface ArchivedRequest {
  id: string
  created_by: string
  requested_date: string
  preferred_times: string[]
  created_at: string
  removed_reason: RemovedReason | null
  remover: { display_name: string | null } | null
  boards: { name: string } | null
}

interface ArchiveClientProps {
  archivedShifts: ArchivedShift[]
  archivedRequests: ArchivedRequest[]
  counts: {
    shifts: Record<RemovedReason, number>
    requests: Record<RemovedReason, number>
  }
}

type Tab = 'shifts' | 'requests'

const REASON_LABEL: Record<RemovedReason, string> = {
  expired: 'Expired',
  leader_removed: 'Removed by admin',
  user_removed: 'Removed by owner',
  covered: 'Covered',
  fulfilled: 'Fulfilled',
}

const REASON_ICON: Record<RemovedReason, React.ComponentType<{ className?: string }>> = {
  expired: Timer,
  leader_removed: ShieldCheck,
  user_removed: UserX,
  covered: Handshake,
  fulfilled: CheckCircle,
}

const REASON_CLASS: Record<RemovedReason, string> = {
  expired: 'bg-text/10 text-text/60',
  leader_removed: 'bg-warning/20 text-warning',
  user_removed: 'bg-info/20 text-info',
  covered: 'bg-success/20 text-success',
  fulfilled: 'bg-success/20 text-success',
}

function RemovalBadge({ reason, remover, ownerName }: { reason: RemovedReason | null; remover: { display_name: string | null } | null; ownerName: string }) {
  if (!reason) {
    return <span className="badge text-xs bg-text/10 text-text/40">Unknown</span>
  }
  const Icon = REASON_ICON[reason]
  const who = reason === 'leader_removed' ? (remover?.display_name ?? 'an admin') : reason === 'user_removed' ? ownerName : null
  return (
    <span className={cn('badge text-xs gap-1', REASON_CLASS[reason])}>
      <Icon className="w-3 h-3" />
      {who ? `${REASON_LABEL[reason]} (${who})` : REASON_LABEL[reason]}
    </span>
  )
}

type Filter = RemovedReason | 'all'

function FilterBar({ counts, filter, onChange }: { counts: Record<RemovedReason, number>; filter: Filter; onChange: (f: Filter) => void }) {
  const total = counts.expired + counts.leader_removed + counts.user_removed + counts.covered
  const options: { key: Filter; label: string; icon: React.ComponentType<{ className?: string }> | null; count: number; activeClass: string }[] = [
    { key: 'all',            label: 'All',                 icon: null,        count: total,                  activeClass: 'bg-primary text-white' },
    { key: 'expired',        label: 'Expired',              icon: Timer,       count: counts.expired,         activeClass: 'bg-text/70 text-white' },
    { key: 'leader_removed', label: 'Removed by admins',   icon: ShieldCheck, count: counts.leader_removed,  activeClass: 'bg-warning text-white' },
    { key: 'user_removed',   label: 'Removed by owners',    icon: UserX,       count: counts.user_removed,    activeClass: 'bg-info text-white' },
    { key: 'covered',        label: 'Covered',              icon: Handshake,   count: counts.covered,         activeClass: 'bg-success text-white' },
  ]
  return (
    <div className="flex flex-wrap gap-2 mb-4 text-xs">
      {options.map(o => {
        const Icon = o.icon
        const isActive = filter === o.key
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              'badge gap-1 transition-colors cursor-pointer',
              isActive ? o.activeClass : 'bg-text/10 text-text/60 hover:bg-text/20'
            )}
          >
            {Icon && <Icon className="w-3 h-3" />}
            {o.label} ({o.count})
          </button>
        )
      })}
    </div>
  )
}

export function ArchiveClient({ archivedShifts, archivedRequests, counts }: ArchiveClientProps) {
  const [tab, setTab] = useState<Tab>('shifts')
  const [filter, setFilter] = useState<Filter>('all')

  const filteredShifts = filter === 'all' ? archivedShifts : archivedShifts.filter(s => s.removed_reason === filter)
  const filteredRequests = filter === 'all' ? archivedRequests : archivedRequests.filter(r => r.removed_reason === filter)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text flex items-center gap-2">
          <Archive className="w-6 h-6 text-primary" /> Archive
        </h1>
        <p className="text-sm text-text/60">Expired and deactivated posts (last 50 each)</p>
      </div>

      <div className="flex border-b border-border mb-5">
        {(['shifts', 'requests'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px capitalize min-h-0 min-w-0',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-text/50 hover:text-text'
            )}
          >
            {t === 'shifts' ? `Shifts (${archivedShifts.length})` : `Requests (${archivedRequests.length})`}
          </button>
        ))}
      </div>

      <FilterBar counts={tab === 'shifts' ? counts.shifts : counts.requests} filter={filter} onChange={setFilter} />

      {tab === 'shifts' ? (
        filteredShifts.length === 0 ? (
          <p className="text-sm text-text/50 italic text-center py-8">
            {archivedShifts.length === 0 ? 'No archived shifts.' : 'No shifts match this filter.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredShifts.map(s => (
              <div key={s.id} className="card opacity-75">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-text text-sm">{s.shift_title}</p>
                    <p className="text-xs text-text/50">by {s.created_by}</p>
                  </div>
                  <div className="flex gap-1">
                    {s.is_giveaway && <Badge variant="giveaway">Giveaway</Badge>}
                    {s.is_trade && <Badge variant="trade">Trade</Badge>}
                    {s.is_overtime_approved && <Badge variant="ot">OT</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text/60">
                  <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3" />{s.boards?.name ?? '—'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatInTimeZone(parseISO(s.start_time), ET, 'MMM d, h:mm a')}</span>
                  <RemovalBadge reason={s.removed_reason} remover={s.remover} ownerName={s.created_by} />
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filteredRequests.length === 0 ? (
          <p className="text-sm text-text/50 italic text-center py-8">
            {archivedRequests.length === 0 ? 'No archived requests.' : 'No requests match this filter.'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map(r => (
              <div key={r.id} className="card opacity-75">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-text text-sm">Shift Wanted – {r.requested_date}</p>
                    <p className="text-xs text-text/50">by {r.created_by}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.preferred_times.map(t => (
                      <span key={t} className="badge text-xs bg-secondary/30 text-text capitalize">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text/60">
                  <span className="flex items-center gap-1"><LayoutGrid className="w-3 h-3" />{r.boards?.name ?? '—'}</span>
                  <RemovalBadge reason={r.removed_reason} remover={r.remover} ownerName={r.created_by} />
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
