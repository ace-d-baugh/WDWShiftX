import type { DriveStep } from 'driver.js'
import type { TourChapter } from '@/lib/tour/tour-state'

/**
 * Step definitions for the product tour. Targets are `[data-tour="…"]`
 * attributes rather than classes so restyling a component never silently
 * breaks the walkthrough.
 *
 * Two chapters, in the order a new member actually needs them: read the Wall,
 * then post a shift. The Wall chapter's last step hands off to the post form
 * (see `nextChapter`), so the two run as one continuous orientation.
 */

// ── Element resolution ────────────────────────────────────────────────────────

/** driver.js's own "is this actually rendered" test, reused so our filtering
 *  and its `skipMissingElement` never disagree. */
function isRendered(el: Element): boolean {
  const node = el as HTMLElement
  return !!(node.offsetWidth || node.offsetHeight || el.getClientRects().length)
}

export function findTarget(selector: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return matches.find(isRendered) ?? matches[0] ?? null
}

/**
 * Resolver for targets that exist twice in the DOM — the navbar renders a
 * desktop header *and* a mobile bottom bar, and only one is on screen. Picks
 * whichever the viewport is showing.
 *
 * The cast is deliberate: driver.js types the resolver as `() => Element`, but
 * its implementation is `typeof el === 'function' ? el() : …` and it handles a
 * falsy return (skips the step, or centres the popover). Returning null is the
 * documented-by-behaviour way to say "not on screen".
 */
function visible(selector: string): () => Element {
  return (() => findTarget(selector)) as () => Element
}

/** Marks the row the tour supplied itself — see lib/tour/sample-data.ts. */
const SAMPLE_SCOPE = '[data-tour-sample="true"]'

/**
 * Prefers the tour's own demo row over a real one. The step copy describes the
 * sample shift / conversation, so the highlight should land on that rather
 * than on whichever real row happens to sort first — otherwise the Calendar
 * chapter scrolls back to some unrelated shift from last week. Falls back to
 * the first real match when no sample is on screen.
 */
function sampleFirst(selector: string): () => Element {
  return (() =>
    findTarget(`${SAMPLE_SCOPE}${selector}`) ?? // the marked element itself
    findTarget(`${SAMPLE_SCOPE} ${selector}`) ?? // something inside it
    findTarget(selector)) as () => Element
}

// ── Demo interactions ─────────────────────────────────────────────────────────

/** Sample-scoped lookup, falling back to the first real match. */
function target(selector: string): HTMLElement | null {
  return findTarget(`${SAMPLE_SCOPE} ${selector}`) ?? findTarget(selector)
}

/**
 * Drives a control on the demo card when its step opens, so the walkthrough
 * *shows* what it's describing instead of pointing at a closed accordion.
 *
 * Two details make this safe. Each action is written as "click only if not
 * already in the target state", so stepping backwards and forwards doesn't
 * toggle things shut. And every one of them changes the card's height, so
 * driver's stage and popover are remeasured once React has committed — two
 * frames, one for the state flush and one for layout.
 */
function demoAction(run: () => void): DriveStep['onHighlightStarted'] {
  return (_element, _step, { driver }) => {
    run()
    requestAnimationFrame(() => requestAnimationFrame(() => driver.refresh()))
  }
}

/** Click a `data-tour-open` toggle only when it's currently closed. */
function expand(selector: string): () => void {
  return () => {
    const el = target(selector)
    if (el?.dataset.tourOpen === 'false') el.click()
  }
}

/** Send the demo claim, unless the walkthrough already sent it. */
function sendSampleClaim(): void {
  const el = target('[data-tour="claim-pill"]')
  if (el?.dataset.tourClaimed === 'false') el.click()
}

// ── Copy helpers ──────────────────────────────────────────────────────────────

/** Descriptions are injected as HTML, so a swatch can carry the same colour the
 *  card title uses — including under Midnight, Cyberpunk and the rest. */
const tint = (cssVar: string, label: string) =>
  `<strong style="color:hsl(var(${cssVar}))">${label}</strong>`

/**
 * Hue ranges, in the order a person would name them. Upper bound is exclusive;
 * red appears twice because it wraps around 0°.
 */
