'use server'

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActionSession } from '@/lib/auth/session'
import { EMAIL_FROM } from '@/lib/email-constants'
import { sendPushNotification } from '@/lib/push-server'
import { boardApprovedHtml, claimReceivedHtml, claimResultHtml, interestedHtml, shiftMatchHtml, modPromotedHtml, leaderPromotedHtml, joinRequestPendingHtml } from '@/components/email-template'
import { formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import type { PreferredTime, NotificationType } from '@/lib/database.types'
import { optionalServerEnv } from '@/lib/env'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'

const resend = new Resend(optionalServerEnv.RESEND_API_KEY ?? '')

/**
 * SECURITY: every export in this file is a `'use server'` action, which means
 * it is a publicly routable POST endpoint, not an internal function however it
 * happens to be called. Each one runs on the service-role client and can send
 * mail and push, so each MUST establish who is calling before doing any of
 * that, and MUST derive anything appearing in the message body from the
 * database rather than from the caller's payload. Otherwise anyone with an
 * account can send arbitrary mail from our own verified sending domain.
 *
 * Returns null rather than throwing: these are fire-and-forget, so an
 * unauthenticated call should quietly do nothing instead of surfacing an error.
 */
/**
 * Persist one notification + its single recipient row, right alongside the
 * matching sendPushNotification call so the in-app Notifications page shows
 * the same title/body/link that was pushed. Fire-and-forget: logs and
 * swallows errors, same posture as the push/email calls it sits next to.
 */
async function createNotification(
  db: ReturnType<typeof createAdminClient>,
  opts: {
    type: NotificationType
    userId: string
    title: string
    body: string
    linkUrl: string
    actorUserId?: string | null
  }
): Promise<void> {
  try {
    const { data: notification, error } = await db
      .from('notifications')
      .insert({
        type: opts.type,
        title: opts.title,
        body: opts.body,
        link_url: opts.linkUrl,
        actor_user_id: opts.actorUserId ?? null,
      })
      .select('id')
      .single()
    if (error || !notification) {
      console.error('[createNotification] insert failed:', error?.message)
      return
    }
    const { error: recipientError } = await db
      .from('notification_recipients')
      .insert({ notification_id: notification.id, user_id: opts.userId })
    if (recipientError) {
      console.error('[createNotification] recipient insert failed:', recipientError.message)
    }
  } catch (err) {
    console.error('[createNotification] unexpected error:', err)
  }
}

async function callerId(tag: string): Promise<string | null> {
  try {
    const { userId } = await getActionSession()
    return userId
  } catch {
    console.error(`[${tag}] rejected: unauthenticated caller`)
    return null
  }
}

/**
 * Fire-and-forget: email the post owner when someone marks interest.
 * Called from the client after a successful interest insert.
 * Never throws — errors are logged but never reach the user.
 */
export async function notifyInterest(opts: {
  postId: string
  postType: 'shift' | 'request'
}): Promise<void> {
  try {
    const uid = await callerId('notifyInterest')
    if (!uid) return

    // Guard: fail fast with a clear message if env vars are missing
    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyInterest] SUPABASE_SERVICE_ROLE_KEY is not set — cannot send interest notification')
      return
    }

    const db = createAdminClient()

    // The name shown in the email is the caller's own, read from the database.
    // Never a string they handed us, or it could claim to be anyone.
    const { data: commenter } = await db
      .from('users').select('display_name').eq('id', uid).single()
    const commenterName = commenter?.display_name ?? 'Someone'

    let ownerId: string | null = null
    let ownerEmail: string | null = null
    let ownerWantsEmail = false
    let postTitle = ''

    if (opts.postType === 'shift') {
      const { data, error } = await db
        .from('shifts')
        .select('shift_title, user_id, users!user_id(email, notify_via_email)')
        .eq('id', opts.postId)
        .eq('is_active', true)
        .single()

      if (error) { console.error('[notifyInterest] shift query error:', error.message); return }
      if (!data) { console.error('[notifyInterest] shift not found:', opts.postId); return }

      const owner = (data.users as unknown) as { email: string; notify_via_email: boolean } | null
      if (!owner) { console.error('[notifyInterest] no owner found for shift:', opts.postId); return }

      postTitle = data.shift_title as string
      ownerId = data.user_id as string | null
      ownerEmail = owner.email
      ownerWantsEmail = owner.notify_via_email
    } else {
      const { data, error } = await db
        .from('requests')
        .select('requested_date, user_id, users!user_id(email, notify_via_email)')
        .eq('id', opts.postId)
        .eq('is_active', true)
        .single()

      if (error) { console.error('[notifyInterest] request query error:', error.message); return }
      if (!data) { console.error('[notifyInterest] request not found:', opts.postId); return }

      const owner = (data.users as unknown) as { email: string; notify_via_email: boolean } | null
      if (!owner) { console.error('[notifyInterest] no owner found for request:', opts.postId); return }

      postTitle = `Shift Request — ${data.requested_date as string}`
      ownerId = data.user_id as string | null
      ownerEmail = owner.email
      ownerWantsEmail = owner.notify_via_email
    }

    // Push and email are independent channels: push goes to whatever devices
    // the owner has enabled; notify_via_email only gates the email.
    if (ownerId) {
      const title = `${commenterName} is interested`
      const body = `${commenterName} marked interest in "${postTitle}"`
      await sendPushNotification(ownerId, 'comments', title, body, '/wall')
      await createNotification(db, {
        type: 'interest', userId: ownerId, title, body, linkUrl: '/wall', actorUserId: uid,
      })
    }

    if (!ownerWantsEmail) return
    if (!ownerEmail) { console.error('[notifyInterest] ownerEmail is null after lookup'); return }
    if (!optionalServerEnv.RESEND_API_KEY) {
      console.error('[notifyInterest] RESEND_API_KEY is not set — cannot send interest email')
      return
    }

    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: ownerEmail,
      subject: `${commenterName} is interested in your ${opts.postType === 'shift' ? 'shift' : 'request'}`,
      html: interestedHtml({
        commenterName,
        postTitle,
        postType: opts.postType,
        wallUrl: `${BASE_URL}/wall`,
      }),
    })

    if (sendError) {
      console.error('[notifyInterest] Resend error:', sendError)
    }
  } catch (err) {
    console.error('[notifyInterest] unexpected error:', err)
  }
}

