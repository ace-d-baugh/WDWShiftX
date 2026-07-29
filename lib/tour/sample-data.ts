'use client'

import { useSyncExternalStore } from 'react'

/**
 * Demo content shown *only* while the product tour is running.
 *
 * None of this touches the database. It is merged into each surface's list at
 * render time and disappears the moment the tour ends, so a brand-new member
 * with an empty Wall still gets a walkthrough with something to look at, and a
 * busy Wall still shows one clean example of each shift type.
 *
 * The row shapes below deliberately mirror — rather than import — the real
 * ones (`ShiftData`, `ConversationSummary`, CalendarClient's props). Each
 * merge site assigns these into the genuine array, so if a real shape gains a
 * required field, that site fails to compile and this file gets updated with
 * it. Importing the types instead would create a cycle back through the very
 * components that consume this module.
 */

// ── Sample-mode store ─────────────────────────────────────────────────────────

let active = false
const listeners = new Set<() => void>()

/** Read outside React (data loaders, event handlers). */
export function isSampleMode(): boolean {
  return active
}

export function setSampleMode(next: boolean): void {
  if (active === next) return
  active = next
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Always false on the server, so sample rows never appear in the SSR HTML and
 *  hydration matches (the tour can only start after mount). */
function getServerSnapshot(): boolean {
  return false
}

export function useSampleMode(): boolean {
  return useSyncExternalStore(subscribe, isSampleMode, getServerSnapshot)
}

// ── Identity ──────────────────────────────────────────────────────────────────

const SAMPLE_PREFIX = 'sample-'

/** Real ids are UUIDs, so the prefix can never collide with one. */
export function isSampleId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(SAMPLE_PREFIX)
}

const SAMPLE_BOARD_ID = 'sample-board'
const SAMPLE_BOARD_NAME = 'Sample Board'
const SAMPLE_POSTER_ID = 'sample-user-sample-u'
const SAMPLE_POSTER_NAME = 'Sample U.'
const SAMPLE_OTHER_ID = 'sample-user-user-x'
const SAMPLE_OTHER_NAME = 'User X.'

// ── Dates ─────────────────────────────────────────────────────────────────────

/**
 * `dayOffset` days from today at a fixed wall-clock time. Anchored to local
 * midnight first so the result is stable for the whole day — re-rendering
 * mid-tour must not shuffle the cards.
 */
function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

const FAR_FUTURE = () => at(90, 12)

const SAMPLE_DETAILS =
  'This is a sample shift and will become hidden once done with the tour, ' +
  'but can show up when you do the tour again.'

/**
 * The three demo shifts, one per posting type, on today / tomorrow / the day
 * after, with times that match their names. Shared by the Wall and the
 * Calendar so the same shifts are recognisable across both chapters.
 */
const SAMPLE_SHIFT_SEEDS = [
  {
    id: 'sample-shift-morning',
    shift_title: 'Sample Morning Shift',
    dayOffset: 0,
    start: [7, 0] as const,
    end: [15, 0] as const,
    is_giveaway: true,
    is_trade: false,
    details: SAMPLE_DETAILS,
    comment_count: 1,
  },
  {
    id: 'sample-shift-afternoon',
    shift_title: 'Sample Afternoon Shift',
    dayOffset: 1,
    start: [12, 0] as const,
    end: [20, 0] as const,
    is_giveaway: false,
    is_trade: true,
    details: null,
    comment_count: 0,
  },
  {
    id: 'sample-shift-evening',
    shift_title: 'Sample Evening Shift',
    dayOffset: 2,
    start: [16, 0] as const,
    end: [23, 30] as const,
    is_giveaway: true,
    is_trade: true,
    details: null,
    comment_count: 0,
  },
]

// ── The Wall ──────────────────────────────────────────────────────────────────

/** Mirrors `ShiftData` in components/features/ShiftCard.tsx. */
interface SampleWallShift {
  id: string
  shift_title: string
  created_by: string
  user_id: string | null
  board_id: string | null
  board_name: string
  start_time: string
  end_time: string
  is_trade: boolean
  is_giveaway: boolean
  is_overtime_approved: boolean
  details: string | null
  is_active: boolean
  expires_at: string
  created_at: string
  bundle_id: string | null
  comment_count?: number
  interested_count?: number
  contactReady?: boolean
}

