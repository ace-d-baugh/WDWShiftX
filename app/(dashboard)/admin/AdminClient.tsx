'use client'

import { useState } from 'react'
import { Settings, Building, MapPin, Briefcase, Users, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/database.types'

type AdminTab = 'properties' | 'locations' | 'roles' | 'users'

interface Property { id: string; name: string; created_at: string }
interface Location { id: string; name: string; property_id: string; is_approved: boolean; created_at: string; properties: { name: string } | null }
interface Role { id: string; name: string; is_approved: boolean; created_at: string }
interface UserRow { id: string; display_name: string; email: string; role: UserRole; is_active: boolean; created_at: string }

interface AdminClientProps {
  properties: Property[]
  locations: Location[]
  roles: Role[]
  users: UserRow[]
  adminId: string
}

const roleOptions: UserRole[] = ['cast', 'copro', 'leader', 'admin']
const roleVariant: Record<UserRole, 'cast' | 'copro' | 'leader' | 'admin'> = {
  cast: 'cast', copro: 'copro', leader: 'leader', admin: 'admin'
}

export function AdminClient({ properties: initProps, locations: initLocs, roles: initRoles, users: initUsers, adminId }: AdminClientProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<AdminTab>('properties')
  const [properties, setProperties] = useState(initProps)
  const [locations, setLocations] = useState(initLocs)
  const [roles, setRoles] = useState(initRoles)
  const [users, setUsers] = useState(initUsers)
  const [processing, setProcessing] = useState<string | null>(null)
  const [newPropertyName, setNewPropertyName] = useState('')
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationPropId, setNewLocationPropId] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }

  const addProperty = async () => {
    if (!newPropertyName.trim()) return
    setProcessing('add-prop')
    const { data, error: e } = await (supabase as any).from('properties').insert({ name: newPropertyName.trim() } as any).select().single()
    if (e) { setError(e.message); setProcessing(null); return }
    setProperties(prev => [...prev, data])
    setNewPropertyName('')
    setProcessing(null)
    showSuccess('Property added!')
  }

  const addLocation = async () => {
    if (!newLocationName.trim() || !newLocationPropId) return
    setProcessing('add-loc')
    const { data, error: e } = await (supabase as any).from('locations').insert({ name: newLocationName.trim(), property_id: newLocationPropId, is_approved: true } as any).select('id, name, property_id, is_approved, created_at, properties(name)').single()
    if (e) { setError(e.message); setProcessing(null); return }
    setLocations(prev => [...prev, data as Location])
    setNewLocationName('')
    setProcessing(null)
    showSuccess('Location added!')
  }

  const addRole = async () => {
    if (!newRoleName.trim()) return
    setProcessing('add-role')
    const { data, error: e } = await (supabase as any).from('roles').insert({ name: newRoleName.trim(), is_approved: true } as any).select().single()
    if (e) { setError(e.message); setProcessing(null); return }
    setRoles(prev => [...prev, data])
    setNewRoleName('')
    setProcessing(null)
    showSuccess('Role added!')
  }

  const toggleLocationApproval = async (id: string, current: boolean) => {
    setProcessing(id)
    await (supabase as any).from('locations').update({ is_approved: !current } as any).eq('id', id)
    setLocations(prev => prev.map(l => l.id === id ? { ...l, is_approved: !current } : l))
    setProcessing(null)
  }

  const toggleRoleApproval = async (id: string, current: boolean) => {
    setProcessing(id)
    await (supabase as any).from('roles').update({ is_approved: !current } as any).eq('id', id)
    setRoles(prev => prev.map(r => r.id === id ? { ...r, is_approved: !current } : r))
    setProcessing(null)
  }

  const changeUserRole = async (id: string, newRole: UserRole) => {
    if (id === adminId) return
    setProcessing(id)
    await (supabase as any).from('users').update({ role: newRole } as any).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
    setProcessing(null)
    showSuccess('User role updated!')
  }

  const toggleUserActive = async (id: string, current: boolean) => {
    if (id === adminId) return
    setProcessing(id)
    await (supabase as any).from('users').update({ is_active: !current } as any).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !current } : u))
    setProcessing(null)
  }

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'properties', label: 'Properties', icon: <Building className="w-4 h-4" /> },
    { key: 'locations', label: 'Locations', icon: <MapPin className="w-4 h-4" /> },
    { key: 'roles', label: 'Roles', icon: <Briefcase className="w-4 h-4" /> },
    { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="font-accent text-2xl font-bold text-text flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Admin Panel
        </h1>
        <p className="text-sm text-text/60">Manage properties, locations, roles, and users</p>
      </div>

      {error && <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap min-h-0 min-w-0 transition-colors',
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-text/50 hover:text-text'
            )}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Properties Tab */}
      {tab === 'properties' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="New property name..." value={newPropertyName} onChange={e => setNewPropertyName(e.target.value)} />
            <Button onClick={addProperty} loading={processing === 'add-prop'} size="sm" className="gap-1 shrink-0"><Plus className="w-4 h-4" />Add</Button>
          </div>
          <div className="space-y-2">
            {properties.map(p => (
              <div key={p.id} className="card flex items-center justify-between">
                <span className="font-medium text-text">{p.name}</span>
                <span className="text-xs text-text/40">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations Tab */}
      {tab === 'locations' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <select className="input flex-1 min-w-40" value={newLocationPropId} onChange={e => setNewLocationPropId(e.target.value)}>
              <option value="">Select property...</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="input flex-1" placeholder="New location name..." value={newLocationName} onChange={e => setNewLocationName(e.target.value)} />
            <Button onClick={addLocation} loading={processing === 'add-loc'} size="sm" className="gap-1"><Plus className="w-4 h-4" />Add</Button>
          </div>
          <div className="space-y-2">
            {locations.map(l => (
              <div key={l.id} className="card flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-text truncate">{l.name}</p>
                  <p className="text-xs text-text/50">{l.properties?.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('badge text-xs', l.is_approved ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning')}>
                    {l.is_approved ? 'Approved' : 'Pending'}
                  </span>
                  <button onClick={() => toggleLocationApproval(l.id, l.is_approved)} disabled={processing === l.id}
                    className="text-xs text-text/50 hover:text-primary min-h-0 min-w-0 p-1">
                    {l.is_approved ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="New role name..." value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
            <Button onClick={addRole} loading={processing === 'add-role'} size="sm" className="gap-1 shrink-0"><Plus className="w-4 h-4" />Add</Button>
          </div>
          <div className="space-y-2">
            {roles.map(r => (
              <div key={r.id} className="card flex items-center justify-between gap-4">
                <span className="font-medium text-text">{r.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('badge text-xs', r.is_approved ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning')}>
                    {r.is_approved ? 'Approved' : 'Pending'}
                  </span>
                  <button onClick={() => toggleRoleApproval(r.id, r.is_approved)} disabled={processing === r.id}
                    className="text-xs text-text/50 hover:text-primary min-h-0 min-w-0 p-1">
                    {r.is_approved ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="card flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-text truncate">{u.display_name}</p>
                <p className="text-xs text-text/50 truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="text-xs border border-border rounded px-2 py-1 h-8 bg-white text-text"
                  value={u.role}
                  onChange={e => changeUserRole(u.id, e.target.value as UserRole)}
                  disabled={u.id === adminId || processing === u.id}
                >
                  {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  onClick={() => toggleUserActive(u.id, u.is_active)}
                  disabled={u.id === adminId || processing === u.id}
                  className={cn('badge text-xs cursor-pointer min-h-0 min-w-0',
                    u.is_active ? 'bg-success/20 text-success hover:bg-warning/20 hover:text-warning' : 'bg-warning/20 text-warning hover:bg-success/20 hover:text-success'
                  )}
                >
                  {u.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