/**
 * Fire-and-forget: push the post owner and everyone else in the comment thread
 * when a new (non-interest) comment lands. Push only — comments never send
 * email, so a chatty thread can't touch the Resend quota. Recipients and the
 * message body are read from the database, and the caller must have their own
 * comment on the post, so this can't be used to blast pushes at a post the
 * caller never engaged with.
 */
export async function notifyComment(opts: {
  postId: string
  postType: 'shift' | 'request'
}): Promise<void> {
  try {
    const uid = await callerId('notifyComment')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyComment] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()

    // The name in the push is the caller's own, read from the DB — never a
    // string they handed us, or it could claim to be anyone.
    const { data: commenter } = await db
      .from('users').select('display_name').eq('id', uid).single()
    const commenterName = commenter?.display_name ?? 'Someone'

    // Every commenter on this post: this builds the thread recipient list AND
    // proves the caller actually commented here — no comment of their own, no
    // notification (anti-abuse, since this is a public server action).
    const { data: threadRows } = await db
      .from('comments')
      .select('user_id')
      .eq('post_type', opts.postType)
      .eq('post_id', opts.postId)
      .eq('is_active', true)

    const commenterIds = new Set(
      (threadRows ?? [])
        .map(r => r.user_id as string | null)
        .filter((id): id is string => !!id)
    )
    if (!commenterIds.has(uid)) {
      console.error(`[notifyComment] rejected: ${uid} has no comment on ${opts.postType} ${opts.postId}`)
      return
    }

    // Post owner + title, read from the post row.
    let ownerId: string | null = null
    let postTitle = ''
    if (opts.postType === 'shift') {
      const { data } = await db
        .from('shifts').select('shift_title, user_id').eq('id', opts.postId).eq('is_active', true).single()
      if (!data) return
      ownerId = data.user_id as string | null
      postTitle = data.shift_title as string
    } else {
      const { data } = await db
        .from('requests').select('requested_date, user_id').eq('id', opts.postId).eq('is_active', true).single()
      if (!data) return
      ownerId = data.user_id as string | null
      postTitle = `Shift Request — ${data.requested_date as string}`
    }

    // The owner plus everyone else in the thread, minus the person who just
    // commented (they don't notify themselves).
    const recipients = new Set<string>(commenterIds)
    if (ownerId) recipients.add(ownerId)
    recipients.delete(uid)
    if (recipients.size === 0) return

    const title = `${commenterName} commented`
    const body = `${commenterName} commented on "${postTitle}"`
    const results = await Promise.allSettled(
      [...recipients].flatMap(rid => [
        sendPushNotification(rid, 'comments', title, body, '/wall'),
        // Message always points at the post owner, not the commenter who
        // triggered this — so a recipient who *is* the owner gets no actor
        // (they can't message themselves).
        createNotification(db, {
          type: 'comment', userId: rid, title, body, linkUrl: '/wall',
          actorUserId: rid === ownerId ? null : ownerId,
        }),
      ])
    )
    for (const r of results) {
      if (r.status === 'rejected') console.error('[notifyComment] push/notify failed:', r.reason)
    }
  } catch (err) {
    console.error('[notifyComment] unexpected error:', err)
  }
}

// Web push lives in lib/push-server.ts (shared with the messaging actions).
// It's imported rather than exported here so it never becomes a
// client-callable action.

// ── Helpers ───────────────────────────────────────────────────────────────────

const ET = 'America/New_York'

function shiftMatchesPreferences(startTimeIso: string, preferences: PreferredTime[]): boolean {
  const hour = parseInt(formatInTimeZone(parseISO(startTimeIso), ET, 'H'))
  return preferences.some(pref => {
    if (pref === 'morning')   return hour >= 6  && hour < 12
    if (pref === 'afternoon') return hour >= 12 && hour < 18
    if (pref === 'evening')   return hour >= 18 && hour < 24
    if (pref === 'late')      return hour >= 0  && hour < 6
    return false
  })
}

function getETDate(isoString: string): string {
  return formatInTimeZone(parseISO(isoString), ET, 'yyyy-MM-dd')
}