const HUE_NAMES: readonly (readonly [number, string])[] = [
  [15, 'red'], [40, 'orange'], [58, 'gold'], [70, 'yellow'], [165, 'green'],
  [185, 'teal'], [255, 'blue'], [290, 'purple'], [335, 'pink'], [361, 'red'],
]

/** `--color-*` are stored as bare "H S% L%" triples for Tailwind's alpha syntax. */
function readHsl(cssVar: string): [number, number, number] | null {
  if (typeof window === 'undefined') return null
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  const m = raw.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** What a person would call the colour this variable currently resolves to. */
function colourName(cssVar: string, fallback: string): string {
  const hsl = readHsl(cssVar)
  if (!hsl) return fallback
  const [h, s, l] = hsl
  if (s < 12) return l > 55 ? 'light grey' : 'grey'
  return HUE_NAMES.find(([upper]) => h < upper)?.[1] ?? fallback
}

/**
 * Names the three shift-type colours as they actually appear. The palette is
 * per-theme — Nordic's "purple" is sage green, Halloween's is orange, and
 * Patriotic's Trade colour is gold — so hard-coding the default palette's names
 * would be wrong for most themes.
 *
 * Nordic is a case where naming genuinely can't work: its Give/Trade and
 * Giveaway colours are both greens. When any two names come out the same, the
 * sentence switches to naming the badges instead, which is true everywhere.
 */
function shiftColourSentence(): string {
  const trade = colourName('--color-info', 'blue')
  const give = colourName('--color-success', 'green')
  const both = colourName('--color-primary', 'purple')

  if (new Set([trade, give, both]).size < 3) {
    return `The title's colour matches the badge — ${tint('--color-info', 'Trade')}, ` +
      `${tint('--color-success', 'Giveaway')}, or ${tint('--color-primary', 'Give/Trade')} ` +
      `when the owner will do either.`
  }
  return `The title's colour is a shortcut: ${tint('--color-info', trade)} for trade, ` +
    `${tint('--color-success', give)} for giveaway, ${tint('--color-primary', both)} ` +
    `when the owner will do either.`
}

// ── Chapter definitions ───────────────────────────────────────────────────────

export interface TourChapterDef {
  id: TourChapter
  /** Route the chapter belongs to. Auto-start and hand-off both check it. */
  path: string
  /** Name and one-liner for the Help page's walkthrough picker. */
  label: string
  blurb: string
  /** Must be on the page before the chapter starts — the page shell. */
  readySelector: string
  /**
   * Waited for, briefly, *after* the shell but before the steps are measured.
   * The Wall's tabs render immediately while the posts underneath are still a
   * skeleton, so the shell alone is not enough to tell whether there's a card
   * to point at. Not finding it is a legitimate answer (an empty Wall) — the
   * chapter starts either way, just with fewer steps.
   */
  settleSelector?: string
  /**
   * Runs before the steps are built, to open any collapsed UI the tour points
   * at. Kept separate from the steps so the progress count ("3 of 9") matches
   * what the user will actually be shown.
   */
  prepare?: () => void
  /**
   * Built fresh each time the chapter runs, not once at module load — some
   * copy depends on the theme in force (see `shiftColourSentence`), and the
   * user can change that between tours.
   */
  steps: () => DriveStep[]
}

/** Put on the step that ends a chapter by sending the user somewhere new. Read
 *  off the active step when Done is clicked, so a chapter only hands off if the
 *  hand-off step actually survived filtering. */
export interface HandoffData {
  handoff: TourChapter
}

const wallChapter: TourChapterDef = {
  id: 'wall',
  path: '/wall',
  label: 'Reading the Wall',
  blurb: 'How shifts get posted, what the badges mean, and how to ask for one.',
  readySelector: '[data-tour="wall-tabs"]',
  settleSelector: '[data-tour="shift-card"]',
  steps: () => [
    {
      popover: {
        title: 'Welcome to the Wall',
        description:
          "This is where your boards trade shifts — everything posted by people you share a board with lands here. Ninety seconds and you'll know how to read it, and how to post one of your own.",
      },
    },
    {
      element: '[data-tour="wall-tabs"]',
      popover: {
        title: 'Offers and Requests',
        description:
          '<strong>Shift Offers</strong> are shifts somebody wants to hand off. <strong>Shift Requests</strong> are people hoping to pick one up. The number on each tab is how many are showing right now.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="wall-days"]',
      popover: {
        title: 'Grouped by day',
        description:
          'Posts stack under the day they actually happen, soonest first. Tap a day header to fold it away once you know there’s nothing there for you.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: sampleFirst('[data-tour="shift-card"]'),
      popover: {
        title: 'One shift, at a glance',
        description:
          `Who posted it, what the shift is called, and start → end. ${shiftColourSentence()} Your calendar uses the same colours.`,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: sampleFirst('[data-tour="card-badges"]'),
      popover: {
        title: 'Giveaway, Trade, Give/Trade, OT',
        description:
          '<strong>Giveaway</strong> — they’ll hand the shift over, nothing wanted back. <strong>Trade</strong> — they want one of yours in exchange. <strong>Give/Trade</strong> — they’ll do either, so offer a swap or just take it off their hands. <strong>OT</strong> — a Manager has already cleared it as approved overtime.',
        side: 'top',
        align: 'end',
      },
    },
    {
      element: sampleFirst('[data-tour="card-details-area"]'),
      onHighlightStarted: demoAction(expand('[data-tour="card-details"]')),
      popover: {
        title: 'There’s more underneath',
        description:
          'This chevron opens the poster’s notes and the board the shift came from — worth a look before you commit to anything. Here’s what it just revealed.',
        // Above rather than beside: the step expands the card, and anything
        // level with the chevron sits right on top of the notes it just opened.
        side: 'top',
        align: 'end',
      },
    },
    {
      element: sampleFirst('[data-tour="claim-pill"]'),
      onHighlightStarted: demoAction(sendSampleClaim),
      popover: {
        title: '“I Can Help”',
        description:
          'Tapping this doesn’t take the shift — it tells the owner you want it and notifies them straight away, which is what’s just happened here. The post stays on the Wall, everyone interested stacks up in that count, and the owner chooses. Tap it again to withdraw.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: sampleFirst('[data-tour="card-comments-panel"]'),
      onHighlightStarted: demoAction(expand('[data-tour="card-comments"]')),
      popover: {
        title: 'Ask before you commit',
        description:
          '<strong>Comments</strong> are visible to the whole board — good for “is this a closing shift?” — and they’re now open here. <strong>Message</strong>, up in the row above, opens a private chat with just the poster where you can work out the details of handing off the shift.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: sampleFirst('[data-tour="card-menu"]'),
      popover: {
        title: 'The ⋮ menu',
        description:
          'Comment, message, or flag a post that shouldn’t be here. On your own posts you also get Edit, <strong>Remove from Wall</strong> — which takes it off the Wall but keeps it on your calendar — and Delete.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="wall-filters-area"]',
      onHighlightStarted: demoAction(expand('[data-tour="wall-filters"]')),
      popover: {
        title: 'Too much to scroll?',
        description:
          'Opened up here: narrow the Wall by <strong>board</strong>, by <strong>type</strong> (Trade or Giveaway), by <strong>day of the week</strong>, or by a specific <strong>date</strong> — search by <strong>keyword</strong>, and flip on <strong>My Posts</strong> to see only your own.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: visible('[data-tour="nav-calendar"]'),
      // Fallback hand-off. Someone who hasn't been approved into a board yet
      // has no Post Shift button, so the step below is filtered out and this
      // becomes the chapter's last step — without this the tour would just
      // stop rather than carrying on to the parts they *can* use. Ignored
      // whenever the Post Shift step survives, since only the final step's
      // hand-off is ever read.
      data: { handoff: 'calendar' } satisfies HandoffData,
      popover: {
        title: 'The rest of the app',
        description:
          '<strong>My Calendar</strong> holds every shift you own, posted or not. <strong>Messages</strong> is where your private chats live. The <strong>?</strong> in the header has the full guide — and a button to replay this tour.',
        align: 'center',
        doneBtnText: 'Next: your calendar →',
      },
    },
    {
      element: '[data-tour="wall-post"]',
      data: { handoff: 'post-shift' } satisfies HandoffData,
      popover: {
        title: 'Your turn',
        description:
          'This posts an offer while you’re on the Offers tab, or a request on Requests. Want to walk through posting one?',
        side: 'bottom',
        align: 'end',
        doneBtnText: 'Show me →',
      },
    },
  ],
}

const postShiftChapter: TourChapterDef = {
  id: 'post-shift',
  path: '/wall/new-shift',
  label: 'Posting a shift',
  blurb: 'Get a shift onto your calendar — and onto the Wall when you want it seen.',
  readySelector: '[data-tour="post-title"]',
  settleSelector: '[data-tour="post-submit"]',
  // The Post to Wall section is an accordion. Open it up front so its steps
  // are in the list (and in the progress count) from the start.
  prepare: () => {
    const toggle = findTarget('[data-tour="post-wall-toggle"]')
    if (toggle?.dataset.tourOpen === 'false') toggle.click()
  },
  steps: () => [
    {
      popover: {
        title: 'Posting a shift',
        description:
          'Two things happen on this form, and it’s worth knowing they’re separate: every shift you add goes on <strong>your calendar</strong>, and putting it on <strong>the Wall</strong> is a deliberate extra step.',
      },
    },
    {
      element: '[data-tour="post-board"]',
      popover: {
        title: 'Which board?',
        description:
          'Only members of the board you pick will see this shift. If you’re on a single board this is chosen for you and the field doesn’t appear at all.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-title"]',
      popover: {
        title: 'Name it the way your schedule does',
        description:
          'Use the exact title from your posted schedule — “Morning Opening”, “PM Attractions”. It’s the first thing anyone scans, and it makes the shift recognisable to people who work it.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-times"]',
      popover: {
        title: 'Start and end',
        description:
          'Pick a date and time for both — end has to come after start. If the shift overlaps something already on your calendar, the form says so before you can post it.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-wall-toggle"]',
      popover: {
        title: 'This is the switch',
        description:
          'Leave this section alone and the shift is <strong>calendar-only</strong> — nobody else sees it. Open it to put the shift in front of your board.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-types"]',
      popover: {
        title: 'How do you want to move it?',
        description:
          '<strong>Giveaway</strong> — you’ll hand it over. <strong>Trade</strong> — you want a shift back. Tick both if either works, and the card shows a single Give/Trade badge. <strong>OT Approved</strong> only if a Manager has cleared it as overtime. Tick nothing and it stays off the Wall.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-details"]',
      popover: {
        title: 'The line that saves you a conversation',
        description:
          'One bit of context does a lot of work here — “leaving early for a flight”, “will trade for any Tuesday”. Optional, but it heads off the obvious questions.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-bundle"]',
      popover: {
        title: 'Shifts that travel together',
        description:
          'Got a three-day block that can only be given as a set? Bundle them, and whoever takes it takes all of them — not just a single one.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-add"]',
      popover: {
        title: 'More than one?',
        description:
          'Add another shift and post the lot in one go. Each one still gets its own spot on your calendar or a card on the Wall. Or, next you’ll learn about the calendar where you can import your entire schedule from a single photo or screenshot.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="post-submit"]',
      data: { handoff: 'calendar' } satisfies HandoffData,
      popover: {
        title: 'That’s the whole thing',
        description:
          'Post it and it’s live for your board immediately — and anyone whose open request matches the date and time is notified automatically. You can edit it or pull it back any time from the ⋮ menu on your card.',
        side: 'top',
        align: 'end',
        doneBtnText: 'Next: your calendar →',
      },
    },
  ],
}

const calendarChapter: TourChapterDef = {
  id: 'calendar',
  path: '/calendar',
  label: 'Your calendar',
  blurb: 'Your shifts, your board’s activity, and importing a schedule from a photo.',
  readySelector: '[data-tour="cal-legend"]',
  settleSelector: '[data-tour="cal-shift"]',
  steps: () => [
    {
      popover: {
        title: 'My Calendar',
        description:
          'Every shift you own lives here — the ones you’ve posted and the ones you’re just keeping track of. The sample shifts on it right now are part of this tour and disappear when it ends.',
      },
    },
    {
      element: sampleFirst('[data-tour="cal-shift"]'),
      popover: {
        title: 'Your shifts',
        description:
          'Each block is one of your shifts, colour-coded the same way the Wall is. Tap one to edit it; tap any empty day to add a shift on that date.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: sampleFirst('[data-tour="cal-dots"]'),
      popover: {
        title: 'What your board is up to',
        description:
          'These dots are shifts or requests from other users from your boards for that day. Tap a dot to jump to the Wall filtered to that date to see what’s available.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="cal-legend"]',
      popover: {
        title: 'Reading the dots',
        description:
          'Purple is trade + giveaway, blue is trade, green is giveaway, orange is somebody’s open request.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="cal-view"]',
      popover: {
        title: 'Grid or list',
        description:
          'The month grid is good for spotting gaps; the list runs today forward and tends to read better on a phone. Your choice is remembered.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="cal-import"]',
      popover: {
        title: 'Skip the typing',
        description:
          'Snap a photo of the posted schedule — paper or a screenshot — and your shifts are read from it in seconds. You can make sure it’s correct and edit everything before any of it is saved.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="cal-sync"]',
      data: { handoff: 'messages' } satisfies HandoffData,
      popover: {
        title: 'Take it with you',
        description:
          'Connect your WDWShiftX calendar to your own personal calendar app, so your shifts sit alongside the rest of your life.',
        side: 'bottom',
        align: 'end',
        doneBtnText: 'Next: messages →',
      },
    },
  ],
}

const messagesChapter: TourChapterDef = {
  id: 'messages',
  path: '/messages',
  label: 'Messages',
  blurb: 'Private chats for working out the details of a handoff.',
  readySelector: '[data-tour="msg-start"]',
  settleSelector: '[data-tour="msg-row"]',
  steps: () => [
    {
      popover: {
        title: 'Messages',
        description:
          'Working out a handoff usually takes a couple of back-and-forths. That happens here, privately — board moderators can’t read your chats.',
      },
    },
    {
      element: '[data-tour="msg-list"]',
      popover: {
        title: 'Your conversations',
        description:
          'Newest first, with the last thing either of you said. A preview starting with <strong>You:</strong> means the ball is in their court. (These two are samples — they go away with the tour.)',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: sampleFirst('[data-tour="msg-unread"]'),
      popover: {
        title: 'Unread',
        description:
          'A badge here means messages you haven’t opened, and the same dot shows on Messages in the navigation so you can spot it from anywhere.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: sampleFirst('[data-tour="msg-delete"]'),
      popover: {
        title: 'Clearing a chat',
        description:
          'This removes the conversation from <em>your</em> list only — the other person keeps their copy. If either of you writes again, it comes back without the old history.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="msg-start"]',
      popover: {
        title: 'Starting one',
        description:
          'You can message anyone who shares a board with you — this opens a searchable directory of them. You can also start a chat straight from a post, using <strong>Message</strong> on the card.',
        side: 'bottom',
        align: 'end',
        doneBtnText: 'Finish tour',
      },
    },
  ],
}

export const TOUR_CHAPTERS: Record<TourChapter, TourChapterDef> = {
  wall: wallChapter,
  'post-shift': postShiftChapter,
  calendar: calendarChapter,
  messages: messagesChapter,
}

/**
 * Chapter order as the tour runs it. Starting at any one of these is fine —
 * each hands off to the next when it finishes, so picking "Your calendar"
 * carries on into Messages rather than dead-ending.
 */
export const TOUR_CHAPTER_ORDER: readonly TourChapter[] = [
  'wall', 'post-shift', 'calendar', 'messages',
]

/**
 * Drops steps whose target isn't on the page right now — a Wall with no posts
 * has no card to point at, a single-board member has no board picker. Filtering
 * up front (rather than leaning on driver.js's `skipMissingElement` alone)
 * keeps the "3 of 9" progress honest.
 */
export function buildSteps(chapter: TourChapterDef): DriveStep[] {
  return chapter.steps().filter(step => {
    if (!step.element) return true
    if (typeof step.element === 'function') return !!step.element()
    if (typeof step.element === 'string') return !!findTarget(step.element)
    return true
  })
}
