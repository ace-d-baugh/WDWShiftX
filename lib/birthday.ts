const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Formats a partial or full birthday for display. A year on its own (with no
 * month/day) isn't meaningful to show, so it returns null unless both month
 * and day are present.
 */
export function formatBirthday(
  month: number | null | undefined,
  day: number | null | undefined,
  year: number | null | undefined
): string | null {
  if (!month || !day) return null
  const monthName = MONTH_NAMES[month - 1]
  if (!monthName) return null
  return year ? `${monthName} ${day}, ${year}` : `${monthName} ${day}`
}

export function daysInMonth(month: number | null | undefined, year: number | null | undefined): number {
  if (!month) return 31
  return new Date(year ?? 2024, month, 0).getDate()
}

export { MONTH_NAMES }