function formatDisplayDate(isoDate: string): string {
  // isoDate is yyyy-MM-dd — display as e.g. "Saturday, June 28"
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

interface MatchPayload {
  boardId: string
  shiftId: string
  requestId: string
  shiftTitle: string
  requestTitle: string
  boardName: string
  shiftDate: string
  shiftPosterUserId: string | null
  shiftPosterEmail: string | null
  shiftPosterName: string
  shiftPosterNotify: boolean
  requesterUserId: string | null
  requesterEmail: string | null
  requesterName: string
  requesterNotify: boolean
}

/**
 * Fan out in small parallel batches instead of one recipient at a time.
 *
 * Each call does an insert plus up to two pushes and two emails, so a shift
 * matching 40 requests used to serialise 40 rounds of external I/O. On a busy
 * board that ran past the serverless timeout and the tail of the list silently
 * never got notified -- which also left match_events holding only a prefix,
 * quietly skewing the very metric Phase 5 added.
 *
 * allSettled, not all: one unreachable recipient must not abort the rest.
 */
const NOTIFY_BATCH_SIZE = 8

async function sendMatchNotificationsBatched(payloads: MatchPayload[]): Promise<void> {
  for (let i = 0; i < payloads.length; i += NOTIFY_BATCH_SIZE) {
    const results = await Promise.allSettled(
      payloads.slice(i, i + NOTIFY_BATCH_SIZE).map(p => sendMatchNotifications(p))
    )
    for (const r of results) {
      if (r.status === 'rejected') console.error('[sendMatchNotifications] batch item failed:', r.reason)
    }
  }
}

async function sendMatchNotifications(opts: MatchPayload) {
  const wallUrl = `${BASE_URL}/wall`
  const displayDate = formatDisplayDate(opts.shiftDate)
  const sends: Promise<void>[] = []

  // Record that this match happened at all — previously nothing was ever
  // stored, so admin stats had no way to answer "how many matches were made."
  // Fire-and-forget: a logging failure should never block the notifications
  // below, and the unique index quietly absorbs a re-fired duplicate.
  createAdminClient()
    .from('match_events')
    .insert({
      board_id: opts.boardId,
      shift_id: opts.shiftId,
      request_id: opts.requestId,
      shift_poster_id: opts.shiftPosterUserId,
      requester_id: opts.requesterUserId,
    })
    .then(({ error }) => {
      if (error && error.code !== '23505') console.error('[sendMatchNotifications] match_events insert failed:', error.message)
    })

  // Web push to both parties — independent of the notify_via_email pref
  if (opts.requesterUserId) {
    const title = 'Possible shift match'
    const body = `${opts.shiftPosterName}'s shift "${opts.shiftTitle}" on ${displayDate} may match your request`
    sends.push(sendPushNotification(opts.requesterUserId, 'shift_activity', title, body, '/wall'))
    sends.push(createNotification(createAdminClient(), {
      type: 'shift_match', userId: opts.requesterUserId, title, body, linkUrl: '/wall',
      actorUserId: opts.shiftPosterUserId,
    }))
  }
  if (opts.shiftPosterUserId) {
    const title = 'Possible shift match'
    const body = `${opts.requesterName} is looking for a shift on ${displayDate} — yours may match`
    sends.push(sendPushNotification(opts.shiftPosterUserId, 'shift_activity', title, body, '/wall'))
    sends.push(createNotification(createAdminClient(), {
      type: 'shift_match', userId: opts.shiftPosterUserId, title, body, linkUrl: '/wall',
      actorUserId: opts.requesterUserId,
    }))
  }

  if (opts.requesterNotify && opts.requesterEmail) {
    sends.push(resend.emails.send({
      from: EMAIL_FROM,
      to: opts.requesterEmail,
      subject: `A shift may match your request on ${displayDate}`,
      html: shiftMatchHtml({
        recipientRole: 'requester',
        otherPartyName: opts.shiftPosterName,
        ownPostTitle: opts.requestTitle,
        otherPostTitle: opts.shiftTitle,
        boardName: opts.boardName,
        shiftDate: displayDate,
        wallUrl,
      }),
    }).then(({ error }) => {
      if (error) console.error('[notifyMatch] Resend error (requester):', error)
    }))
  }

  if (opts.shiftPosterNotify && opts.shiftPosterEmail) {
    sends.push(resend.emails.send({
      from: EMAIL_FROM,
      to: opts.shiftPosterEmail,
      subject: `Your shift may match a request on ${displayDate}`,
      html: shiftMatchHtml({
        recipientRole: 'shift-poster',
        otherPartyName: opts.requesterName,
        ownPostTitle: opts.shiftTitle,
        otherPostTitle: opts.requestTitle,
        boardName: opts.boardName,
        shiftDate: displayDate,
        wallUrl,
      }),
    }).then(({ error }) => {
      if (error) console.error('[notifyMatch] Resend error (shift poster):', error)
    }))
  }

  await Promise.all(sends)
}

// ── Wall post broadcast ────────────────────────────────────────────────────────

/**
 * Push every other approved member of a board when a shift offer or request is
 * posted. Recipients' own preferences (push_wall_posts / push_mode) are applied
 * inside sendPushNotification. `excludeIds` skips people who already got a more
 * specific push about the same post (the match notification). Push only, no
 * email and no Notifications-page row, so a busy board can't flood either.
 * The poster is deliberately anonymous in the copy.
 */
async function broadcastWallPost(
  db: ReturnType<typeof createAdminClient>,
  opts: { boardId: string; posterId: string; kind: 'shift offer' | 'shift request'; isoDate: string; excludeIds: Set<string> }
): Promise<void> {
  const { data: members, error } = await db
    .from('user_boards')
    .select('user_id')
    .eq('board_id', opts.boardId)
    .eq('is_approved', true)
  if (error) { console.error('[broadcastWallPost] member query error:', error.message); return }

  const recipients = [...new Set(
    (members ?? [])
      .map(m => m.user_id as string | null)
      .filter((id): id is string => !!id && id !== opts.posterId && !opts.excludeIds.has(id))
  )]
  const title = opts.kind === 'shift offer' ? 'New shift offer on the Wall' : 'New shift request on the Wall'
  const body = `Someone posted a ${opts.kind} for ${formatDisplayDate(opts.isoDate)} on WDWShiftX.com. Tap to see it. Change notification settings in your Profile.`

  for (let i = 0; i < recipients.length; i += NOTIFY_BATCH_SIZE) {
    const results = await Promise.allSettled(
      recipients.slice(i, i + NOTIFY_BATCH_SIZE).map(rid => sendPushNotification(rid, 'wall_posts', title, body, '/wall'))
    )
    for (const r of results) {
      if (r.status === 'rejected') console.error('[broadcastWallPost] push failed:', r.reason)
    }
  }
}

// ── Match notifications ────────────────────────────────────────────────────────

/**
 * Called after a new shift is posted.
 * Finds any active requests on the same board for the same date whose
 * preferred_times overlap the shift's start time, then emails both parties.
 */
export async function notifyShiftPosted(opts: { shiftId: string }): Promise<void> {
  try {
    const uid = await callerId('notifyShiftPosted')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyShiftPosted] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()

    // Everything that reaches a recipient — which board is scanned, the title
    // in the email, who it claims to be from — comes from the shift row, and
    // the caller must own that row. A caller-supplied board id would let
    // anyone blast any board; a caller-supplied title and name would let them
    // write the message.
    const { data: shift } = await db
      .from('shifts')
      .select('board_id, shift_title, start_time, user_id, users!user_id(display_name)')
      .eq('id', opts.shiftId)
      .single()

    if (!shift) { console.error('[notifyShiftPosted] shift not found:', opts.shiftId); return }
    if (shift.user_id !== uid) {
      console.error(`[notifyShiftPosted] rejected: ${uid} does not own shift ${opts.shiftId}`)
      return
    }
    if (!shift.board_id) return // personal-calendar-only shift, never on a Wall

    const boardId = shift.board_id as string
    const startTimeIso = shift.start_time as string
    const shiftTitle = shift.shift_title as string
    const posterUserId = uid
    const posterName =
      (shift.users as unknown as { display_name: string | null } | null)?.display_name ?? 'Someone'

    const shiftDate = getETDate(startTimeIso)

    // Fetch poster's own email + notify pref
    const { data: posterData } = await db
      .from('users')
      .select('email, notify_via_email')
      .eq('id', posterUserId)
      .single()

    // Fetch active requests on the same board for the same date
    const { data: requests, error } = await db
      .from('requests')
      .select('id, request_title, preferred_times, user_id, users!user_id(email, display_name, notify_via_email), boards!board_id(name)')
      .eq('board_id', boardId)
      .eq('requested_date', shiftDate)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .neq('user_id', posterUserId) // don't match your own posts

    if (error) console.error('[notifyShiftPosted] query error:', error.message)

    // Deduplicate by requester user_id — same person may have multiple matching requests
    const seenRequesters = new Set<string>()
    const payloads: MatchPayload[] = []
    for (const req of (requests ?? [])) {
      const requesterId = req.user_id as string | null
      if (!requesterId || seenRequesters.has(requesterId)) continue

      const prefs = req.preferred_times as PreferredTime[]
      if (!shiftMatchesPreferences(startTimeIso, prefs)) continue

      seenRequesters.add(requesterId)
      const requester = (req.users as unknown) as { email: string; display_name: string | null; notify_via_email: boolean } | null
      const board     = (req.boards as unknown) as { name: string } | null

      payloads.push({
        boardId,
        shiftId:           opts.shiftId,
        requestId:         req.id as string,
        shiftTitle,
        requestTitle:      req.request_title as string,
        boardName:         board?.name ?? 'your board',
        shiftDate,
        shiftPosterUserId: posterUserId,
        shiftPosterEmail:  posterData?.email ?? null,
        shiftPosterName:   posterName,
        shiftPosterNotify: posterData?.notify_via_email ?? false,
        requesterUserId:   requesterId,
        requesterEmail:    requester?.email ?? null,
        requesterName:     requester?.display_name ?? 'Someone',
        requesterNotify:   requester?.notify_via_email ?? false,
      })
    }
    await sendMatchNotificationsBatched(payloads)
    await broadcastWallPost(db, {
      boardId, posterId: posterUserId, kind: 'shift offer', isoDate: shiftDate, excludeIds: seenRequesters,
    })
  } catch (err) {
    console.error('[notifyShiftPosted] unexpected error:', err)
  }
}

