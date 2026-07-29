/**
 * Client-side memory for the product tour.
 *
 * Deliberately localStorage rather than a `users` column: the tour teaches the
 * *interface*, so "has this person seen it on this device" is the useful
 * question — a phone and a desktop are different enough to be worth showing
 * twice — and a first-run tour shouldn't wait on a round trip to decide
 * whether to run. `onboarding_dismissed_at` still owns the /welcome wizard;
 * this is a separate, lighter thing.
 *
 * Bump TOUR_VERSION when the Wall or the post form changes enough that the old
 * walkthrough would mislead — it re-runs the tour for everyone.
 */

export const TOUR_VERSION = 1

export type TourChapter = 'wall' | 'post-shift' | 'calendar' | 'messages'

/** Every valid chapter id — guards what comes back out of sessionStorage. */
const CHAPTER_IDS: readonly TourChapter[] = ['wall', 'post-shift', 'calendar', 'messages']

const KEY = `wdwshiftx-tour-v${TOUR_VERSION}`
/** Separate key: survives the client-side nav from /wall to /wall/new-shift. */
const PENDING_KEY = `${KEY}-pending`

/** Dispatched on `window` to start a chapter from anywhere (Help, /welcome). */
export const TOUR_EVENT = 'wdwshiftx:tour'

export interface TourEventDetail {
  chapter: TourChapter
}

interface TourRecord {
  /** Chapters run all the way to their last step. */
  completed?: TourChapter[]
  /** Set when the tour is closed early — auto-start stops either way. */
  dismissedAt?: string
  /** Set the moment an auto-start fires, so a mid-tour refresh doesn't relaunch. */
  startedAt?: string
}

function read(): TourRecord {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TourRecord) : {}
  } catch {
    return {}
  }
}

function write(patch: Partial<TourRecord>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }))
  } catch {
    /* private mode / quota — the tour just becomes a repeat offender */
  }
}

/** True once the tour has run, been finished, or been closed on this device. */
export function hasSeenTour(): boolean {
  const rec = read()
  return !!rec.startedAt || !!rec.dismissedAt || (rec.completed?.length ?? 0) > 0
}

export function markTourStarted(): void {
  if (!read().startedAt) write({ startedAt: new Date().toISOString() })
}

export function markTourDismissed(): void {
  write({ dismissedAt: new Date().toISOString() })
}

export function markChapterComplete(chapter: TourChapter): void {
  const completed = read().completed ?? []
  if (!completed.includes(chapter)) write({ completed: [...completed, chapter] })
}

/** Hands a chapter to the next page — the Wall chapter ends by sending the
 *  user to the post form, where chapter two picks up. */
export function setPendingChapter(chapter: TourChapter): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PENDING_KEY, chapter)
  } catch {
    /* no-op */
  }
}

/**
 * Non-destructive read. Consuming it here would be wrong: React's StrictMode
 * runs effects twice in development and the first pass is torn down before it
 * can start anything, so the hand-off has to survive until a tour is actually
 * on screen — `clearPendingChapter` is called at that point instead.
 */
export function peekPendingChapter(): TourChapter | null {
  if (typeof window === 'undefined') return null
  try {
    const value = sessionStorage.getItem(PENDING_KEY)
    return CHAPTER_IDS.includes(value as TourChapter) ? (value as TourChapter) : null
  } catch {
    return null
  }
}

export function clearPendingChapter(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* no-op */
  }
}

/**
 * Start (or restart) a chapter from anywhere in the app. Fire-and-forget: the
 * single <ProductTour> in the dashboard layout is listening.
 */
export function startTour(chapter: TourChapter = 'wall'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<TourEventDetail>(TOUR_EVENT, { detail: { chapter } })
  )
}
