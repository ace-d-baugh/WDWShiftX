'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { requestSchema } from '@/lib/validations/shifts'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import type { PreferredTime } from '@/lib/database.types'

const TIME_OPTIONS: { value: PreferredTime; label: string; desc: string }[] = [
  { value: 'morning', label: 'Morning', desc: '6am–12pm' },
  { value: 'afternoon', label: 'Afternoon', desc: '12pm–6pm' },
  { value: 'evening', label: 'Evening', desc: '6pm–12am' },
  { value: 'late', label: 'Late Night', desc: '12am–6am' },
]

interface Property { id: string; name: string }
interface Location { id: string; name: string; property_id: string }
interface Role { id: string; name: string }

interface PostRequestFormProps {
  userId: string
  displayName: string
  onSuccess?: () => void
}

export function PostRequestForm({ userId, displayName, onSuccess }: PostRequestFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [properties, setProperties] = useState<Property[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const [form, setForm] = useState({
    property_id: '',
    location_id: '',
    role_id: '',
    requested_date: '',
    preferred_times: [] as PreferredTime[],
    comments: '',
  })

  const filteredLocations = locations.filter(l => l.property_id === form.property_id)

  useEffect(() => {
    const load = async () => {
      const [propsRes, locsRes, rolesRes] = await Promise.all([
        (supabase as any).from('properties').select('id, name').order('name'),
        (supabase as any).from('locations').select('id, name, property_id').eq('is_approved', true).order('name'),
        (supabase as any).from('roles').select('id, name').eq('is_approved', true).order('name'),
      ])
      setProperties(propsRes.data ?? [])
      setLocations(locsRes.data ?? [])
      setRoles(rolesRes.data ?? [])
      setDataLoading(false)
    }
    load()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'property_id' ? { location_id: '' } : {}),
    }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const toggleTime = (t: PreferredTime) => {
    setForm(prev => ({
      ...prev,
      preferred_times: prev.preferred_times.includes(t)
        ? prev.preferred_times.filter(x => x !== t)
        : [...prev.preferred_times, t],
    }))
    setErrors(prev => ({ ...prev, preferred_times: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    const result = requestSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        const field = err.path[0] as string
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const { error } = await (supabase as any).from('requests').insert({
        created_by: displayName,
        user_id: userId,
        property_id: form.property_id,
        location_id: form.location_id,
        role_id: form.role_id,
        requested_date: form.requested_date,
        preferred_times: form.preferred_times,
        comments: form.comments || null,
        is_active: true,
      } as any as any)
      if (error) throw error
      onSuccess?.()
      router.push('/board')
      router.refresh()
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to post request.')
    } finally {
      setLoading(false)
    }
  }

  if (dataLoading) {
    return <div className="flex items-center justify-center py-12 text-text/50">Loading form...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {serverError && (
        <div className="p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {serverError}
        </div>
      )}

      {/* Property */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Property <span className="text-warning">*</span>
        </label>
        <select name="property_id" className={`input ${errors.property_id ? 'border-warning' : ''}`} value={form.property_id} onChange={handleChange}>
          <option value="">Select property...</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {errors.property_id && <p className="mt-1 text-xs text-warning">{errors.property_id}</p>}
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Location <span className="text-warning">*</span>
        </label>
        <select name="location_id" className={`input ${errors.location_id ? 'border-warning' : ''}`} value={form.location_id} onChange={handleChange} disabled={!form.property_id}>
          <option value="">Select location...</option>
          {filteredLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {errors.location_id && <p className="mt-1 text-xs text-warning">{errors.location_id}</p>}
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Role <span className="text-warning">*</span>
        </label>
        <select name="role_id" className={`input ${errors.role_id ? 'border-warning' : ''}`} value={form.role_id} onChange={handleChange}>
          <option value="">Select role...</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {errors.role_id && <p className="mt-1 text-xs text-warning">{errors.role_id}</p>}
      </div>

      {/* Requested Date */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Date Needed <span className="text-warning">*</span>
        </label>
        <input
          name="requested_date"
          type="date"
          className={`input ${errors.requested_date ? 'border-warning' : ''}`}
          value={form.requested_date}
          onChange={handleChange}
          min={new Date().toISOString().split('T')[0]}
        />
        {errors.requested_date && <p className="mt-1 text-xs text-warning">{errors.requested_date}</p>}
      </div>

      {/* Preferred Times */}
      <div>
        <p className="text-sm font-medium text-text mb-2">
          Preferred Time(s) <span className="text-warning">*</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TIME_OPTIONS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleTime(t.value)}
              className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-colors ${
                form.preferred_times.includes(t.value)
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border text-text/60 hover:border-primary/50'
              }`}
            >
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-xs opacity-70">{t.desc}</span>
            </button>
          ))}
        </div>
        {errors.preferred_times && <p className="mt-1 text-xs text-warning">{errors.preferred_times}</p>}
      </div>

      {/* Comments */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">Comments (optional)</label>
        <textarea
          name="comments"
          className="input h-20 resize-none"
          placeholder="Any additional details..."
          value={form.comments}
          onChange={handleChange}
          maxLength={500}
        />
      </div>

      <Button type="submit" loading={loading} className="w-full gap-2">
        <Plus className="w-4 h-4" /> Post Request
      </Button>
    </form>
  )
}
