import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { env, optionalServerEnv } from '@/lib/env'

// Server-only module. Deliberately NOT a 'use server' file: exporting this
// from one would make it a client-callable action, letting any logged-in
// user push arbitrary notifications to arbitrary users. Import it only from
// server actions / route handlers, which decide who gets notified.

// Service-role client — sending reads other users' subscriptions, which RLS blocks
function adminDb() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Send a web push to every subscribed device of a user. Fire-and-forget:
 * soft-fails (with a log) when VAPID keys aren't configured, and prunes
 * subscriptions the push service reports as gone (404/410 — user cleared
 * site data or revoked permission without unsubscribing).
 */
export async function sendPushNotification(userId: string, title: string, body: string, url: string): Promise<void> {
  try {
    const publicKey = optionalServerEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = optionalServerEnv.VAPID_PRIVATE_KEY
    if (!publicKey || !privateKey || !optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) return

    const db = adminDb()
    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) { console.error('[sendPush] subscription query error:', error.message); return }
    if (!subs || subs.length === 0) return

    webpush.setVapidDetails('mailto:noreply@wdwshiftx.com', publicKey, privateKey)
    const payload = JSON.stringify({ title, body, url })

    await Promise.all(subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          // Notifications are time-sensitive — ask the push service not to
          // defer delivery while the device is in a low-power doze state
          { urgency: 'high' }
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[sendPush] send error:', err)
        }
      }
    }))
  } catch (err) {
    console.error('[sendPush] unexpected error:', err)
  }
}
