'use server'

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActionSession } from '@/lib/auth/session'
import { sendPushNotification } from '@/lib/push-server'
import { boardAnnouncementHtml } from '@/components/email-template'
import { EMAIL_FROM } from '@/lib/email-constants'
import { optionalServerEnv } from '@/lib/env'

/**
 * SECURITY: same posture as app/actions/notifications.ts — every export here
 * is a publicly routable 'use server' action running on the service-role
 * client, so each one must establish who is calling and check their rights
 * before writing or reading anything. Title/body ARE caller-supplied here
 * (an admin/mod composing an announcement), which is the intended exception
 * to "never trust caller content" — it's gated by the role checks below.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'
const resend = new Resend(optionalServerEnv.RESEND_API_KEY ?? '')

const TITLE_MAX = 150
const BODY_MAX = 1000
const NOTIFY_BATCH_SIZE = 8
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

function sanitize(input: string, max: number): string {
  return input.trim().slice(0, max)
}

type Db = ReturnType<typeof createAdminClient>

/** Global Admin may target any board; a Mod/Leader may only target boards they moderate. */
async function checkSendRights(
  db: Db,
  uid: string,
  boardIds: string[]
): Promise<{ error?: string }> {
  const [{ data: userRow }, { data: modRows }] = await Promise.all([
    db.from('users').select('role').eq('id', uid).single(),
    db.from('user_boards').select('board_id')
      .eq('user_id', uid).eq('is_approved', true).in('role', ['Mod', 'Leader']),
  ])
  if (userRow?.role === 'Admin') return {}
  const modBoardIds = new Set((modRows ?? []).map(r => r.board_id as string))
  const unauthorized = boardIds.some(id => !modBoardIds.has(id))
  if (unauthorized) return { error: 'You can only send to boards you moderate.' }
  return {}
}

interface DeliverableMember {
  email: string | null
  notify: boolean
}

/** Push + (pref-gated) email to each member once, batched like sendMatchNotificationsBatched. */
async function deliverToMembers(
  members: Map<string, DeliverableMember>,
  senderName: string,
  boardLabel: string,
  title: string,
  body: string
): Promise<void> {
  const notificationsUrl = `${BASE_URL}/notifications`
  const memberIds = [...members.keys()]
  for (let i = 0; i < memberIds.length; i += NOTIFY_BATCH_SIZE) {
    const batch = memberIds.slice(i, i + NOTIFY_BATCH_SIZE)
    const results = await Promise.allSettled(batch.map(async memberId => {
      const info = members.get(memberId)!
      await sendPushNotification(memberId, title, body, '/notifications')
      if (info.notify && info.email && optionalServerEnv.RESEND_API_KEY) {
        const { error } = await resend.emails.send({
          from: EMAIL_FROM,
          to: info.email,
          subject: title,
          html: boardAnnouncementHtml({ senderName, boardName: boardLabel, title, body, notificationsUrl }),
        })
        if (error) console.error('[deliverToMembers] Resend error:', error)
      }
    }))
    for (const r of results) {
      if (r.status === 'rejected') console.error('[deliverToMembers] delivery failed:', r.reason)
    }
  }
}

/**
 * Send a pinned board-wide announcement to every approved member of one or
 * more boards. One notification row backs the whole send; a member of
 * several targeted boards gets one recipient row per board (so one card per
 * board on their Notifications page) but only one push/email.
 */
