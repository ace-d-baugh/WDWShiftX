'use server'

import { getActionSession } from '@/lib/auth/session'

/**
 * Toggle read state on one of the current user's own notification cards.
 * RLS scopes the update to their own recipient row; the column-level grant
 * on notification_recipients means this can never touch anything but
 * read_at/dismissed_at, even if called with a crafted payload.
 */
export async function markNotificationRead(
  notificationId: string,
  read: boolean
): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()
    const { error } = await supabase
      .from('notification_recipients')
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq('notification_id', notificationId)
      .eq('user_id', userId)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Hard-delete one of the current user's own personal notifications. RLS's
 * notifications_delete_own_personal policy is what actually enforces this —
 * it refuses the delete outright for type = 'board_announcement', which is
 * only removable via deleteBoardNotification (sender/Admin only).
 */
export async function deleteNotification(notificationId: string): Promise<{ error?: string }> {
  try {
    const { supabase } = await getActionSession()
    const { error, count } = await supabase
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('id', notificationId)
    if (error) return { error: error.message }
    if (!count) return { error: 'This notification can\'t be deleted here — ask a Mod/Admin to remove it.' }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Dismiss a board announcement for the current user only — the underlying
 * notification and every other recipient's copy are untouched.
 */
export async function dismissBoardNotification(notificationId: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await getActionSession()
    const { error } = await supabase
      .from('notification_recipients')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('notification_id', notificationId)
      .eq('user_id', userId)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
