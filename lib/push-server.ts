import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { env, optionalServerEnv } from '@/lib/env'
import type { PushCategory, PushMode } from '@/lib/database.types'

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

interface PushPrefs {
  push_mode: PushMode
  push_comments: boolean
  push_messages: boolean
  push_wall_posts: boolean
  push_shift_activity: boolean
}

/**
 * Does this user's notification preference allow a push of this category?
 * 'all' sends everything, 'none' nothing. 'some' honors the per-category
 * switches; 'account' pushes (approvals, promotions, join requests, board
 * announcements) aren't switchable, so they go out in every mode but 'none'.
 */
function allowsPush(prefs: PushPrefs | null, category: PushCategory): boolean {
  if (!prefs) return true // missing row/columns: default is all notifications
  if (prefs.push_mode === 'none') return false
  if (prefs.push_mode === 'all') return true
  switch (category) {
    case 'comments':       return prefs.push_comments
    case 'messages':       return prefs.push_messages
    case 'wall_posts':     return prefs.push_wall_posts
    case 'shift_activity': return prefs.push_shift_activity
    case 'account':        return true
  }
}

/**
 * Send a web push to every subscribed device of a user, if their notification
 * preferences allow that category. Fire-and-forget: soft-fails (with a log)
 * when VAPID keys aren't configured, and prunes subscriptions the push service
 * reports as gone (404/410 — user cleared site data or revoked permission
 * without unsubscribing).
 */
export async function sendPushNotification(
  userId: string,
  category: PushCategory,
  title: string,
  body: string,
  url: string
): Promise<void> {
  try {
    const publicKey = optionalServerEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = optionalServerEnv.VAPID_PRIVATE_KEY
    if (!publicKey || !privateKey || !optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) return

    const db = adminDb()
    const { data: prefs } = await db
      .from('users')
      .select('push_mode, push_comments, push_messages, push_wall_posts, push_shift_activity')
      .eq('id', userId)
      .single()
    if (!allowsPush(prefs as PushPrefs | null, category)) return

    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) { console.error('[sendPush] subscription query error:', error.message); return }
    if (!subs || subs.length === 0) return

    webpush.setVapidDetails('mailto:noreply@wdwshiftx.com', publicKey, privateKey)
    const payload = JSON.stringify({ title, body, url, settingsUrl: '/profile#notifications' })

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
