'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, MapPin, Briefcase } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

interface PendingLocation {
  id: string
  name: string
  property_id: string
  created_at: string
  properties: { name: string } | null
  users: { display_name: string } | null
}

interface PendingRole {
  id: string
  name: string
  created_at: string
  users: { display_name: string } | null
}

interface ApprovalsClientProps {
  pendingLocations: PendingLocation[]
  pendingRoles: PendingRole[]
  approverId: string
}

export function ApprovalsClient({ pendingLocations, pendingRoles, approverId }: ApprovalsClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [processing, setProcessing] = useState<string | null>(null)
  const [locs, setLocs] = useState(pendingLocations)
  const [roles, setRoles] = useState(pendingRoles)

  const approveLocation = async (id: string) => {
    setProcessing(id)
    await (supabase as any).from('locations').update({
      is_approved: true,
      approved_by_user_id: approverId,
      approved_at: new Date().toISOString(),
    } as any).eq('id', id)
    setLocs(prev => prev.filter(l => l.id !== id))
    setProcessing(null)
  }

  const rejectLocation = async (id: string) => {
    setProcessing(id)
    await (supabase as any).from('locations').delete().eq('id', id)
    setLocs(prev => prev.filter(l => l.id !== id))
    setProcessing(null)
  }

  const approveRole = async (id: string) => {
    setProcessing(id)
    await (supabase as any).from('roles').update({
      is_approved: true,
      approved_by_user_id: approverId,
      approved_at: new Date().toISOString(),
    } as any).eq('id', id)
    setRoles(prev => prev.filter(r => r.id !== id))
    setProcessing(null)
  }

  const rejectRole = async (id: string) => {
    setProcessing(id)
    await (supabase as any).from('roles').delete().eq('id', id)
    setRoles(prev => prev.filter(r => r.id !== id))
    setProcessing(null)
  }

  const totalPending = locs.length + roles.length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text">Approval Queue</h1>
        <p className="text-sm text-text/60">
          {totalPending === 0 ? 'All caught up! No pending approvals.' : `${totalPending} item${totalPending !== 1 ? 's' : ''} awaiting approval`}
        </p>
      </div>

      {/* Pending Locations */}
      <section className="mb-8">
        <h2 className="font-accent text-lg font-bold text-text mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" /> Locations ({locs.length})
        </h2>
        {locs.length === 0 ? (
          <p className="text-sm text-text/50 italic">No pending locations.</p>
        ) : (
          <div className="space-y-3">
            {locs.map(loc => (
              <div key={loc.id} className="card flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-text">{loc.name}</p>
                  <p className="text-xs text-text/50">
                    {loc.properties?.name ?? 'Unknown Property'}
                    {loc.users ? ` · Suggested by ${loc.users.display_name}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={processing === loc.id}
                    onClick={() => approveLocation(loc.id)}
                    className="gap-1 text-success border-success hover:bg-success/10 min-h-0 h-9 px-3"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={processing === loc.id}
                    onClick={() => rejectLocation(loc.id)}
                    className="gap-1 min-h-0 h-9 px-3"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending Roles */}
      <section>
        <h2 className="font-accent text-lg font-bold text-text mb-3 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" /> Roles ({roles.length})
        </h2>
        {roles.length === 0 ? (
          <p className="text-sm text-text/50 italic">No pending roles.</p>
        ) : (
          <div className="space-y-3">
            {roles.map(role => (
              <div key={role.id} className="card flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-text">{role.name}</p>
                  <p className="text-xs text-text/50">
                    {role.users ? `Suggested by ${role.users.display_name}` : 'No suggester info'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    loading={processing === role.id}
                    onClick={() => approveRole(role.id)}
                    className="gap-1 text-success border-success hover:bg-success/10 min-h-0 h-9 px-3"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={processing === role.id}
                    onClick={() => rejectRole(role.id)}
                    className="gap-1 min-h-0 h-9 px-3"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