/**
 * Called after a new request is posted.
 * Finds any active shifts on the same board for the same date whose
 * start time falls within the request's preferred_times, then emails both parties.
 */
export async function notifyRequestPosted(opts: { requestId: string }): Promise<void> {
  try {
    const uid = await callerId('notifyRequestPosted')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyRequestPosted] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()

    // Same rule as notifyShiftPosted: board, date, preferences and title all
    // come from the request row, and the caller must own it.
    const { data: request } = await db
      .from('requests')
      .select('board_id, request_title, requested_date, preferred_times, user_id, users!user_id(display_name)')
      .eq('id', opts.requestId)
      .single()

    if (!request) { console.error('[notifyRequestPosted] request not found:', opts.requestId); return }
    if (request.user_id !== uid) {
      console.error(`[notifyRequestPosted] rejected: ${uid} does not own request ${opts.requestId}`)
      return
    }
    if (!request.board_id) return

    const boardId = request.board_id as string
    const requestedDate = request.requested_date as string
    const preferredTimes = request.preferred_times as PreferredTime[]
    const requestTitle = request.request_title as string
    const requesterUserId = uid
    const requesterName =
      (request.users as unknown as { display_name: string | null } | null)?.display_name ?? 'Someone'

    // Fetch requester's own email + notify pref
    const { data: requesterData } = await db
      .from('users')
      .select('email, notify_via_email')
      .eq('id', requesterUserId)
      .single()

    // Fetch all active shifts on the same board — filter by ET date + time preference in JS
    // (No UTC date range filter: timezone conversion makes UTC ranges fragile;
    //  getETDate() does the correct ET date comparison instead.)
    const { data: shifts, error } = await db
      .from('shifts')
      .select('id, shift_title, start_time, user_id, users!user_id(email, display_name, notify_via_email), boards!board_id(name)')
      .eq('board_id', boardId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .neq('user_id', requesterUserId)

    if (error) console.error('[notifyRequestPosted] query error:', error.message)

    // Deduplicate by shift poster user_id — same person may have multiple matching shifts
    const seenPosters = new Set<string>()
    const payloads: MatchPayload[] = []
    for (const shift of (shifts ?? [])) {
      const posterId = shift.user_id as string | null
      if (!posterId || seenPosters.has(posterId)) continue

      const startIso = shift.start_time as string
      if (getETDate(startIso) !== requestedDate) continue
      if (!shiftMatchesPreferences(startIso, preferredTimes)) continue

      seenPosters.add(posterId)
      const poster = (shift.users as unknown) as { email: string; display_name: string | null; notify_via_email: boolean } | null
      const board  = (shift.boards as unknown) as { name: string } | null

      payloads.push({
        boardId,
        shiftId:           shift.id as string,
        requestId:         opts.requestId,
        shiftTitle:        shift.shift_title as string,
        requestTitle,
        boardName:         board?.name ?? 'your board',
        shiftDate:         requestedDate,
        shiftPosterUserId: posterId,
        shiftPosterEmail:  poster?.email ?? null,
        shiftPosterName:   poster?.display_name ?? 'Someone',
        shiftPosterNotify: poster?.notify_via_email ?? false,
        requesterUserId:   requesterUserId,
        requesterEmail:    requesterData?.email ?? null,
        requesterName,
        requesterNotify:   requesterData?.notify_via_email ?? false,
      })
    }
    await sendMatchNotificationsBatched(payloads)
    await broadcastWallPost(db, {
      boardId, posterId: requesterUserId, kind: 'shift request', isoDate: requestedDate, excludeIds: seenPosters,
    })
  } catch (err) {
    console.error('[notifyRequestPosted] unexpected error:', err)
  }
}

