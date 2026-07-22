'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PUSH_CONFIGURED, isPushSupported, getPushPermission, getExistingSubscription, subscribeToPush } from '@/lib/push'

const STORAGE_KEY = 'wdwshiftx-push-prompt-dismissed'

/**
 * One-time nudge on the Wall for users who haven't enabled push yet.
 * Hidden until VAPID keys are configured, in browsers without the Push API,
 * once permission has been granted/denied, or after the user dismisses it —
 * dismissal is remembered per device. Full control stays in Profile → Notifications.
 */
export function PushPromptBanner() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!PUSH_CONFIGURED || !isPushSupported()) return
    if (getPushPermission() !== 'default') return
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch {}
    getExistingSubscription()
      .then(sub => { if (!sub) setVisible(true) })
      .catch(() => {})
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  const enable = async () => {
    setBusy(true)
    setError(null)
    const result = await subscribeToPush()
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    dismiss()
  }

  return (
    <div className="mb-5 p-3.5 rounded-lg bg-info/10 border border-info/20 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Bell className="w-4 h-4 text-info shrink-0" />
        <p className="text-sm text-text/80 flex-1">
          Get notified the moment a shift matches or someone&rsquo;s interested in your post.
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" onClick={enable} loading={busy}>Enable</Button>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-md text-text/40 hover:text-text hover:bg-text/5 transition-colors min-h-0 min-w-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-warning">{error}</p>}
    </div>
  )
}
