'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatInTimeZone } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/client'
import { shiftSchema } from '@/lib/validations/shifts'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'

const ET = 'America/New_York'

interface Property { id: string; name: string }
interface Location { id: string; name: string; property_id: string }
interface Role { id: string; name: string }

interface PostShiftFormProps {
  userId: string
  displayName: string
  onSuccess?: () => void
}

export function PostShiftForm({ userId, displayName, onSuccess }: PostShiftFormProps) {
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
    shift_title: '',
    property_id: '',
    location_id: '',
    role_id: '',
    start_time: '',
    end_time: '',
    is_trade: false,
    is_giveaway: false,
    is_overtime_approved: false,
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
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'property_id' ? { location_id: '' } : {}),
    }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)

    // Convert local ET datetime strings to UTC ISO strings
    const startUTC = form.start_time ? new Date(form.start_time).toISOString() : ''
    const endUTC = form.end_time ? new Date(form.end_time).toISOString() : ''

    const parseData = {
      ...form,
      start_time: startUTC,
      end_time: endUTC,
    }

    const result = shiftSchema.safeParse(parseData)
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
      const { error } = await (supabase as any).from('shifts').insert({
        created_by: displayName,
        user_id: userId,
        property_id: form.property_id,
        location_id: form.location_id,
        role_id: form.role_id,
        shift_title: form.shift_title,
        start_time: startUTC,
        end_time: endUTC,
        is_trade: form.is_trade,
        is_giveaway: form.is_giveaway,
        is_overtime_approved: form.is_overtime_approved,
        comments: form.comments || null,
        is_active: true,
      } as any as any)
      if (error) throw error
      onSuccess?.()
      router.push('/board')
      router.refresh()
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Failed to post shift.')
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

      {/* Shift Title */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">
          Shift Title <span className="text-warning">*</span>
        </label>
        <input
          name="shift_title"
          type="text"
          className={`input ${errors.shift_title ? 'border-warning' : ''}`}
          placeholder="e.g., Jungle Cruise Operator Morning"
          value={form.shift_title}
          onChange={handleChange}
        />
        {errors.shift_title && <p className="mt-1 text-xs text-warning">{errors.shift_title}</p>}
      </div>

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

      {/* Start / End Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Start Time (ET) <span className="text-warning">*</span>
          </label>
          <input
            name="start_time"
            type="datetime-local"
            className={`input ${errors.start_time ? 'border-warning' : ''}`}
            value={form.start_time}
            onChange={handleChange}
          />
          {errors.start_time && <p className="mt-1 text-xs text-warning">{errors.start_time}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            End Time (ET) <span className="text-warning">*</span>
          </label>
          <input
            name="end_time"
            type="datetime-local"
            className={`input ${errors.end_time ? 'border-warning' : ''}`}
            value={form.end_time}
            onChange={handleChange}
          />
          {errors.end_time && <p className="mt-1 text-xs text-warning">{errors.end_time}</p>}
        </div>
      </div>

      {/* Type checkboxes */}
      <div>
        <p className="text-sm font-medium text-text mb-2">
          Shift Type <span className="text-warning">*</span>
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer min-h-0">
            <input type="checkbox" name="is_trade" checked={form.is_trade} onChange={handleChange} className="h-4 w-4 min-h-0 min-w-0 text-primary" />
            <span className="text-sm text-text">Trade</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer min-h-0">
            <input type="checkbox" name="is_giveaway" checked={form.is_giveaway} onChange={handleChange} className="h-4 w-4 min-h-0 min-w-0 text-primary" />
            <span className="text-sm text-text">Giveaway</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer min-h-0">
            <input type="checkbox" name="is_overtime_approved" checked={form.is_overtime_approved} onChange={handleChange} className="h-4 w-4 min-h-0 min-w-0 text-primary" />
            <span className="text-sm text-text">OT Approved</span>
          </label>
        </div>
        {errors.is_trade && <p className="mt-1 text-xs text-warning">{errors.is_trade}</p>}
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
        <Plus className="w-4 h-4" /> Post Shift
      </Button>
    </form>
  )
}
