'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Bell, Shield, Trash2, Save, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProficiencySelector } from '@/components/features/ProficiencySelector'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { displayNameRegex } from '@/lib/validations/auth'
import type { UserRole } from '@/lib/database.types'

interface UserProfile {
  id: string
  display_name: string
  email: string
  phone_number: string | null
  notify_via_email: boolean
  notify_via_sms: boolean
  role: UserRole
  is_active: boolean
  created_at: string
}

interface ProfileClientProps {
  user: UserProfile | null
  sessionUserId: string
}

export function ProfileClient({ user, sessionUserId }: ProfileClientProps) {
  const supabase = createClient()
  const router = useRouter()

  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? '')
  const [notifyEmail, setNotifyEmail] = useState(user?.notify_via_email ?? false)
  const [notifySms, setNotifySms] = useState(user?.notify_via_sms ?? false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNameError(null)
    setSaveSuccess(false)

    if (!displayNameRegex.test(displayName)) {
      setNameError('Format: "FirstName LastInitial." (e.g., "Matthew B.")')
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await (supabase as any)
        .from('users')
        .update({
          display_name: displayName,
          phone_number: phoneNumber || null,
          notify_via_email: notifyEmail,
          notify_via_sms: notifySms,
        } as any)
        .eq('id', sessionUserId)

      if (updateError) throw updateError
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    setSaving(true)
    try {
      await (supabase as any).from('users').update({ is_active: false } as any).eq('id', sessionUserId)
      await supabase.auth.signOut()
      router.push('/login?reason=deactivated')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate account.')
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-warning text-sm">Failed to load profile. Please try refreshing.</p>
      </div>
    )
  }

  const roleVariant: Record<UserRole, 'cast' | 'copro' | 'leader' | 'admin'> = {
    cast: 'cast', copro: 'copro', leader: 'leader', admin: 'admin'
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-accent text-2xl font-bold text-text">My Profile</h1>
        <p className="text-sm text-text/60">Manage your account settings and proficiencies</p>
      </div>

      {/* Account Info */}
      <div className="card shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-accent font-bold text-text">Account Info</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text/50">{user.email}</span>
              <Badge variant={roleVariant[user.role]} className="text-xs py-0">
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
            {error}
          </div>
        )}
        {saveSuccess && (
          <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Profile saved successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Display Name</label>
            <input
              type="text"
              className={`input ${nameError ? 'border-warning' : ''}`}
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setNameError(null) }}
              placeholder="Matthew B."
            />
            <p className="mt-1 text-xs text-text/40">Format: FirstName LastInitial. (e.g., &ldquo;Matthew B.&rdquo;)</p>
            {nameError && <p className="mt-1 text-xs text-warning">{nameError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Phone Number (optional)</label>
            <input
              type="tel"
              className="input"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="+1 (407) 555-0000"
            />
          </div>

          <Button type="submit" loading={saving} size="sm" className="gap-1.5">
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        </form>
      </div>

      {/* Notifications */}
      <div className="card shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-info/10 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-info" />
          </div>
          <h2 className="font-accent font-bold text-text">Notifications</h2>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 cursor-pointer min-h-0">
            <div>
              <p className="text-sm font-medium text-text">Email Notifications</p>
              <p className="text-xs text-text/50">Receive updates via email</p>
            </div>
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={e => setNotifyEmail(e.target.checked)}
              className="h-4 w-4 min-h-0 min-w-0 text-primary rounded"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer min-h-0">
            <div>
              <p className="text-sm font-medium text-text">SMS Notifications</p>
              <p className="text-xs text-text/50">Receive text message alerts</p>
            </div>
            <input
              type="checkbox"
              checked={notifySms}
              onChange={e => setNotifySms(e.target.checked)}
              className="h-4 w-4 min-h-0 min-w-0 text-primary rounded"
            />
          </label>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <Button onClick={handleSave as unknown as React.MouseEventHandler} loading={saving} size="sm" variant="outline" className="gap-1.5">
            <Save className="w-4 h-4" /> Save Notifications
          </Button>
        </div>
      </div>

      {/* Proficiencies */}
      <div className="card shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-success" />
          </div>
          <div>
            <h2 className="font-accent font-bold text-text">Proficiencies</h2>
            <p className="text-xs text-text/50">Manage your work locations and roles</p>
          </div>
        </div>
        <ProficiencySelector userId={sessionUserId} />
      </div>

      {/* Danger Zone */}
      <div className="card shadow-sm border border-warning/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h2 className="font-accent font-bold text-text">Danger Zone</h2>
            <p className="text-xs text-text/50">Irreversible actions</p>
          </div>
        </div>
        {!deactivateConfirm ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeactivateConfirm(true)}
            className="gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Deactivate Account
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-warning font-medium">
              Are you sure? This will deactivate your account and remove all your posts. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeactivateConfirm(false)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={saving} onClick={handleDeactivate} className="gap-1.5">
                <Trash2 className="w-4 h-4" /> Yes, Deactivate
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