// ── Trade Loop (Task 21) ───────────────────────────────────────────────────────

/**
 * Fire-and-forget: notify the shift owner that someone claimed their shift.
 * Push always; email gated on the owner's notify_via_email pref.
 */
export async function notifyClaimCreated(claimId: string): Promise<void> {
  try {
    const uid = await callerId('notifyClaimCreated')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyClaimCreated] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()
    const { data: claim, error } = await db
      .from('shift_claims')
      .select('owner_id, claimant_id, bundle_id, shifts!shift_id(shift_title), claimant:users!claimant_id(display_name)')
      .eq('id', claimId)
      .single()

    if (error || !claim) { console.error('[notifyClaimCreated] claim lookup failed:', error?.message); return }

    // Only the two parties to a claim may trigger its notifications.
    if (claim.claimant_id !== uid && claim.owner_id !== uid) {
      console.error(`[notifyClaimCreated] rejected: ${uid} is not a party to claim ${claimId}`)
      return
    }

    const anchorTitle  = (claim.shifts as unknown as { shift_title: string } | null)?.shift_title ?? 'your shift'
    const claimantName = (claim.claimant as unknown as { display_name: string | null } | null)?.display_name ?? 'Someone'
    const ownerId      = claim.owner_id as string
    const bundleId     = claim.bundle_id as string | null

    // A bundle claim covers every shift in the set — say so, or the owner sees
    // only the anchor shift's title and misses the scope of what they'd accept.
    let bundleSize = 0
    if (bundleId) {
      const { count } = await db
        .from('shifts')
        .select('id', { count: 'exact', head: true })
        .eq('bundle_id', bundleId)
        .eq('is_active', true)
      bundleSize = count ?? 0
    }
    const shiftTitle = bundleSize > 1
      ? `${anchorTitle} + ${bundleSize - 1} more`
      : anchorTitle

    const ccTitle = bundleSize > 1 ? `${claimantName} wants all ${bundleSize} of your shifts` : `${claimantName} wants your shift`
    const ccBody = bundleSize > 1
      ? `${claimantName} tapped "I Can Help" on your ${bundleSize}-shift bundle — accept or decline on the Wall`
      : `${claimantName} tapped "I Can Help" on "${anchorTitle}" — accept or decline on the Wall`
    await sendPushNotification(ownerId, 'shift_activity', ccTitle, ccBody, '/wall')
    await createNotification(db, {
      type: 'claim_created', userId: ownerId, title: ccTitle, body: ccBody, linkUrl: '/wall',
      actorUserId: claim.claimant_id as string,
    })

    const { data: owner } = await db
      .from('users')
      .select('email, notify_via_email')
      .eq('id', ownerId)
      .single()

    if (!owner?.notify_via_email || !owner.email) return
    if (!optionalServerEnv.RESEND_API_KEY) return

    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: owner.email,
      subject: `${claimantName} wants to take your shift`,
      html: claimReceivedHtml({ claimantName, shiftTitle, wallUrl: `${BASE_URL}/wall` }),
    })
    if (sendError) console.error('[notifyClaimCreated] Resend error:', sendError)
  } catch (err) {
    console.error('[notifyClaimCreated] unexpected error:', err)
  }
}

