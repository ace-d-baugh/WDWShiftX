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

export function buildShiftShareData(
  shift: ShiftData, tz: string, timeFormat: '12h' | '24h'
): ShareCardData {
  const timePat = timeFormat === '24h' ? 'HH:mm' : 'h:mm a'
  const start = formatInTimeZone(parseISO(shift.start_time), tz, timePat)
  const end = formatInTimeZone(parseISO(shift.end_time), tz, timePat)
  const dateLabel = formatInTimeZone(parseISO(shift.start_time), tz, 'EEE, MMM d')

  // The image's left-border accent tracks the same type this badge reflects
  // (not the separate OT badge) — falls back to gray for the edge case of a
  // shift with neither flag set (shouldn't reach the Wall, but the accent
  // still needs a value).
  const badges: ShareCardData['badges'] = []
  let accentColor = '#9CA3AF'
  if (shift.is_trade && shift.is_giveaway) {
    badges.push({ label: 'Give/Trade', bg: '#EDE9FE', color: '#6D28D9' })
    accentColor = '#6D28D9'
  } else if (shift.is_trade) {
    badges.push({ label: 'Trade', bg: '#DBEAFE', color: '#1D4ED8' })
    accentColor = '#1D4ED8'
  } else if (shift.is_giveaway) {
    badges.push({ label: 'Giveaway', bg: '#DCFCE7', color: '#15803D' })
    accentColor = '#15803D'
  }
  if (shift.is_overtime_approved) badges.push({ label: 'OT', bg: '#FEF3C7', color: '#92400E' })

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
    badges: [{ label: 'Request', bg: '#FFEDD5', color: '#9A3412' }],
    posterName: request.created_by,
    accentColor: '#9A3412',
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
