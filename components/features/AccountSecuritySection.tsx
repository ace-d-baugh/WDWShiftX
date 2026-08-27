'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, KeyRound, Link2, Unlink, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter'
import { passwordMeetsRequirements } from '@/lib/validations/auth'
import type { UserIdentity } from '@supabase/supabase-js'

// Providers a user can connect from the profile page once logged in — kept in
// sync with OAuthButtons.tsx's ENABLED map (Facebook omitted: no Meta app yet).
type ConnectableProvider = 'google' | 'linkedin_oidc'

const CONNECTABLE: { id: ConnectableProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'linkedin_oidc', label: 'LinkedIn' },
]

function providerLabel(id: string): string {
  return CONNECTABLE.find(p => p.id === id)?.label ?? id
}

export function AccountSecuritySection() {
  const supabase = createClient()
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null)
  const [loading, setLoading] = useState(true)
  // Supabase doesn't retroactively add an 'email' identity when a password is
  // added to an OAuth-only account, so getUserIdentities() alone can't be
  // trusted to flip the UI right after a successful updateUser({password}).
  // This override makes the switch immediate without waiting on a refetch.
  const [passwordOverride, setPasswordOverride] = useState(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<ConnectableProvider | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  const loadIdentities = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities()
    if (!error) setIdentities(data.identities)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadIdentities() }, [loadIdentities])

  if (loading) return null

  const hasPassword = passwordOverride || (identities?.some(i => i.provider === 'email') ?? false)
  const connectedOAuth = (identities ?? []).filter(i => i.provider !== 'email')
  const connectedIds = new Set(connectedOAuth.map(i => i.provider))
  const connectableOptions = CONNECTABLE.filter(p => !connectedIds.has(p.id))
  const totalIdentities = identities?.length ?? 0

  const resetMessages = () => { setError(null); setSuccess(null) }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    resetMessages()

    if (!passwordMeetsRequirements(password)) {
      setError('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a symbol')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(hasPassword ? 'Password updated.' : 'Password added — you can now log in with your email too.')
      setPasswordOverride(true)
      setPassword('')
      setConfirmPassword('')
      loadIdentities()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setSaving(false)
    }
  }

  const handleConnect = async (provider: ConnectableProvider) => {
    resetMessages()
    setConnectingProvider(provider)
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/profile` },
    })
    if (error) {
      setError(error.message)
      setConnectingProvider(null)
    }
    // On success the browser redirects away to complete the OAuth flow — no cleanup needed
  }

  const handleUnlink = async (identity: UserIdentity) => {
    resetMessages()
    setUnlinkingId(identity.identity_id)
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity)
      if (error) throw error
      setSuccess('Login method removed.')
      loadIdentities()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove login method.')
    } finally {
      setUnlinkingId(null)
    }
  }

  return (
    <div className="card shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-accent font-bold text-text">Account Security</h2>
          <p className="text-xs text-text/50">Login methods for your account</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-warning text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-md bg-success/10 border border-success/20 text-success text-sm">{success}</div>
      )}

      {!hasPassword && (
        <p className="text-xs text-text/50 mb-3">
          You currently sign in with {connectedOAuth.map(i => providerLabel(i.provider)).join(' / ') || 'a connected account'}. Add a password below so you can also log in with your email.
        </p>
      )}

      <form onSubmit={handleSetPassword} className="space-y-3 mb-5">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {hasPassword ? 'New Password' : 'Create Password'}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="input pr-10"
              placeholder={hasPassword ? 'Enter a new password' : 'Create a password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text/40 hover:text-text min-h-0 min-w-0 h-auto w-auto p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrengthMeter password={password} />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Confirm Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="input placeholder:text-text/50"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" loading={saving} className="gap-1.5">
          <KeyRound className="w-4 h-4" /> {hasPassword ? 'Update Password' : 'Add Password'}
        </Button>
      </form>

      <div className="pt-4 border-t border-border">
        <p className="text-sm font-medium text-text mb-2">Connected Accounts</p>
        <div className="space-y-2">
          {connectedOAuth.map(identity => (
            <div key={identity.identity_id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text">{providerLabel(identity.provider)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={unlinkingId === identity.identity_id}
                disabled={totalIdentities <= 1}
                title={totalIdentities <= 1 ? "Can't remove your only login method" : undefined}
                onClick={() => handleUnlink(identity)}
                className="gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </Button>
            </div>
          ))}
          {connectableOptions.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text/70">{p.label}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={connectingProvider === p.id}
                disabled={connectingProvider !== null}
                onClick={() => handleConnect(p.id)}
                className="gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" /> Connect
              </Button>
            </div>
          ))}
          {connectedOAuth.length === 0 && connectableOptions.length === 0 && (
            <p className="text-xs text-text/40">No additional login methods available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
