'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface Property { id: string; name: string }
interface Location { id: string; name: string; property_id: string }
interface Role { id: string; name: string }
interface Proficiency {
  id: string
  property_id: string
  location_id: string
  role_id: string
  property_name: string
  location_name: string
  role_name: string
}

interface ProficiencySelectorProps {
  userId: string
  onUpdate?: () => void
}

export function ProficiencySelector({ userId, onUpdate }: ProficiencySelectorProps) {
  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [proficiencies, setProficiencies] = useState<Proficiency[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedProperty, setSelectedProperty] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  const filteredLocations = locations.filter(l => l.property_id === selectedProperty)

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [propsRes, locsRes, rolesRes, profRes] = await Promise.all([
        (supabase as any).from('properties').select('id, name').order('name'),
        (supabase as any).from('locations').select('id, name, property_id').eq('is_approved', true).order('name'),
        (supabase as any).from('roles').select('id, name').eq('is_approved', true).order('name'),
        (supabase as any).from('user_proficiencies')
          .select(`
            id,
            property_id,
            location_id,
            role_id,
            properties(name),
            locations(name),
            roles(name)
          `)
          .eq('user_id', userId),
      ])
      setProperties(propsRes.data ?? [])
      setLocations(locsRes.data ?? [])
      setRoles(rolesRes.data ?? [])
      setProficiencies(
        (profRes.data ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          property_id: p.property_id as string,
          location_id: p.location_id as string,
          role_id: p.role_id as string,
          property_name: (p.properties as { name: string } | null)?.name ?? '',
          location_name: (p.locations as { name: string } | null)?.name ?? '',
          role_name: (p.roles as { name: string } | null)?.name ?? '',
        }))
      )
    } catch (err) {
      setError('Failed to load proficiency data.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!selectedProperty || !selectedLocation || !selectedRole) {
      setError('Please select property, location, and role.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { error: insertError } = await (supabase as any).from('user_proficiencies').insert({
        user_id: userId,
        property_id: selectedProperty,
        location_id: selectedLocation,
        role_id: selectedRole,
      } as any)
      if (insertError) throw insertError
      setSelectedProperty('')
      setSelectedLocation('')
      setSelectedRole('')
      await loadData()
      onUpdate?.()
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('duplicate')) {
        setError('This proficiency already exists.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add proficiency.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (profId: string) => {
    setSaving(true)
    try {
      await (supabase as any).from('user_proficiencies').delete().eq('id', profId)
      await loadData()
      onUpdate?.()
    } catch {
      setError('Failed to remove proficiency.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text/60 py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading proficiencies...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-text mb-1">My Proficiencies</h3>
        <p className="text-xs text-text/50">Add the locations and roles you can work to filter the board.</p>
      </div>

      {/* Existing proficiencies */}
      {proficiencies.length === 0 ? (
        <p className="text-sm text-text/50 italic">No proficiencies added yet.</p>
      ) : (
        <div className="space-y-2">
          {proficiencies.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 bg-primary-light/50 rounded-md px-3 py-2">
              <div className="text-sm min-w-0">
                <span className="font-medium text-text truncate">{p.property_name}</span>
                <span className="text-text/50 mx-1">&rsaquo;</span>
                <span className="text-text/70 truncate">{p.location_name}</span>
                <span className="text-text/50 mx-1">&bull;</span>
                <span className="text-text/70">{p.role_name}</span>
              </div>
              <button
                onClick={() => handleRemove(p.id)}
                disabled={saving}
                className="text-warning/60 hover:text-warning transition-colors p-1 shrink-0 min-h-0 min-w-0"
                aria-label="Remove proficiency"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-text">Add Proficiency</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-text/60 mb-1">Property</label>
            <select
              className="input text-sm"
              value={selectedProperty}
              onChange={e => { setSelectedProperty(e.target.value); setSelectedLocation('') }}
            >
              <option value="">Select property...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text/60 mb-1">Location</label>
            <select
              className="input text-sm"
              value={selectedLocation}
              onChange={e => setSelectedLocation(e.target.value)}
              disabled={!selectedProperty}
            >
              <option value="">Select location...</option>
              {filteredLocations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text/60 mb-1">Role</label>
            <select
              className="input text-sm"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
            >
              <option value="">Select role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-warning">{error}</p>}
        <Button
          onClick={handleAdd}
          loading={saving}
          size="sm"
          className="gap-1 w-full"
        >
          <Plus className="w-4 h-4" /> Add Proficiency
        </Button>
      </div>
    </div>
  )
}
