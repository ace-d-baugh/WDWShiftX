import { formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import type { ShiftData } from '@/components/features/ShiftCard'
import type { RequestData } from '@/components/features/RequestCard'
import type { ShareCardData } from '@/components/features/ShareCard'
import type { PreferredTime } from '@/lib/database.types'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wdwshiftx.com'

const TIME_ORDER: PreferredTime[] = ['morning', 'afternoon', 'evening', 'late']
const timeLabels: Record<PreferredTime, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', late: 'Late Night',
}

export function wallPostShareUrl(id: string): string {
  return `${BASE_URL}/wall?post=${id}`
}

/**
 * Reads a theme color straight off the live document instead of hand-picking
 * a hex approximation — this app ships many themes (see app/globals.css:
 * default, dark, cyberpunk, nordic, christmas, patriotic, ...) with wildly
 * different values for the same token, so a hardcoded hex would only ever
 * match one of them. Same reasoning as the Help page's Legend, which builds
 * its swatches from the real badge classes rather than approximating them.
 */
function themeColor(cssVar: string): string {
  if (typeof window === 'undefined') return '#9CA3AF'
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim()
  return raw ? `hsl(${raw})` : '#9CA3AF'
}

/**
 * Reads the real computed bg/text colors for a badge class combo by
 * instantiating one off-screen and asking the browser — covers cases
 * themeColor() can't (the Trade/Giveaway/OT badges hardcode/override colors
 * per theme in app/globals.css, e.g. .dark .badge-trade and
 * .theme-cyberpunk .badge-ot, not a single custom property to read
 * directly), so this is the only way to match every theme exactly.
 */
function readBadgeColors(className: string): { bg: string; color: string } {
  if (typeof document === 'undefined') return { bg: '#e5e7eb', color: '#374151' }
  const el = document.createElement('span')
  el.className = className
  el.style.position = 'fixed'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  document.body.appendChild(el)
  const cs = getComputedStyle(el)
  const result = { bg: cs.backgroundColor, color: cs.color }
  document.body.removeChild(el)
  return result
}

export function buildShiftShareData(
  shift: ShiftData, tz: string, timeFormat: '12h' | '24h'
): ShareCardData {
  const timePat = timeFormat === '24h' ? 'HH:mm' : 'h:mm a'
  const start = formatInTimeZone(parseISO(shift.start_time), tz, timePat)
  const end = formatInTimeZone(parseISO(shift.end_time), tz, timePat)
  const dateLabel = formatInTimeZone(parseISO(shift.start_time), tz, 'EEE, MMM d')

  // The image's left-border accent matches the exact hue the live card's
  // title/border use for this type (--color-primary/-info/-success — see
  // ShiftCard's typeColor/borderColor), not the separate OT badge. Falls
  // back to --color-text for the edge case of a shift with neither flag set
  // (shouldn't reach the Wall, but the accent still needs a value).
  const badges: ShareCardData['badges'] = []
  let accentColor = themeColor('--color-text')
  if (shift.is_trade && shift.is_giveaway) {
    badges.push({ label: 'Give/Trade', ...readBadgeColors('badge bg-primary/20 text-primary') })
    accentColor = themeColor('--color-primary')
  } else if (shift.is_trade) {
    badges.push({ label: 'Trade', ...readBadgeColors('badge badge-trade') })
    accentColor = themeColor('--color-info')
  } else if (shift.is_giveaway) {
    badges.push({ label: 'Giveaway', ...readBadgeColors('badge badge-giveaway') })
    accentColor = themeColor('--color-success')
  }
  if (shift.is_overtime_approved) badges.push({ label: 'OT', ...readBadgeColors('badge badge-ot') })

  return {
    type: 'shift',
    title: shift.shift_title,
    boardName: shift.board_name,
    dateLabel,
    timeLabel: `${start} → ${end}`,
    details: shift.details,
    badges,
    posterName: shift.created_by,
    accentColor,
  }
}

export function buildRequestShareData(request: RequestData): ShareCardData {
  const dateLabel = formatInTimeZone(`${request.requested_date}T12:00:00Z`, 'America/New_York', 'EEE, MMM d')
  const timeLabel = [...request.preferred_times]
    .sort((a, b) => TIME_ORDER.indexOf(a) - TIME_ORDER.indexOf(b))
    .map(t => timeLabels[t])
    .join(', ')

  return {
    type: 'request',
    title: request.request_title,
    boardName: request.board_name,
    dateLabel,
    timeLabel,
    details: request.details,
    badges: [{ label: 'Request', ...readBadgeColors('badge bg-accent/20 text-text') }],
    posterName: request.created_by,
    // Requests use one fixed color regardless of type — see RequestCard's
    // border-l-accent/text-accent, no typeColor branching like shifts.
    accentColor: themeColor('--color-accent'),
  }
}

export function buildShareText(data: ShareCardData, url: string): string {
  const lines = [
    data.title,
    `${data.boardName} • ${data.dateLabel}, ${data.timeLabel}`,
  ]
  if (data.details) lines.push('', `"${data.details}"`)
  lines.push('', 'Found on WDWShiftX', url)
  return lines.join('\n')
}
