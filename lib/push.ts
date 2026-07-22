// Browser-side Web Push helpers (Task 16). Server-side sending lives in
// app/actions/notifications.ts.

// Static property access so Next.js inlines the value into the client bundle.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/**
 * Whether push is configured for this deployment at all. When false every
 * push-related UI element stays hidden — set NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * (and VAPID_PRIVATE_KEY server-side) to turn the feature on.
 */
export const PUSH_CONFIGURED = Boolean(VAPID_PUBLIC_KEY)

/** Browser capability check. iOS Safari requires Add to Home Screen first. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Current permission: 'granted' | 'denied' | 'default' (never asked). */
export function getPushPermission(): NotificationPermission {
  return isPushSupported() ? Notification.permission : 'denied'
}

// ── iOS install detection (Task 23) ────────────────────────────────────────────
// iOS 16.4+ delivers web push only to PWAs opened from the Home Screen. In a
// regular Safari tab PushManager is absent, so isPushSupported() is false and
// the standard prompts hide themselves — these helpers let the UI show an
// "Add to Home Screen" walkthrough instead.

/** Any iOS device — including iPadOS 13+, which masquerades as macOS. */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** Running as an installed Home Screen app (standalone display mode)? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (navigator as unknown as { standalone?: boolean }).standalone === true
}

/** iOS browser tab where installing the PWA would unlock push. */
export function needsIosInstallForPush(): boolean {
  return PUSH_CONFIGURED && isIOS() && !isStandalone() && !isPushSupported()
}

/** True when the iOS browser is Safari itself (vs Chrome/Firefox/Edge shells). */
export function isIosSafari(): boolean {
  return isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/.test(navigator.userAgent)
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js')
}

/** The browser's current push subscription for this site, if any. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

/**
 * Full enable flow: register the service worker, request browser permission,
 * subscribe with the VAPID key, and persist the subscription server-side.
 * Returns an error message on failure (permission denied, network, etc.).
 */
export async function subscribeToPush(): Promise<{ error?: string }> {
  if (!PUSH_CONFIGURED) return { error: 'Push notifications are not available yet.' }
  if (!isPushSupported()) {
    return { error: 'This browser does not support push notifications. On iPhone, add WDWShiftX to your Home Screen first.' }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { error: 'Notifications are blocked. Enable them for wdwshiftx.com in your browser settings.' }
    }

    const reg = await getRegistration()
    await navigator.serviceWorker.ready

    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      }))

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })
    if (!res.ok) {
      // Roll back the browser subscription so state can't diverge from the DB
      await subscription.unsubscribe().catch(() => {})
      return { error: 'Could not save your notification settings. Please try again.' }
    }
    return {}
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return { error: 'Could not enable notifications. Please try again.' }
  }
}

/** Disable flow: remove the subscription server-side, then in the browser. */
export async function unsubscribeFromPush(): Promise<{ error?: string }> {
  try {
    const subscription = await getExistingSubscription()
    if (!subscription) return {}

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
    await subscription.unsubscribe()
    return {}
  } catch (err) {
    console.error('[push] unsubscribe failed:', err)
    return { error: 'Could not disable notifications. Please try again.' }
  }
}
