/**
 * Purely decorative "for fun" date badges for 2026's special-ticketed-event
 * season — shown on the Wall's day headers and the Calendar so members can
 * see at a glance which days have MNSSHP, HHN, or MVMCP running. Not tied to
 * any shift/request data; just a lookup by date.
 *
 * MNSSHP and HHN can land on the same night (both badges show); MVMCP's
 * earliest date (Nov 8) is after HHN's last (Nov 1), so it never needs to
 * share a day with either — two badges is the real-world max for any date.
 */

export interface SpecialEventBadge {
  emoji: string
  label: string
  /** The acronym shown in parentheses next to the long name — Party Legend
   *  modal and the Help page's own Legend section. */
  shortLabel: string
}

const MNSSHP: SpecialEventBadge = { emoji: '🎃', label: "Mickey's Not So Scary Halloween Party", shortLabel: 'MNSSHP' }
const HHN: SpecialEventBadge = { emoji: '🧟‍♂️', label: 'Halloween Horror Nights', shortLabel: 'HHN' }
const MVMCP: SpecialEventBadge = { emoji: '🎄', label: "Mickey's Very Merry Christmas Party", shortLabel: 'MVMCP' }

/** All three, in the order they run through the season — used by the Party
 *  Legend modal and the Help page's Legend, independent of any date. */
export const ALL_SPECIAL_EVENT_BADGES: readonly SpecialEventBadge[] = [MNSSHP, HHN, MVMCP]

// Keyed "yyyy-MM" -> day-of-month numbers.
const MNSSHP_DAYS: Record<string, number[]> = {
  '2026-08': [7, 11, 14, 18, 21, 23, 25, 28, 30],
  '2026-09': [1, 4, 8, 11, 13, 15, 18, 20, 22, 24, 25, 27, 29],
  '2026-10': [1, 2, 4, 6, 8, 9, 13, 15, 16, 18, 22, 23, 25, 27, 29, 31],
}

const HHN_DAYS: Record<string, number[]> = {
  '2026-08': [28, 29, 30],
  '2026-09': [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 30],
  '2026-10': [1, 2, 3, 4, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 28, 29, 30, 31],
  '2026-11': [1],
}

const MVMCP_DAYS: Record<string, number[]> = {
  '2026-11': [8, 9, 12, 13, 15, 17, 19, 20, 24, 25, 27, 29],
  '2026-12': [1, 3, 4, 6, 8, 10, 11, 13, 15, 17, 18, 20, 22],
}

function buildLookup(
  daysByMonth: Record<string, number[]>,
  badge: SpecialEventBadge,
  into: Map<string, SpecialEventBadge[]>
): void {
  for (const [monthKey, days] of Object.entries(daysByMonth)) {
    for (const day of days) {
      const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`
      const list = into.get(dateStr) ?? []
      list.push(badge)
      into.set(dateStr, list)
    }
  }
}

const BADGES_BY_DATE = new Map<string, SpecialEventBadge[]>()
buildLookup(MNSSHP_DAYS, MNSSHP, BADGES_BY_DATE)
buildLookup(HHN_DAYS, HHN, BADGES_BY_DATE)
buildLookup(MVMCP_DAYS, MVMCP, BADGES_BY_DATE)

/** Badges (0-2) for a given "yyyy-MM-dd" date, or an empty array. */
export function getSpecialEventBadges(dateStr: string): SpecialEventBadge[] {
  return BADGES_BY_DATE.get(dateStr) ?? []
}
