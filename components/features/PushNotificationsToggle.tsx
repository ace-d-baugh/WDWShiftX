'use client'

import { useEffect, useState } from 'react'
import {
  PUSH_CONFIGURED,
  isPushSupported,
  getPushPermission,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push'

/**
 * "Push Notifications" row for Profile → Notifications. Renders nothing until
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY is set (feature stays hidden pre-launch) or in
 * browsers with no Push API (iOS Safari outside an installed PWA).
 *
 * Enabled state = this browser has an active subscription; the toggle applies
 * per device, unlike the account-wide email pref above it.
 */
export function PushNotificationsToggle() {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!PUSH_CONFIGURED || !isPushSupported()) return
    setSupported(true)
    setBlocked(getPushPermission() === 'denied')
    getExistingSubscription()
      .then(sub => setEnabled(!!sub))
      .catch(() => {})
  }, [])

  if (!PUSH_CONFIGURED || !supported) return null

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = enabled ? await unsubscribeFromPush() : await subscribeToPush()
    if (result.error) {
      setError(result.error)
      setBlocked(getPushPermission() === 'denied')
    } else {
      setEnabled(!enabled)
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text">Push Notifications</p>
          <p className="text-xs text-text/50">Instant alerts on this device, even when the tab is closed</p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || blocked}
          role="switch"
          aria-checked={enabled}
          aria-label="Push notifications"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-50 ${enabled ? 'bg-primary' : 'bg-border'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {blocked && (
        <p className="mt-1 text-xs text-warning">
          Notifications are blocked for wdwshiftx.com — allow them in your browser&rsquo;s site settings, then try again.
        </p>
      )}
      {error && !blocked && <p className="mt-1 text-xs text-warning">{error}</p>}
    </div>
  )
}
