'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { UserBoardsSection, type Membership, type AvailableBoard } from './UserBoardsSection'
import type { GlobalRole } from '@/lib/database.types'

interface EditUser {
  id: string
  display_name: string | null
  email: string
  role: GlobalRole
  is_active: boolean
  created_at: string
}

const roleOptions: GlobalRole[] = ['Guest', 'User', 'Admin']

const roleVariant: Record<GlobalRole, 'guest' | 'user' | 'admin'> = {
  Guest: 'guest', User: 'user', Admin: 'admin',
}

interface UserEditClientProps {
  user: EditUser
  adminId: string
  memberships: Membership[]
  availableBoards: AvailableBoard[]
}

export function UserEditClient({ user, adminId, memberships, availableBoards }: UserEditClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [role, setRole] = useState<GlobalRole>(user.role)
  const [isActive, setIsActive] = useState(user.is_active)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty =
    displayName !== (user.display_name ?? '') ||
    role !== user.role ||
    isActive !== user.is_active

  const handleSave = async () => {
    if (!displayName.trim()) { setError('Display name cannot be empty.'); return }
    setSaving(true)
    setError(null)
    const { error: e } = await supabase
      .from('users')
      .update({ display_name: displayName.trim(), role, is_active: isActive })
      .eq('id', user.id)
    if (e) {
      setError(e.message)
      setSaving(false)
      return
    }
    setSaving(false)
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      router.push('/admin')
    }, 1200)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin"
          className="p-2 rounded-md text-text/50 hover:text-primary hover:bg-primary-light transition-colors min-h-0 min-w-0"
          aria-label="Back to Admin"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-accent text-2xl font-bold text-text">Edit User</h1>
          <p className="text-sm text-text/60">Joined {new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-success text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Saved! Returning to admin...
        </div>
      )}

      <div className="card space-y-5">
        {/* Email — read only */}
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1">Email</label>
          <p className="text-sm text-text/70 font-mono bg-text/5 rounded-md px-3 py-2">{user.email}</p>
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1">Display Name</label>
          <input
            className="input text-sm"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Full name, e.g. Thomas Morrow"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1">Global Role</label>
          <div className="flex items-center gap-3">
            <select
              className="input text-sm flex-1"
              value={role}
              onChange={e => setRole(e.target.value as GlobalRole)}
              disabled={user.id === adminId}
            >
              {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <Badge variant={roleVariant[role]}>{role}</Badge>
          </div>
          {user.id === adminId && (
            <p className="text-xs text-text/40 mt-1 italic">Cannot change your own role.</p>
          )}
        </div>

        {/* User Boards — assign boards and manage per-board membership */}
        <UserBoardsSection
          targetUserId={user.id}
          initialMemberships={memberships}
          initialAvailableBoards={availableBoards}
        />

        {/* Active status */}
        <div>
          <label className="block text-xs font-medium text-text/60 mb-2">Account Status</label>
          <button
            onClick={() => { if (user.id !== adminId) setIsActive(prev => !prev) }}
            disabled={user.id === adminId}
            className={cn(
              'badge text-xs cursor-pointer transition-colors min-h-0 min-w-0',
              isActive ? 'bg-success/20 text-success hover:bg-success/30' : 'bg-warning/20 text-warning hover:bg-warning/30',
              user.id === adminId && 'cursor-default opacity-60'
            )}
          >
            {isActive ? 'Active' : 'Inactive'} — click to toggle
          </button>
        </div>

        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!isDirty || saving}
          className="w-full gap-2"
        >
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </div>
  )
}
