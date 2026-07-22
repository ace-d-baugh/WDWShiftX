'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Bell, LayoutDashboard, Trash2, Save, CheckCircle, Settings, Check, Lock } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MyBoardsSection } from '@/components/features/MyBoardsSection'
import { PushNotificationsToggle } from '@/components/features/PushNotificationsToggle'
import { IosInstallPrompt } from '@/components/features/IosInstallPrompt'
import { CalendarSyncSection } from '@/components/features/CalendarSyncSection'
import { TradeRecordSection } from '@/components/features/TradeRecordSection'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { displayNameRegex } from '@/lib/validations/auth'
import { getSettings, saveSettings, type UserSettings, type WeekStart, type DateFormat, type TimeFormat, DEFAULT_SETTINGS } from '@/lib/settings'
import { getStoredTheme, applyTheme, freeThemeFallback, THEMES, isProTheme, type Theme, type ThemeInfo } from '@/lib/theme'
import { upsertPreferences } from '@/lib/preferences'
import type { GlobalRole } from '@/lib/database.types'

interface UserProfile {
  id: string
  display_name: string | null
  email: string
  phone_number: string | null
  notify_via_email: boolean
  notify_via_sms: boolean
  notify_weekly_digest: boolean
  role: GlobalRole
  is_active: boolean
  created_at: string
}

interface ProfileClientProps {
  user: UserProfile | null
  sessionUserId: string
}

// Premium (seasonal/Pro) themes stay locked for everyone — no billing tier
// in this fork to unlock them. Flip to true to unlock them for fun; costs
// nothing since the theme CSS itself is already shipped.
const PREMIUM_THEMES_UNLOCKED = false

// Theme picker grid placement: mobile is 2 columns / 3 rows, desktop (sm+) is
// 3 columns / 2 rows, and each wants a DIFFERENT visual grouping (light
// themes together): mobile = Light,Dark / Nordic,Midnight / Kitty,Cyberpunk;
// desktop = Light,Nordic,Kitty / Dark,Midnight,Cyberpunk. One flat DOM order
// can't satisfy both row-major layouts at once, so every swatch gets an
// explicit grid position per breakpoint instead of relying on source order.
// Partial: the 3 Overlord-only seasonal themes render in their own plain
// (unpositioned) grid, so they never need an entry here.
const THEME_GRID_POSITION: Partial<Record<Theme, string>> = {
  light:     'row-start-1 col-start-1 sm:row-start-1 sm:col-start-1',
  dark:      'row-start-1 col-start-2 sm:row-start-2 sm:col-start-1',
  nordic:    'row-start-2 col-start-1 sm:row-start-1 sm:col-start-2',
  midnight:  'row-start-2 col-start-2 sm:row-start-2 sm:col-start-2',
  kitty:     'row-start-3 col-start-1 sm:row-start-1 sm:col-start-3',
  cyberpunk: 'row-start-3 col-start-2 sm:row-start-2 sm:col-start-3',
}

