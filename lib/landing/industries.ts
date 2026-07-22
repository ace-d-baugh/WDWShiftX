import type { LucideIcon } from 'lucide-react'
import { RefreshCw, Gift, Clock, Shield, Zap, AlertTriangle, MessageSquareOff, CalendarClock } from 'lucide-react'

export interface IndustryPainPoint {
  icon: LucideIcon
  title: string
  body: string
}

export interface IndustrySolution {
  icon: LucideIcon
  title: string
  body: string
}

export interface Industry {
  slug: string
  /** Short label used in the "Built For Any Workplace" chip list on the home page. */
  shortName: string
  metaTitle: string
  metaDescription: string
  heroKicker: string
  /** Rendered before the highlighted word in the H1. */
  heroHeadlinePrefix: string
  /** The highlighted (colored, underlined) word or phrase in the H1. */
  heroHeadlineHighlight: string
  heroSubcopy: string
  painPointsIntro: string
  painPoints: IndustryPainPoint[]
  solutionsIntro: string
  solutions: IndustrySolution[]
  ctaHeadline: string
  ctaSubcopy: string
  /** Scheduling apps this industry knows — name-dropped in the photo-import section. */
  scheduleApps: string[]
}

// Copy voice: always the employee's perspective. These pages convert the
// worker who spins up a board for their team — never a manager evaluating
// software. No "your manager", no "leadership oversight", no enterprise
// framing anywhere.
export const INDUSTRIES: Industry[] = [
  {
    slug: 'retail',
    shortName: 'Retail Stores',
    metaTitle: 'Shift Swap App for Retail Associates – WDWShiftX',
    metaDescription:
      'Stop texting twenty coworkers to cover a shift. Post open shifts, pick up extra hours, and swap with other associates in minutes.',
    heroKicker: 'Built for Retail Associates',
    heroHeadlinePrefix: 'Get Your',
    heroHeadlineHighlight: 'Weekend Back',
    heroSubcopy:
      "When you need a shift covered for a floor set, inventory night, or a weekend off, you shouldn't have to text twenty coworkers individually. Post it to the board, let the right people see it, and lock in coverage fast — no texting marathon.",
    painPointsIntro: 'If any of this sounds familiar, you already know why we built this.',
    painPoints: [
      {
        icon: AlertTriangle,
        title: 'A call-out turns into a scramble',
        body: "One person doesn't show, everyone's phone blows up, and the floor runs short-handed while the texts go unanswered. Hours pass before the shift is covered — or it never is.",
      },
      {
        icon: MessageSquareOff,
        title: 'The group chat is where shifts go to die',
        body: 'Dropping a shift into a massive GroupMe or iMessage thread means it gets buried under memes and chat noise — the coworkers who actually want the hours never even see it.',
      },
      {
        icon: CalendarClock,
        title: 'Your availability never quite matches the schedule',
        body: 'You updated your availability weeks ago, but the system — or the person entering it — is always a step behind. So you\'re back to hunting for a trade by hand.',
      },
    ],
    solutionsIntro: 'How WDWShiftX fixes it',
    solutions: [
      {
        icon: RefreshCw,
        title: 'Post it the moment you know',
        body: "Can't make a shift? Post it as an offer the second you know, instead of waiting to see if anyone answers a text.",
      },
      {
        icon: Gift,
        title: 'Pick up hours when you want more',
        body: 'Want extra hours this week? Browse open shifts from associates at your store and grab the ones that fit.',
      },
      {
        icon: Shield,
        title: 'Clean, organized, and visible',
        body: 'Every offer and pickup lives on one board your whole team can see — nothing gets buried, double-booked, or lost in a thread.',
      },
    ],
    ctaHeadline: 'Stop chasing coverage. Start posting it.',
    ctaSubcopy: 'Free for associates. Set up your board in minutes.',
    scheduleApps: ['UKG', 'Kronos', 'Workday', 'Deputy'],
  },
  {
    slug: 'restaurants',
    shortName: 'Restaurants',
    metaTitle: 'Shift Swap App for Restaurant Staff – WDWShiftX',
    metaDescription:
      'Front of house, back of house, servers, cooks — trade doubles and closing shifts without the group chat chaos or the breakroom printout.',
    heroKicker: 'Built for FOH & BOH',
    heroHeadlinePrefix: 'Trade Your Double.',
    heroHeadlineHighlight: 'Claim the Close.',
    heroSubcopy:
      'Front-of-house or back-of-house, restaurant schedules are chaotic. Stop relying on paper logs by the POS terminal or frantic text threads. Post your shift, swap seamlessly, and keep your kitchen or floor fully staffed.',
    painPointsIntro: 'The stuff that makes "the schedule" a dirty word',
    painPoints: [
      {
        icon: Clock,
        title: 'The clopening nobody wants',
        body: "Closing the night before opening the next morning barely leaves time to sleep, let alone handle a kid, a second job, or a life. Swapping out of one shouldn't take a miracle.",
      },
      {
        icon: MessageSquareOff,
        title: 'Coverage lives and dies in a group chat',
        body: "Someone posts \"can anyone cover Friday close??\" into a GroupMe with forty people in it and hopes for the best. Half the time nobody sees it in time.",
      },
      {
        icon: CalendarClock,
        title: 'The breakroom printout problem',
        body: "Need to drop a lunch shift to study, or pick up an extra dinner double? Don't hope someone checks the printout by the kitchen — half the staff won't see it until it's too late.",
      },
    ],
    solutionsIntro: 'How WDWShiftX fixes it',
    solutions: [
      {
        icon: RefreshCw,
        title: 'Post the shift, not a group text',
        body: 'Offer a shift once and every FOH or BOH teammate on the board sees it — no more hoping the right person scrolls past your message in time.',
      },
      {
        icon: Gift,
        title: 'Request coverage for the shifts you dread',
        body: "Need out of a clopening? Post a request with your preferred time window and let people come to you.",
      },
      {
        icon: Shield,
        title: 'Server shifts go to servers',
        body: 'Roles keep the board sane: servers see server shifts, line cooks see kitchen shifts. No accidental cross-scheduling chaos.',
      },
    ],
    ctaHeadline: 'Get your life back from the clopening.',
    ctaSubcopy: 'Free for FOH and BOH staff. Takes two minutes to set up.',
    scheduleApps: ['7shifts', 'HotSchedules', 'Toast'],
  },
  {
    slug: 'warehouses',
    shortName: 'Warehouses',
    metaTitle: 'Shift Swap App for Warehouse Associates – WDWShiftX',
    metaDescription:
      'Rigid crews, mandatory overtime, and attendance points on the line — coordinate trades instantly with qualified teammates before your shift starts.',
    heroKicker: 'Built for Warehouse Associates',
    heroHeadlinePrefix: 'Own Your Shift.',
    heroHeadlineHighlight: 'Protect Your Metrics.',
    heroSubcopy:
      'Warehouse schedules are rigid, and missing a shift can cost you attendance points. When mandatory overtime hits or you need coverage for a night shift, WDWShiftX lets you coordinate trades instantly with qualified teammates.',
    painPointsIntro: 'What working the schedule actually feels like',
    painPoints: [
      {
        icon: Clock,
        title: 'The good shifts are gone in seconds',
        body: 'Weekday mornings get claimed almost instantly, leaving nights and weekends for whoever was too slow. Flex means competing against everyone else on shift, every single week.',
      },
      {
        icon: AlertTriangle,
        title: 'One conflict can cost you points',
        body: "Attendance systems don't care why you missed — childcare, car trouble, a class that moved. It hits your record the same. Finding coverage before your shift starts shouldn't be a long shot.",
      },
      {
        icon: CalendarClock,
        title: "VTO and VET aren't something you can count on",
        body: "Voluntary time off and extra hours show up when they show up — there's no way to plan around them, and no easy way to trade into a shift that actually works for you.",
      },
    ],
    solutionsIntro: 'How WDWShiftX fixes it',
    solutions: [
      {
        icon: RefreshCw,
        title: 'One board, every open shift',
        body: 'See every shift offer and request from other associates in one place instead of piecing it together from texts and word of mouth.',
      },
      {
        icon: Shield,
        title: 'Only qualified teammates see it',
        body: 'Filter by role so specialized shifts — forklift-certified, specific lines, tier leads — are only visible to people actually signed off to work them.',
      },
      {
        icon: Gift,
        title: 'Request the days you need off',
        body: 'Post exactly what you need — day, time window, role — and let other associates come to you instead of chasing down a trade yourself.',
      },
    ],
    ctaHeadline: 'Stop losing shifts to whoever was faster.',
    ctaSubcopy: 'Free for warehouse associates. Set up your board in minutes.',
    scheduleApps: ['UKG', 'Kronos', 'Workday', 'Deputy'],
  },
  {
    slug: 'hotels',
    shortName: 'Hotels & Resorts',
    metaTitle: 'Shift Swap App for Hotel & Resort Staff – WDWShiftX',
    metaDescription:
      'Front desk, housekeeping, F&B, valet — 24/7 schedules across departments that never see each other. Coordinate trades in one centralized hub.',
    heroKicker: 'Built for Front Desk, Housekeeping & F&B',
    heroHeadlinePrefix: 'Keep the 24/7 Schedule',
    heroHeadlineHighlight: 'Moving Smoothly',
    heroSubcopy:
      "From the front desk to housekeeping, resort teams work around the clock. When departments are scattered across the property, finding coverage shouldn't mean hunting down phone numbers. Coordinate trades effortlessly in one centralized hub.",
    painPointsIntro: 'Five schedules, one exhausted staff',
    painPoints: [
      {
        icon: AlertTriangle,
        title: 'Call-outs are just part of the day',
        body: 'On a team of thirty, one or two people not showing up is normal, not rare. Somebody still has to cover the gap every single time — and it\'s usually whoever answers their phone first.',
      },
      {
        icon: MessageSquareOff,
        title: 'Departments live in different worlds',
        body: "Housekeeping and front desk barely cross paths during a workday — but when you need coverage, you're somehow expected to know who's free and hunt down their number.",
      },
      {
        icon: Clock,
        title: 'The 3 AM coverage problem',
        body: "An overnight audit or early-morning open needs covering, and there's no good way to ask — a group text at 3 AM wakes the whole team, and waiting until morning is too late.",
      },
    ],
    solutionsIntro: 'How WDWShiftX fixes it',
    solutions: [
      {
        icon: RefreshCw,
        title: 'Your department, one dedicated board',
        body: 'Spin up a board for your team — front desk, housekeeping, banquets — and every open shift reaches the right people, no matter what hours or floors they work.',
      },
      {
        icon: Zap,
        title: 'Filter by role and property',
        body: "See shifts relevant to your role and property, so front desk isn't wading through housekeeping postings and vice versa.",
      },
      {
        icon: Gift,
        title: 'Get the word out without waking anyone',
        body: 'Post the overnight or early-open you need covered and the board carries it quietly — teammates see it when they check in, no 3 AM group text required.',
      },
    ],
    ctaHeadline: 'Cover the gap without the group chat scramble.',
    ctaSubcopy: 'Free for hotel and resort staff. Set up your board in minutes.',
    scheduleApps: ['UKG', 'Kronos', 'Workday', 'Deputy'],
  },
  {
    slug: 'theme-parks',
    shortName: 'Theme Parks',
    metaTitle: 'Shift Swap App for Theme Park Team Members – WDWShiftX',
    metaDescription:
      'Attraction-specific training, regular-time-for-regular-time trades, and a call board that goes stale — WDWShiftX matches trades to qualified peers.',
    heroKicker: 'Built for Attractions & Park Teams',
    heroHeadlinePrefix: 'Clear Qualifications.',
    heroHeadlineHighlight: 'Faster Coverage.',
    heroSubcopy:
      "Park schedules are complex, and you can't just trade with anyone — they have to be trained on your exact attraction, venue, or land. WDWShiftX filters your trades by precise roles and locations, so your shift is only seen by cross-trained peers.",
    painPointsIntro: 'What trading a shift actually looks like right now',
    painPoints: [
      {
        icon: AlertTriangle,
        title: 'Matching trades by hand is a headache',
        body: "A regular-time shift can only trade for another regular-time shift, and overtime only trades for overtime. Finding the right match usually means asking around and hoping.",
      },
      {
        icon: Shield,
        title: 'Qualified-only is the whole game',
        body: 'Posting "can anyone take my closing shift?" is useless if the person who answers isn\'t signed off on your console. Every trade starts with the same question: are you even trained here?',
      },
      {
        icon: Clock,
        title: "The call board doesn't update in real time",
        body: 'Open shifts get released in phases and go stale fast — by the time you check, the good ones are already gone.',
      },
    ],
    solutionsIntro: 'How WDWShiftX fixes it',
    solutions: [
      {
        icon: RefreshCw,
        title: 'Real-time board, not a static list',
        body: 'Browse and post shift offers as they happen — no waiting for the next scheduled call board update.',
      },
      {
        icon: Zap,
        title: 'Filter by role, line, and proficiency',
        body: 'Your shift is only seen by peers signed off on the same attraction, venue, or land — no dead-end offers from people who aren\'t trained on your console.',
      },
      {
        icon: CalendarClock,
        title: 'One calendar across every land',
        body: 'Work multiple locations or rotate mid-shift? Every shift you pick up lands on one unified, auto-updating calendar, wherever on property it is.',
      },
    ],
    ctaHeadline: 'Make trading a shift as easy as posting it.',
    ctaSubcopy: 'Free for team members. Set up your board in minutes.',
    scheduleApps: ['Workday', 'UKG', 'Kronos'],
  },
  {
    slug: 'event-venues',
    shortName: 'Event Venues',
    metaTitle: 'Shift Swap App for Event & Venue Staff – WDWShiftX',
    metaDescription:
      'Stadium, arena, and theater schedules change with every booking. Trade, drop, and pick up gigs instantly with your venue crew.',
    heroKicker: 'Built for Event & Venue Crews',
    heroHeadlinePrefix: 'Match Your Schedule to',
    heroHeadlineHighlight: 'the Event Calendar',
    heroSubcopy:
      "Stadium, arena, and theater schedules change with every booking. When a show gets added or you need to drop a game-day shift, don't scramble — trade, drop, and pick up gigs instantly with your venue crew.",
    painPointsIntro: 'The reality of working a rotating event calendar',
    painPoints: [
      {
        icon: AlertTriangle,
        title: 'Last-minute call-outs are the norm, not the exception',
        body: "Part-time and gig crew juggle multiple venues and jobs, so someone dropping a call time close to half hour happens constantly.",
      },
      {
        icon: MessageSquareOff,
        title: 'Coverage gets coordinated across a dozen threads',
        body: 'Group texts, emails, agency messages — by the time everyone sees the same information, half the crew has already missed it.',
      },
      {
        icon: CalendarClock,
        title: 'The calendar changes with every tour',
        body: 'Event schedules move with tour dates and game times. When your hours are this unpredictable, a missed post in a thread is a missed paycheck.',
      },
    ],
    solutionsIntro: 'How WDWShiftX fixes it',
    solutions: [
      {
        icon: RefreshCw,
        title: 'One board for every open call',
        body: "Post an open shift once and every crew member on the board sees it immediately, instead of it getting lost in a thread.",
      },
      {
        icon: Zap,
        title: 'Filter by role and venue',
        body: 'See only the calls relevant to your role and location — not every shift across every event.',
      },
      {
        icon: Gift,
        title: 'Extra shifts, no email blast',
        body: 'When a big show drops extra calls, they hit the Wall the moment they\'re posted — check the board and claim your spot before the mass email even goes out.',
      },
    ],
    ctaHeadline: 'Fill the call before half hour, not after.',
    ctaSubcopy: 'Free for event and venue crews. Set up your board in minutes.',
    scheduleApps: ['ABI MasterMind', 'Shiftboard', 'UKG'],
  },
]

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find(i => i.slug === slug)
}