export function sampleWallShifts(): SampleWallShift[] {
  return SAMPLE_SHIFT_SEEDS.map(seed => ({
    id: seed.id,
    shift_title: seed.shift_title,
    created_by: SAMPLE_POSTER_NAME,
    // A poster who isn't you, so the card shows the claim and message
    // controls rather than the owner's variant.
    user_id: SAMPLE_POSTER_ID,
    board_id: SAMPLE_BOARD_ID,
    board_name: SAMPLE_BOARD_NAME,
    start_time: at(seed.dayOffset, seed.start[0], seed.start[1]),
    end_time: at(seed.dayOffset, seed.end[0], seed.end[1]),
    is_trade: seed.is_trade,
    is_giveaway: seed.is_giveaway,
    is_overtime_approved: false,
    details: seed.details,
    is_active: true,
    expires_at: FAR_FUTURE(),
    created_at: hoursAgo(3),
    bundle_id: null,
    comment_count: seed.comment_count,
    interested_count: 0,
    contactReady: true,
  }))
}

/** Mirrors `CommentData` in components/features/CommentSection.tsx. */
interface SampleComment {
  id: string
  user_id: string | null
  display_name: string
  body: string
  is_interested: boolean
  created_at: string
  updated_at: string
}

/** The morning shift carries one comment so the tour can show a real thread. */
export function sampleComments(postId: string): SampleComment[] {
  if (postId !== 'sample-shift-morning') return []
  return [
    {
      id: 'sample-comment-1',
      user_id: SAMPLE_OTHER_ID,
      display_name: SAMPLE_OTHER_NAME,
      body: 'Sample comment',
      is_interested: false,
      created_at: hoursAgo(2),
      updated_at: hoursAgo(2),
    },
  ]
}

// ── My Calendar ───────────────────────────────────────────────────────────────

/** Mirrors `MyShift` in app/(dashboard)/calendar/CalendarClient.tsx. */
interface SampleCalendarShift {
  id: string
  shift_title: string
  start_time: string
  end_time: string
  is_trade: boolean
  is_giveaway: boolean
  board_id: string | null
  bundle_id: string | null
  given_away: boolean
}

/** Mirrors `BoardShift`. */
interface SampleBoardShift {
  id: string
  start_time: string
  is_trade: boolean
  is_giveaway: boolean
  board_id: string | null
}

/** Mirrors `BoardRequest`. */
interface SampleBoardRequest {
  id: string
  requested_date: string
  board_id: string | null
}

export function sampleCalendarShifts(): SampleCalendarShift[] {
  return SAMPLE_SHIFT_SEEDS.map(seed => ({
    id: seed.id,
    shift_title: seed.shift_title,
    start_time: at(seed.dayOffset, seed.start[0], seed.start[1]),
    end_time: at(seed.dayOffset, seed.end[0], seed.end[1]),
    is_trade: seed.is_trade,
    is_giveaway: seed.is_giveaway,
    board_id: SAMPLE_BOARD_ID,
    bundle_id: null,
    given_away: false,
  }))
}

/** Drives the coloured activity dots under the sample days. */
export function sampleBoardShifts(): SampleBoardShift[] {
  return SAMPLE_SHIFT_SEEDS.map(seed => ({
    id: `${seed.id}-board`,
    start_time: at(seed.dayOffset, seed.start[0], seed.start[1]),
    is_trade: seed.is_trade,
    is_giveaway: seed.is_giveaway,
    board_id: SAMPLE_BOARD_ID,
  }))
}

/** One open request, so the Request dot in the legend has a day to sit on. */
export function sampleBoardRequests(): SampleBoardRequest[] {
  const day = at(1, 12).slice(0, 10)
  return [{ id: 'sample-request-1', requested_date: day, board_id: SAMPLE_BOARD_ID }]
}

// ── Messages ──────────────────────────────────────────────────────────────────

/** Mirrors `ConversationSummary` in app/(dashboard)/messages/MessagesClient.tsx. */
interface SampleConversation {
  conversation_id: string
  other_user_id: string | null
  other_display_name: string | null
  last_message_body: string | null
  last_message_at: string | null
  last_message_sender_id: string | null
  unread_count: number
}

/**
 * Two demo threads — one unread from Sample U., one you replied to last with
 * User X. — so the walkthrough can point at the unread badge, the "You:"
 * preview and the per-chat delete without needing real correspondence.
 */
export function sampleConversations(currentUserId: string): SampleConversation[] {
  return [
    {
      conversation_id: 'sample-conversation-1',
      other_user_id: SAMPLE_POSTER_ID,
      other_display_name: SAMPLE_POSTER_NAME,
      last_message_body: "I'll take the Sample Morning Shift if nobody else has grabbed it.",
      last_message_at: hoursAgo(0.4),
      last_message_sender_id: SAMPLE_POSTER_ID,
      unread_count: 2,
    },
    {
      conversation_id: 'sample-conversation-2',
      other_user_id: SAMPLE_OTHER_ID,
      other_display_name: SAMPLE_OTHER_NAME,
      last_message_body: 'Thanks for covering Saturday — I owe you one.',
      last_message_at: hoursAgo(5),
      last_message_sender_id: currentUserId,
      unread_count: 0,
    },
  ]
}