export function ProfileClient({ user, sessionUserId }: ProfileClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNewOAuthUser = searchParams.get('oauth') === '1'

  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ?? '')
  const [notifyEmail, setNotifyEmail] = useState(user?.notify_via_email ?? false)
  const [notifyDigest, setNotifyDigest] = useState(user?.notify_weekly_digest ?? true)
  const [notifySms] = useState(user?.notify_via_sms ?? false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)

  // Site settings (localStorage)
  const [siteSettings, setSiteSettings] = useState<UserSettings | null>(null)
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => {
    const settings = getSettings()
    setSiteSettings(settings)
    const stored = getStoredTheme()
    // Profile is the enforcement point for premium themes: reverts a locked
    // theme to its free equivalent (Nordic/Kitty → Light, Midnight/Cyberpunk
    // → Dark) if PREMIUM_THEMES_UNLOCKED is off. Persist so the revert sticks
    // and syncs across devices.
    const effective = PREMIUM_THEMES_UNLOCKED ? stored : freeThemeFallback(stored)
    setTheme(effective)
    if (effective !== stored) {
      applyTheme(effective)
      upsertPreferences(sessionUserId, { ...settings, theme: effective })
    }
  }, [sessionUserId])

  const syncToDB = (settings: UserSettings, t: Theme) => {
    upsertPreferences(sessionUserId, { ...settings, theme: t })
  }

  const updateSetting = <K extends keyof UserSettings>(key: K, val: UserSettings[K]) => {
    const next = saveSettings({ [key]: val })
    setSiteSettings(next)
    syncToDB(next, theme)
  }

  const selectTheme = (t: Theme) => {
    if (isProTheme(t) && !PREMIUM_THEMES_UNLOCKED) return
    setTheme(t)
    applyTheme(t)
    syncToDB(siteSettings ?? getSettings(), t)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNameError(null)
    setSaveSuccess(false)

    if (!displayNameRegex.test(displayName)) {
      setNameError('Format: "FirstName [MiddleName] LastInitial." — e.g., "Thomas M." or "Mary Ann M."')
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: displayName,
          phone_number: phoneNumber || null,
          notify_via_email: notifyEmail,
          notify_weekly_digest: notifyDigest,
          notify_via_sms: notifySms,
        })
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
      await supabase.from('users').update({ is_active: false }).eq('id', sessionUserId)
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

  // Global Admin ("Overlord") only — gates the 3 seasonal themes below.
  // Every other role never sees them rendered at all.
  const isOverlord = user?.role === 'Admin'
  const mainThemes = THEMES.filter(t => !t.adminOnly)
  const overlordThemes = THEMES.filter(t => t.adminOnly)

  // Shared swatch/label/lock rendering for both the main grid and the
  // Overlord-only section below. positionClass only matters for the main
  // grid, which needs one to satisfy its breakpoint-aware layout — the
  // Overlord section is a plain grid with natural left-to-right order.
  const renderThemeOption = (t: ThemeInfo, positionClass = '') => {
    const locked = t.pro && !PREMIUM_THEMES_UNLOCKED
    const selected = theme === t.id
    const swatch = (
      <span
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-black/10"
        style={{ backgroundColor: t.preview.bg }}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.preview.accent }} />
        <span className="h-1.5 w-7 rounded-full opacity-70" style={{ backgroundColor: t.preview.text }} />
      </span>
    )
    const labelRow = (
      <span className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-text truncate">{t.label}</span>
        {locked
          ? <Lock className="w-3 h-3 text-text/40 shrink-0" />
          : selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
      </span>
    )
    if (locked) {
      return (
        <div
          key={t.id}
          title={`${t.description} — not available`}
          aria-disabled="true"
          className={`flex flex-col gap-1.5 rounded-lg border border-border p-2 opacity-60 cursor-not-allowed min-h-0 min-w-0 ${positionClass}`}
        >
          {swatch}
          {labelRow}
        </div>
      )
    }
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => selectTheme(t.id)}
        aria-pressed={selected}
        title={t.description}
        className={`flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors min-h-0 min-w-0 ${positionClass} ${
          selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
        }`}
      >
        {swatch}
        {labelRow}
      </button>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-accent text-2xl font-bold text-text">My Profile</h1>
          <p className="text-sm text-text/60">Manage your account settings and boards</p>
        </div>
      </div>

      {isNewOAuthUser && (
        <div className="p-3 rounded-md bg-info/10 border border-info/20 text-info text-sm">
          Welcome! Set a display name below before posting or joining boards.
        </div>
      )}

      {/* Account Info */}
      <div className="card shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-accent font-bold text-text">Account Info</h2>
            <span className="text-xs text-text/50">{user.email}</span>
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
              className={`input placeholder:text-text/50 ${nameError ? 'border-warning' : ''}`}
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setNameError(null) }}
              placeholder="Thomas M."
            />
            <p className="mt-1 text-xs text-text/40">FirstName [MiddleName] LastInitial. &mdash; e.g., &ldquo;Thomas M.&rdquo; or &ldquo;Mary Ann M.&rdquo;</p>
            {nameError && <p className="mt-1 text-xs text-warning">{nameError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Phone Number (optional)</label>
            <input
              type="tel"
              className="input placeholder:text-text/50"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="(407) 555-0000"
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
            <Checkbox
              checked={notifyEmail}
              onChange={e => setNotifyEmail(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer min-h-0">
            <div>
              <p className="text-sm font-medium text-text">Weekly Digest</p>
              <p className="text-xs text-text/50">A Sunday summary of new shifts and requests on your boards</p>
            </div>
            <Checkbox
              checked={notifyDigest}
              onChange={e => setNotifyDigest(e.target.checked)}
            />
          </label>
          {/* SMS toggle — hidden until SMS provider is configured */}
          {/* Applies instantly per device — not part of the Save button below */}
          <PushNotificationsToggle />
          {/* iOS browser tab: toggle hides itself — show install steps instead */}
          <IosInstallPrompt variant="inline" />
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <Button onClick={handleSave as unknown as React.MouseEventHandler} loading={saving} size="sm" variant="outline" className="gap-1.5">
            <Save className="w-4 h-4" /> Save Notifications
          </Button>
        </div>
      </div>

      {/* My Boards */}
      <div id="my-boards" className="card shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <Link href="/boards" className="font-accent font-bold text-text hover:text-primary transition-colors">
              My Boards
            </Link>
            <p className="text-xs text-text/50">Manage your board membership</p>
          </div>
        </div>
        <MyBoardsSection userId={sessionUserId} />
      </div>

      {/* Trade Record — claims made/received + reliability stats (Task 21) */}
      <TradeRecordSection userId={sessionUserId} />

      {/* Calendar Sync — always on */}
      <CalendarSyncSection />

      {/* Site Settings */}
      <div className="card shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-accent font-bold text-text">Site Settings</h2>
            <p className="text-xs text-text/50">Calendar and display preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Theme */}
          <div>
            <p className="text-sm font-medium text-text">Theme</p>
            <p className="text-xs text-text/50 mb-2">Pick how WDWShiftX looks</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {mainThemes.map(t => renderThemeOption(t, THEME_GRID_POSITION[t.id] ?? ''))}
            </div>

            {/* Overlord-only seasonal themes — never rendered for anyone else, Pro or not */}
            {isOverlord && overlordThemes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-text/50 mb-2">Seasonal (Overlord only)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {overlordThemes.map(t => renderThemeOption(t))}
                </div>
              </div>
            )}
          </div>

          {/* Week Start */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">Week Starts On</p>
              <p className="text-xs text-text/50">First day shown in calendar</p>
            </div>
            <select
              value={siteSettings?.weekStart ?? 0}
              onChange={e => updateSetting('weekStart', Number(e.target.value) as WeekStart)}
              className="input text-sm h-9 py-0 w-32 shrink-0"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
              <option value={6}>Saturday</option>
            </select>
          </div>

          {/* Date Format */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">Date Format</p>
              <p className="text-xs text-text/50">How dates are displayed</p>
            </div>
            <select
              value={siteSettings?.dateFormat ?? 'mdy'}
              onChange={e => updateSetting('dateFormat', e.target.value as DateFormat)}
              className="input text-sm h-9 py-0 w-32 shrink-0"
            >
              <option value="mdy">MM/DD/YYYY</option>
              <option value="dmy">DD/MM/YYYY</option>
            </select>
          </div>

          {/* Time Format */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">Time Format</p>
              <p className="text-xs text-text/50">12-hour or 24-hour clock</p>
            </div>
            <select
              value={siteSettings?.timeFormat ?? '12h'}
              onChange={e => updateSetting('timeFormat', e.target.value as TimeFormat)}
              className="input text-sm h-9 py-0 w-32 shrink-0"
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </div>

          {/* Timezone */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">Timezone</p>
              <p className="text-xs text-text/50">Used for shift times across the app</p>
            </div>
            <select
              value={siteSettings?.timezone ?? DEFAULT_SETTINGS.timezone}
              onChange={e => updateSetting('timezone', e.target.value)}
              className="input text-sm h-9 py-0 w-48 shrink-0"
            >
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="America/Anchorage">Alaska (AKT)</option>
              <option value="Pacific/Honolulu">Hawaii (HT)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Paris">Central Europe (CET)</option>
              <option value="Asia/Tokyo">Japan (JST)</option>
              <option value="Australia/Sydney">Sydney (AEST)</option>
            </select>
          </div>
        </div>
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