export async function sendBoardNotification(opts: {
  boardIds: string[]
  title: string
  body: string
}): Promise<{ error?: string; notificationId?: string }> {
  try {
    const { userId: uid } = await getActionSession()
    const boardIds = [...new Set(opts.boardIds)]
    if (boardIds.length === 0) return { error: 'Select at least one board.' }

    const title = sanitize(opts.title, TITLE_MAX)
    const body = sanitize(opts.body, BODY_MAX)
    if (!title) return { error: 'Title is required.' }
    if (!body) return { error: 'Details are required.' }

    const db = createAdminClient()
    const perm = await checkSendRights(db, uid, boardIds)
    if (perm.error) return { error: perm.error }

    const { data: sender } = await db.from('users').select('display_name').eq('id', uid).single()
    const senderName = sender?.display_name ?? 'A moderator'

    const { data: notification, error: insertErr } = await db
      .from('notifications')
      .insert({
        type: 'board_announcement',
        title,
        body,
        link_url: '/wall',
        actor_user_id: uid,
        pinned_until: new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString(),
      })
      .select('id')
      .single()
    if (insertErr || !notification) return { error: insertErr?.message ?? 'Could not create the announcement.' }

    const { data: boards } = await db.from('boards').select('id, name').in('id', boardIds)
    const boardNameById = new Map((boards ?? []).map(b => [b.id as string, b.name as string]))

    const membersByBoard = await Promise.all(boardIds.map(async boardId => {
      const { data } = await db
        .from('user_boards')
        .select('user_id, users!user_id(email, display_name, notify_via_email)')
        .eq('board_id', boardId)
        .eq('is_approved', true)
      return { boardId, rows: data ?? [] }
    }))

    // The sender always gets their own management card per targeted board —
    // that's their only way to see/edit/delete it later — but is never
    // pushed/emailed about their own announcement.
    const recipientRows: { notification_id: string; board_id: string; user_id: string }[] = []
    const distinctMembers = new Map<string, DeliverableMember>()
    const senderHasRowForBoard = new Set<string>()
    for (const { boardId, rows } of membersByBoard) {
      for (const row of rows) {
        const memberId = row.user_id as string | null
        if (!memberId) continue
        recipientRows.push({ notification_id: notification.id as string, board_id: boardId, user_id: memberId })
        if (memberId === uid) { senderHasRowForBoard.add(boardId); continue }
        if (!distinctMembers.has(memberId)) {
          const u = (row.users as unknown) as { email: string; notify_via_email: boolean } | null
          distinctMembers.set(memberId, { email: u?.email ?? null, notify: u?.notify_via_email ?? false })
        }
      }
    }
    for (const boardId of boardIds) {
      if (!senderHasRowForBoard.has(boardId)) {
        recipientRows.push({ notification_id: notification.id as string, board_id: boardId, user_id: uid })
      }
    }

    if (recipientRows.length > 0) {
      const { error: recipErr } = await db.from('notification_recipients').insert(recipientRows)
      if (recipErr) console.error('[sendBoardNotification] recipient insert failed:', recipErr.message)
    }

    const boardLabel = boardIds.length === 1
      ? (boardNameById.get(boardIds[0]) ?? 'your board')
      : 'your boards'
    await deliverToMembers(distinctMembers, senderName, boardLabel, title, body)

    return { notificationId: notification.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Edit an announcement's title/body. Board targeting is fixed at send time —
 * this only rewrites content. Acts as though it were a brand-new
 * notification: resets every recipient to unread/undismissed, restarts the
 * 14-day pin window, and re-fires push/email to everyone it originally went to.
 */
export async function editBoardNotification(
  notificationId: string,
  opts: { title: string; body: string }
): Promise<{ error?: string }> {
  try {
    const { userId: uid } = await getActionSession()
    const title = sanitize(opts.title, TITLE_MAX)
    const body = sanitize(opts.body, BODY_MAX)
    if (!title) return { error: 'Title is required.' }
    if (!body) return { error: 'Details are required.' }

    const db = createAdminClient()
    const { data: existing, error: fetchErr } = await db
      .from('notifications')
      .select('id, type, actor_user_id')
      .eq('id', notificationId)
      .single()
    if (fetchErr || !existing) return { error: 'Notification not found.' }
    if (existing.type !== 'board_announcement') return { error: 'Only board announcements can be edited.' }

    const { data: userRow } = await db.from('users').select('role, display_name').eq('id', uid).single()
    const isAdmin = userRow?.role === 'Admin'
    if (!isAdmin && existing.actor_user_id !== uid) {
      return { error: 'Only the sender or an Admin can edit this announcement.' }
    }

    const { error: updateErr } = await db
      .from('notifications')
      .update({
        title,
        body,
        updated_at: new Date().toISOString(),
        pinned_until: new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString(),
      })
      .eq('id', notificationId)
    if (updateErr) return { error: updateErr.message }

    const { data: recipients, error: recipErr } = await db
      .from('notification_recipients')
      .update({ read_at: null, dismissed_at: null })
      .eq('notification_id', notificationId)
      .select('user_id, board_id, users!user_id(email, notify_via_email)')
    if (recipErr) {
      console.error('[editBoardNotification] recipient reset failed:', recipErr.message)
      return {}
    }

    const boardIds = [...new Set((recipients ?? []).map(r => r.board_id as string).filter(Boolean))]
    const { data: boards } = boardIds.length
      ? await db.from('boards').select('id, name').in('id', boardIds)
      : { data: [] as { id: string; name: string }[] }
    const boardLabel = boardIds.length === 1
      ? ((boards ?? []).find(b => b.id === boardIds[0])?.name ?? 'your board')
      : 'your boards'

    // Same rule as sendBoardNotification: the sender has their own recipient
    // row (so they see/can manage the card) but is never pushed/emailed
    // about their own announcement.
    const distinctMembers = new Map<string, DeliverableMember>()
    for (const r of (recipients ?? [])) {
      const memberId = r.user_id as string | null
      if (!memberId || memberId === uid || distinctMembers.has(memberId)) continue
      const u = (r.users as unknown) as { email: string; notify_via_email: boolean } | null
      distinctMembers.set(memberId, { email: u?.email ?? null, notify: u?.notify_via_email ?? false })
    }
    const senderName = userRow?.display_name ?? 'A moderator'
    await deliverToMembers(distinctMembers, senderName, boardLabel, title, body)

    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/** Hard-delete a board announcement for every recipient. Sender or Admin only. */
export async function deleteBoardNotification(notificationId: string): Promise<{ error?: string }> {
  try {
    const { userId: uid } = await getActionSession()
    const db = createAdminClient()

    const { data: existing, error: fetchErr } = await db
      .from('notifications')
      .select('id, type, actor_user_id')
      .eq('id', notificationId)
      .single()
    if (fetchErr || !existing) return { error: 'Notification not found.' }
    if (existing.type !== 'board_announcement') return { error: 'Only board announcements can be hard-deleted here.' }

    const { data: userRow } = await db.from('users').select('role').eq('id', uid).single()
    const isAdmin = userRow?.role === 'Admin'
    if (!isAdmin && existing.actor_user_id !== uid) {
      return { error: 'Only the sender or an Admin can delete this announcement.' }
    }

    const { error } = await db.from('notifications').delete().eq('id', notificationId)
    if (error) return { error: error.message }
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