/**
 * Fire-and-forget: tell the claimant their claim was accepted or declined,
 * and (on accept) tell auto-declined rival claimants the shift was covered.
 */
export async function notifyClaimResolved(
  claimId: string,
  accepted: boolean
): Promise<void> {
  try {
    const uid = await callerId('notifyClaimResolved')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyClaimResolved] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()
    const { data: claim, error } = await db
      .from('shift_claims')
      .select('claimant_id, owner_id, shift_id, bundle_id, shifts!shift_id(shift_title), owner:users!owner_id(display_name)')
      .eq('id', claimId)
      .single()

    if (error || !claim) { console.error('[notifyClaimResolved] claim lookup failed:', error?.message); return }

    // Accepting or declining is the owner's act, so only the owner may
    // announce it.
    if (claim.owner_id !== uid) {
      console.error(`[notifyClaimResolved] rejected: ${uid} does not own claim ${claimId}`)
      return
    }

    const shiftTitle = (claim.shifts as unknown as { shift_title: string } | null)?.shift_title ?? 'the shift'
    const ownerName  = (claim.owner as unknown as { display_name: string | null } | null)?.display_name ?? 'The owner'
    const claimantId = claim.claimant_id as string

    // Who else was auto-declined is read from the claims table, not handed to
    // us — otherwise the recipient list is caller-controlled, which is how you
    // turn "tell the losers" into "push anything to anyone".
    let rivalClaimantIds: string[] = []
    if (accepted) {
      const rivalQuery = db
        .from('shift_claims')
        .select('claimant_id')
        .eq('status', 'declined')
        .neq('id', claimId)
      const { data: rivals } = claim.bundle_id
        ? await rivalQuery.eq('bundle_id', claim.bundle_id as string)
        : await rivalQuery.eq('shift_id', claim.shift_id as string)
      rivalClaimantIds = (rivals ?? [])
        .map(r => r.claimant_id as string)
        .filter((id): id is string => !!id && id !== claimantId)
    }

    const claimantTitle = accepted ? 'Your claim was accepted! 🎉' : 'Your claim was declined'
    const claimantBody = accepted
      ? `${ownerName} accepted your claim on "${shiftTitle}" — complete the trade in your company system`
      : `${ownerName} declined your claim on "${shiftTitle}"`
    const claimantLink = accepted ? '/profile' : '/wall'
    const rivalTitle = 'Shift covered'
    const rivalBody = `"${shiftTitle}" was covered by someone else — more shifts are on the Wall`

    const sends: Promise<unknown>[] = [
      sendPushNotification(claimantId, 'shift_activity', claimantTitle, claimantBody, claimantLink),
      createNotification(db, {
        type: 'claim_resolved', userId: claimantId, title: claimantTitle, body: claimantBody,
        linkUrl: claimantLink, actorUserId: claim.owner_id as string,
      }),
      ...rivalClaimantIds.flatMap(rid => [
        sendPushNotification(rid, 'shift_activity', rivalTitle, rivalBody, '/wall'),
        createNotification(db, {
          type: 'claim_resolved', userId: rid, title: rivalTitle, body: rivalBody,
          linkUrl: '/wall', actorUserId: null,
        }),
      ]),
    ]

    const { data: claimant } = await db
      .from('users')
      .select('email, notify_via_email')
      .eq('id', claimantId)
      .single()

    if (claimant?.notify_via_email && claimant.email && optionalServerEnv.RESEND_API_KEY) {
      sends.push(resend.emails.send({
        from: EMAIL_FROM,
        to: claimant.email,
        subject: accepted ? `Your claim on "${shiftTitle}" was accepted!` : `Update on your claim for "${shiftTitle}"`,
        html: claimResultHtml({
          accepted,
          ownerName,
          shiftTitle,
          ctaUrl: accepted ? `${BASE_URL}/profile` : `${BASE_URL}/wall`,
        }),
      }).then(({ error: e }) => { if (e) console.error('[notifyClaimResolved] Resend error:', e) }))
    }

    await Promise.all(sends)
  } catch (err) {
    console.error('[notifyClaimResolved] unexpected error:', err)
  }
}

/**
 * Fire-and-forget: tell the claimant the owner recorded the final outcome.
 * Push only — this is a record-keeping event, not an action request.
 */
export async function notifyClaimFinalized(claimId: string): Promise<void> {
  try {
    const uid = await callerId('notifyClaimFinalized')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) return

    const db = createAdminClient()
    const { data: claim } = await db
      .from('shift_claims')
      .select('claimant_id, owner_id, status, shifts!shift_id(shift_title)')
      .eq('id', claimId)
      .single()

    if (!claim) return

    // Recording the outcome is the owner's act.
    if (claim.owner_id !== uid) {
      console.error(`[notifyClaimFinalized] rejected: ${uid} does not own claim ${claimId}`)
      return
    }

    // Read the outcome from the row rather than trusting a caller-supplied
    // flag, so the message can't contradict what actually happened.
    const completed = claim.status === 'completed'
    const shiftTitle = (claim.shifts as unknown as { shift_title: string } | null)?.shift_title ?? 'the shift'

    const cfTitle = completed ? 'Trade confirmed ✅' : 'Trade marked as fell through'
    const cfBody = completed
      ? `The trade for "${shiftTitle}" was confirmed — it's on your trade record now`
      : `The owner marked the trade for "${shiftTitle}" as fell through`
    await sendPushNotification(claim.claimant_id as string, 'shift_activity', cfTitle, cfBody, '/profile')
    await createNotification(db, {
      type: 'claim_finalized', userId: claim.claimant_id as string, title: cfTitle, body: cfBody,
      linkUrl: '/profile', actorUserId: null,
    })
  } catch (err) {
    console.error('[notifyClaimFinalized] unexpected error:', err)
  }
}

