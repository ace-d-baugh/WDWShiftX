'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './product-tour.css'
import {
  TOUR_CHAPTERS,
  buildSteps,
  findTarget,
  type HandoffData,
} from '@/lib/tour/tour-steps'
import { setSampleMode } from '@/lib/tour/sample-data'
import {
  TOUR_EVENT,
  clearPendingChapter,
  hasSeenTour,
  markChapterComplete,
  markTourDismissed,
  markTourStarted,
  peekPendingChapter,
  setPendingChapter,
  type TourChapter,
  type TourEventDetail,
} from '@/lib/tour/tour-state'

/**
 * The product tour, mounted once in the dashboard layout so it survives the
 * client-side hop from /wall to /wall/new-shift mid-walkthrough.
 *
 * It starts in three ways:
 *   • automatically, the first time someone lands on the Wall,
 *   • from a hand-off — the Wall chapter ends by sending you to the post form,
 *   • on demand, via `startTour()` (Help → Replay the tour).
 */
export function ProductTour() {
  const pathname = usePathname()
  const router = useRouter()

  const driverRef = useRef<Driver | null>(null)
  /** Bumped on every start/teardown so a slow `waitForReady` can't resurrect
   *  a chapter the user has already navigated away from. */
  const runIdRef = useRef(0)

  const teardown = useCallback(() => {
    runIdRef.current += 1
    driverRef.current?.destroy()
    driverRef.current = null
    setSampleMode(false)
  }, [])

  const start = useCallback(
    async (chapterId: TourChapter) => {
      teardown()
      const runId = runIdRef.current
      const chapter = TOUR_CHAPTERS[chapterId]
      if (!chapter) return

      // Turned on before anything is measured so the demo shifts, calendar
      // blocks and conversations are already rendered when the step list is
      // built — otherwise an account with an empty Wall would get a tour with
      // most of its steps filtered away.
      setSampleMode(true)

      const ready = await waitForReady(chapter.readySelector)
      if (!ready || runId !== runIdRef.current) return

      // Give the page's own content a moment to land before measuring which
      // steps have targets. Timing out is fine — it just means there's nothing
      // there to point at.
      if (chapter.settleSelector) {
        await waitForReady(chapter.settleSelector, 3000)
        if (runId !== runIdRef.current) return
      }

      chapter.prepare?.()
      // Two frames: one for React to flush whatever `prepare` toggled, one for
      // the browser to lay it out before we measure which steps have targets.
      await nextFrame()
      await nextFrame()
      if (runId !== runIdRef.current) return

      const steps = buildSteps(chapter)
      if (steps.length === 0) return

      const isDark = document.documentElement.classList.contains('dark')
      let finished = false

      const tour = driver({
        steps,
        popoverClass: 'wdwx-tour',
        showProgress: true,
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        // Brand purple rather than flat black, and heavier on dark themes where
        // a 60% dim barely separates the stage from the page behind it.
        overlayColor: isDark ? '#0B0512' : '#2F2040',
        overlayOpacity: isDark ? 0.72 : 0.62,
        stagePadding: 8,
        stageRadius: 12,
        popoverOffset: 12,
        smoothScroll: true,
        // The corner close control reads as "Skip" rather than a bare ×, so it's
        // clear it ends (and finishes) the tour. Closing already marks the tour
        // dismissed via onDestroyed below, so it never nags again. Re-applied on
        // every step since driver re-renders the popover each time.
        onPopoverRender: (popover) => {
          popover.closeButton.textContent = 'Skip'
          popover.closeButton.setAttribute('aria-label', 'Skip the tour')
        },
        // Read-only: clicking the highlighted button mid-tour would navigate
        // away and strand the overlay. The popover's own buttons drive it.
        disableActiveInteraction: true,
        // Belt and braces — steps are pre-filtered, but the Wall is realtime
        // and a card can vanish between building the list and reaching it.
        skipMissingElement: true,
        waitForElement: 1200,
        onDoneClick: () => {
          finished = true
          markChapterComplete(chapter.id)
          const next = (tour.getActiveStep()?.data as HandoffData | undefined)?.handoff
          teardown()
          if (next) {
            setPendingChapter(next)
            router.push(TOUR_CHAPTERS[next].path)
          }
        },
        onDestroyed: () => {
          if (!finished) markTourDismissed()
          driverRef.current = null
          // Closing the tour from its own × / Esc / overlay click never routes
          // through `teardown`, so the demo rows have to be retired here too —
          // otherwise they linger on the page, outliving the tour that owns
          // them, until the next navigation.
          setSampleMode(false)
        },
      })

      driverRef.current = tour
      // Both of these are committed here rather than at the decision point:
      // React's StrictMode runs every effect twice in dev, and the first pass
      // is torn down while this function is still awaiting. Recording "seen"
      // and consuming the hand-off only once a tour is really on screen keeps
      // the second pass free to start it.
      markTourStarted()
      clearPendingChapter()
      tour.drive()
    },
    [router, teardown]
  )

  // Auto-start on the Wall, and pick up a chapter handed over by the previous
  // page. Re-runs on navigation; tears down whatever was on screen first.
  useEffect(() => {
    teardown()

    const pending = peekPendingChapter()
    if (pending) {
      if (pathname === TOUR_CHAPTERS[pending].path) {
        void start(pending)
      } else {
        // They went somewhere else instead — drop the hand-off rather than
        // ambushing them with chapter two three pages later.
        clearPendingChapter()
      }
      return
    }

    if (pathname === TOUR_CHAPTERS.wall.path && !hasSeenTour()) {
      void start('wall')
    }
  }, [pathname, start, teardown])

  // Manual starts from anywhere in the app (Help → Replay the tour).
  useEffect(() => {
    const onStart = (event: Event) => {
      const { chapter } = (event as CustomEvent<TourEventDetail>).detail ?? {}
      if (chapter) void start(chapter)
    }
    window.addEventListener(TOUR_EVENT, onStart)
    return () => window.removeEventListener(TOUR_EVENT, onStart)
  }, [start])

  useEffect(() => teardown, [teardown])

  return null
}

// ── Timing helpers ────────────────────────────────────────────────────────────

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

/** The Wall paints a skeleton while it loads, and the post form waits on the
 *  user's boards — poll briefly rather than starting against an empty page. */
function waitForReady(selector: string, timeoutMs = 8000): Promise<boolean> {
  if (findTarget(selector)) return Promise.resolve(true)

  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs
    const tick = () => {
      if (findTarget(selector)) return resolve(true)
      if (Date.now() > deadline) return resolve(false)
      window.setTimeout(tick, 120)
    }
    window.setTimeout(tick, 120)
  })
}
