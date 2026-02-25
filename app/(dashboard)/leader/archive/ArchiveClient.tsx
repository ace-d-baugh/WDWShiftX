'use client'

import { useState } from 'react'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import { Archive, Clock, MapPin, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'

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
  properties: { name: string } | null
  locations: { name: string } | null
  roles: { name: string } | null
}

interface ArchivedRequest {
  id: string
  created_by: string
  requested_date: string
  preferred_times: string[]
  created_at: string
  properties: { name: string } | null
  locations: { name: string } | null
  roles: { name: string } | null
}

interface ArchiveClientProps {
  archivedShifts: ArchivedShift[]
  archivedRequests: ArchivedRequest[]
}

type Tab = 'shifts' | 'requests'

export function ArchiveClient({ archivedShifts, archivedRequests }: ArchiveClientProps) {
  const [tab, setTab] = useState<Tab>('shifts')

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

      {tab === 'shifts' ? (
        archivedShifts.length === 0 ? (
          <p className="text-sm text-text/50 italic text-center py-8">No archived shifts.</p>
        ) : (
          <div className="space-y-3">
            {archivedShifts.map(s => (
              <div key={s.id} className="card opacity-75">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-text text-sm">{s.shift_title}</p>
                    <p className="text-xs text-text/50">by {s.created_by}</p>
                  </div>
                  <div className="flex gap-1">
                    {s.is_trade && <Badge variant="trade">Trade</Badge>}
                    {s.is_giveaway && <Badge variant="giveaway">Giveaway</Badge>}
                    {s.is_overtime_approved && <Badge variant="ot">OT</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text/60">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.properties?.name} &rsaquo; {s.locations?.name}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{s.roles?.name}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatInTimeZone(parseISO(s.start_time), ET, 'MMM d, h:mm a')}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        archivedRequests.length === 0 ? (
          <p className="text-sm text-text/50 italic text-center py-8">No archived requests.</p>
        ) : (
          <div className="space-y-3">
            {archivedRequests.map(r => (
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
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text/60">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.properties?.name} &rsaquo; {r.locations?.name}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{r.roles?.name}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