/**
 * Fire-and-forget: email the user when their board join request is approved.
 * Uses service-role client to read the approving user's email without RLS restrictions.
 * Sent unconditionally — this is a transactional response to the user's own action.
 */
export async function notifyBoardApproved(userBoardId: string): Promise<void> {
  try {
    const uid = await callerId('notifyBoardApproved')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyBoardApproved] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()

    const { data: ub } = await db
      .from('user_boards')
      .select('user_id, board_id, boards(name), users!user_id(email, display_name)')
      .eq('id', userBoardId)
      .single()

    if (!ub) return

    // Approving is a moderator action, so only a Mod/Leader of that board (or
    // a global Admin) may announce it.
    const [{ data: approver }, { data: approverRole }] = await Promise.all([
      db.from('user_boards').select('role')
        .eq('board_id', ub.board_id as string).eq('user_id', uid)
        .eq('is_approved', true).maybeSingle(),
      db.from('users').select('role').eq('id', uid).single(),
    ])
    const isMod = approver?.role === 'Mod' || approver?.role === 'Leader'
    if (!isMod && approverRole?.role !== 'Admin') {
      console.error(`[notifyBoardApproved] rejected: ${uid} cannot approve on board ${ub.board_id}`)
      return
    }
    const boardName = (ub.boards as unknown as { name: string } | null)?.name
    if (!boardName) return

    const user = (ub.users as unknown) as { email: string; display_name: string | null } | null
    if (!user?.email) return

    const memberUserId = ub.user_id as string | null
    if (memberUserId) {
      const baTitle = `You've been accepted to ${boardName}!`
      const baBody = 'Your join request was approved. Head to the Wall to see posts.'
      await sendPushNotification(memberUserId, 'account', baTitle, baBody, '/wall')
      await createNotification(db, {
        type: 'board_approved', userId: memberUserId, title: baTitle, body: baBody,
        linkUrl: '/wall', actorUserId: uid,
      })
    }

    if (!optionalServerEnv.RESEND_API_KEY) {
      console.error('[notifyBoardApproved] RESEND_API_KEY is not set — skipping email')
      return
    }

    await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: `You've been accepted to ${boardName}!`,
      html: boardApprovedHtml({
        displayName: user.display_name ?? undefined,
        boardName,
        wallUrl: `${BASE_URL}/wall`,
      }),
    })
  } catch (err) {
    console.error('[notifyBoardApproved] failed:', err)
  }
}

// Shared by notifyModPromoted/notifyLeaderPromoted: only a Mod/Leader of the
// board (or a global Admin) may announce a role change on it — same
// authorization shape as notifyBoardApproved's isMod check.
async function callerCanManageBoard(
  db: ReturnType<typeof createAdminClient>,
  callerId: string,
  boardId: string
): Promise<boolean> {
  const [{ data: membership }, { data: role }] = await Promise.all([
    db.from('user_boards').select('role')
      .eq('board_id', boardId).eq('user_id', callerId)
      .eq('is_approved', true).maybeSingle(),
    db.from('users').select('role').eq('id', callerId).single(),
  ])
  return membership?.role === 'Mod' || membership?.role === 'Leader' || role?.role === 'Admin'
}

/**
 * Fire-and-forget: congratulate a member just promoted from User to Mod.
 * Per product decision, promotion to Mod is the moment a member starts
 * receiving board email — if their preference was off, this turns it on
 * (never the reverse) and the email explains why. Either way the email
 * reminds them to allow-list our sending address, since Mods are the first
 * tier of users who actually depend on these emails arriving.
 */
export async function notifyModPromoted(userBoardId: string): Promise<void> {
  try {
    const uid = await callerId('notifyModPromoted')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyModPromoted] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()

    const { data: ub } = await db
      .from('user_boards')
      .select('user_id, board_id, boards(name), users!user_id(email, display_name, notify_via_email)')
      .eq('id', userBoardId)
      .single()

    if (!ub) return

    const boardId = ub.board_id as string
    if (!(await callerCanManageBoard(db, uid, boardId))) {
      console.error(`[notifyModPromoted] rejected: ${uid} cannot manage board ${boardId}`)
      return
    }

    const boardName = (ub.boards as unknown as { name: string } | null)?.name
    if (!boardName) return

    const memberUserId = ub.user_id as string | null
    const user = (ub.users as unknown) as { email: string; display_name: string | null; notify_via_email: boolean } | null
    if (!memberUserId || !user) return

    const emailWasJustEnabled = !user.notify_via_email
    if (emailWasJustEnabled) {
      const { error: updateErr } = await db
        .from('users').update({ notify_via_email: true }).eq('id', memberUserId)
      if (updateErr) console.error('[notifyModPromoted] failed to enable notify_via_email:', updateErr.message)
    }

    const title = "Congratulations — you're now a Mod!"
    const body = `You've been made a Mod of ${boardName}. You'll now receive email notifications about board activity.`
    await sendPushNotification(memberUserId, 'account', title, body, '/notifications')
    await createNotification(db, {
      type: 'mod_promoted', userId: memberUserId, title, body, linkUrl: '/notifications', actorUserId: uid,
    })

    if (!user.email) return
    if (!optionalServerEnv.RESEND_API_KEY) {
      console.error('[notifyModPromoted] RESEND_API_KEY is not set — skipping email')
      return
    }

    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: `You're now a Mod on ${boardName}`,
      html: modPromotedHtml({
        displayName: user.display_name ?? undefined,
        boardName,
        emailWasJustEnabled,
        notificationsUrl: `${BASE_URL}/notifications`,
      }),
    })
    if (sendError) console.error('[notifyModPromoted] Resend error:', sendError)
  } catch (err) {
    console.error('[notifyModPromoted] failed:', err)
  }
}

