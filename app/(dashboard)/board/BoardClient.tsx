'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ShiftCard, type ShiftData } from '@/components/features/ShiftCard'
import { RequestCard, type RequestData } from '@/components/features/RequestCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/database.types'

interface Property { id: string; name: string }
interface Location { id: string; name: string; property_id: string }
interface Role { id: string; name: string }

interface BoardClientProps {
  userId: string
  displayName: string
  userRole: UserRole
  properties: Property[]
  locations: Location[]
  roles: Role[]
}

type Tab = 'offers' | 'requests'

export function BoardClient({ userId, displayName, userRole, properties, locations, roles }: BoardClientProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('offers')
  const [shifts, setShifts] = useState<ShiftData[]>([])
  const [requests, setRequests] = useState<RequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProperty, setFilterProperty] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterRole, setFilterRole] = useState('')

  const filteredLocations = locations.filter(l => !filterProperty || l.property_id === filterProperty)

  const loadShifts = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('shifts')
        .select(`
          id, shift_title, created_by, user_id, start_time, end_time,
          is_trade, is_giveaway, is_overtime_approved, comments, is_active, expires_at, created_at,
          properties(name), locations(name), roles(name)
        `)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('start_time', { ascending: true })

      if (filterProperty) query = query.eq('property_id', filterProperty)
      if (filterLocation) query = query.eq('location_id', filterLocation)
      if (filterRole) query = query.eq('role_id', filterRole)

      const { data, error } = await query
      if (error) throw error

      setShifts(
        (data ?? []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          shift_title: s.shift_title as string,
          created_by: s.created_by as string,
          user_id: s.user_id as string | null,
          property_name: (s.properties as { name: string } | null)?.name ?? '',
          location_name: (s.locations as { name: string } | null)?.name ?? '',
          role_name: (s.roles as { name: string } | null)?.name ?? '',
          start_time: s.start_time as string,
          end_time: s.end_time as string,
          is_trade: s.is_trade as boolean,
          is_giveaway: s.is_giveaway as boolean,
          is_overtime_approved: s.is_overtime_approved as boolean,
          comments: s.comments as string | null,
          is_active: s.is_active as boolean,
          expires_at: s.expires_at as string,
          created_at: s.created_at as string,
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [filterProperty, filterLocation, filterRole])

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('requests')
        .select(`
          id, created_by, user_id, preferred_times, requested_date,
          comments, is_active, expires_at, created_at,
          properties(name), locations(name), roles(name)
        `)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('requested_date', { ascending: true })

      if (filterProperty) query = query.eq('property_id', filterProperty)
      if (filterLocation) query = query.eq('location_id', filterLocation)
      if (filterRole) query = query.eq('role_id', filterRole)

      const { data, error } = await query
      if (error) throw error

      setRequests(
        (data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          created_by: r.created_by as string,
          user_id: r.user_id as string | null,
          property_name: (r.properties as { name: string } | null)?.name ?? '',
          location_name: (r.locations as { name: string } | null)?.name ?? '',
          role_name: (r.roles as { name: string } | null)?.name ?? '',
          preferred_times: r.preferred_times as import('@/lib/database.types').PreferredTime[],
          requested_date: r.requested_date as string,
          comments: r.comments as string | null,
          is_active: r.is_active as boolean,
          expires_at: r.expires_at as string,
          created_at: r.created_at as string,
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [filterProperty, filterLocation, filterRole])

  useEffect(() => {
    if (tab === 'offers') loadShifts()
    else loadRequests()
  }, [tab, loadShifts, loadRequests])

  const handleDeactivateShift = async (id: string) => {
    await (supabase as any).from('shifts').update({ is_active: false } as any).eq('id', id).eq('user_id', userId)
    loadShifts()
  }

  const handleDeactivateRequest = async (id: string) => {
    await (supabase as any).from('requests').update({ is_active: false } as any).eq('id', id).eq('user_id', userId)
    loadRequests()
  }

  const refresh = () => {
    if (tab === 'offers') loadShifts()
    else loadRequests()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-accent text-2xl font-bold text-text">Shift Board</h1>
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
          <Link
            href={tab === 'offers' ? '/board/new-shift' : '/board/new-request'}
            className="btn btn-primary gap-1.5 text-sm px-4 py-2 min-h-0 h-10"
          >
            <Plus className="w-4 h-4" />
            {tab === 'offers' ? 'Post Shift' : 'Post Request'}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {(['offers', 'requests'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px capitalize min-h-0 min-w-0',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-text/50 hover:text-text'
            )}
          >
            {t === 'offers' ? 'Shift Offers' : 'Shift Requests'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 bg-primary-light/40 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1">Property</label>
          <select
            className="input text-sm h-9"
            value={filterProperty}
            onChange={e => { setFilterProperty(e.target.value); setFilterLocation('') }}
          >
            <option value="">All Properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1">Location</label>
          <select
            className="input text-sm h-9"
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            disabled={!filterProperty}
          >
            <option value="">All Locations</option>
            {filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1">Role</label>
          <select
            className="input text-sm h-9"
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
          >
            <option value="">All Roles</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : tab === 'offers' ? (
        shifts.length === 0 ? (
          <EmptyState
            message="No shift offers found"
            subtext={filterProperty || filterLocation || filterRole ? 'Try adjusting your filters.' : 'Be the first to post a shift!'}
            href="/board/new-shift"
            btnLabel="Post a Shift"
          />
        ) : (
          <div className="space-y-4">
            {shifts.map(shift => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                currentUserId={userId}
                currentUserName={displayName}
                onDeactivate={handleDeactivateShift}
              />
            ))}
          </div>
        )
      ) : (
        requests.length === 0 ? (
          <EmptyState
            message="No shift requests found"
            subtext={filterProperty || filterLocation || filterRole ? 'Try adjusting your filters.' : 'Need a shift? Post a request!'}
            href="/board/new-request"
            btnLabel="Post a Request"
          />
        ) : (
          <div className="space-y-4">
            {requests.map(request => (
              <RequestCard
                key={request.id}
                request={request}
                currentUserId={userId}
                currentUserName={displayName}
                onDeactivate={handleDeactivateRequest}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function EmptyState({ message, subtext, href, btnLabel }: { message: string; subtext: string; href: string; btnLabel: string }) {
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