/**
 * Fire-and-forget: congratulate a Mod just promoted to Leader (board Admin).
 * No email-preference nudge or allow-list reminder here — by this point
 * they've already been a Mod and received that message once.
 */
export async function notifyLeaderPromoted(boardId: string, targetUserId: string): Promise<void> {
  try {
    const uid = await callerId('notifyLeaderPromoted')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyLeaderPromoted] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()

    if (!(await callerCanManageBoard(db, uid, boardId))) {
      console.error(`[notifyLeaderPromoted] rejected: ${uid} cannot manage board ${boardId}`)
      return
    }

    const [{ data: board }, { data: user }] = await Promise.all([
      db.from('boards').select('name').eq('id', boardId).single(),
      db.from('users').select('email, display_name, notify_via_email').eq('id', targetUserId).single(),
    ])
    const boardName = board?.name
    if (!boardName || !user) return

    const title = "Congratulations — you're now the Admin!"
    const body = `You've been promoted to Admin of ${boardName}.`
    await sendPushNotification(targetUserId, 'account', title, body, '/notifications')
    await createNotification(db, {
      type: 'leader_promoted', userId: targetUserId, title, body, linkUrl: '/notifications', actorUserId: uid,
    })

    if (!user.notify_via_email || !user.email) return
    if (!optionalServerEnv.RESEND_API_KEY) return

    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: `You're now the Admin of ${boardName}`,
      html: leaderPromotedHtml({
        displayName: user.display_name ?? undefined,
        boardName,
        notificationsUrl: `${BASE_URL}/notifications`,
      }),
    })
    if (sendError) console.error('[notifyLeaderPromoted] Resend error:', sendError)
  } catch (err) {
    console.error('[notifyLeaderPromoted] failed:', err)
  }
}

/**
 * Fire-and-forget: alert a board's Mods and Leaders (never the site-wide
 * Overlord unless they separately hold a visible Mod/Leader seat on this
 * specific board) that a new member is waiting on approval. Caller must be
 * the requester themselves — this fires right after their own
 * confirmJoinBoard insert, not as a moderator action.
 */
export async function notifyJoinRequestPending(userBoardId: string): Promise<void> {
  try {
    const uid = await callerId('notifyJoinRequestPending')
    if (!uid) return

    if (!optionalServerEnv.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[notifyJoinRequestPending] SUPABASE_SERVICE_ROLE_KEY is not set — skipping')
      return
    }

    const db = createAdminClient()

    const { data: ub } = await db
      .from('user_boards')
      .select('user_id, board_id, boards(name), users!user_id(display_name)')
      .eq('id', userBoardId)
      .single()

    if (!ub) return
    if (ub.user_id !== uid) {
      console.error(`[notifyJoinRequestPending] rejected: ${uid} does not own request ${userBoardId}`)
      return
    }

    const boardId = ub.board_id as string
    const boardName = (ub.boards as unknown as { name: string } | null)?.name
    if (!boardName) return
    const requesterName = (ub.users as unknown as { display_name: string | null } | null)?.display_name ?? 'Someone'

    // Hidden rows are silent Overlord seats, not visible board leadership —
    // excluded so the site-wide Admin isn't fanned out to on every board.
    const { data: recipients } = await db
      .from('user_boards')
      .select('user_id, users!user_id(email, notify_via_email)')
      .eq('board_id', boardId)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .in('role', ['Mod', 'Leader'])

    if (!recipients || recipients.length === 0) return

    const title = 'New join request'
    const body = `${requesterName} has requested to join ${boardName}.`
    const approvalsUrl = `${BASE_URL}/leader/approvals`

    const sends: Promise<unknown>[] = []
    for (const r of recipients) {
      const recipientId = r.user_id as string
      const recipientUser = (r.users as unknown) as { email: string; notify_via_email: boolean } | null
      sends.push(sendPushNotification(recipientId, 'account', title, body, '/leader/approvals'))
      sends.push(createNotification(db, {
        type: 'join_request', userId: recipientId, title, body, linkUrl: '/leader/approvals', actorUserId: uid,
      }))
      if (recipientUser?.notify_via_email && recipientUser.email && optionalServerEnv.RESEND_API_KEY) {
        sends.push(resend.emails.send({
          from: EMAIL_FROM,
          to: recipientUser.email,
          subject: `New member waiting for approval on ${boardName}`,
          html: joinRequestPendingHtml({ requesterName, boardName, approvalsUrl }),
        }).then(({ error }) => {
          if (error) console.error('[notifyJoinRequestPending] Resend error:', error)
        }))
      }
    }
    await Promise.all(sends)
  } catch (err) {
    console.error('[notifyJoinRequestPending] failed:', err)
  }
}
