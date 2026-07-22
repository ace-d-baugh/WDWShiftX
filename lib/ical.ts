// Minimal iCalendar (RFC 5545) generation for the shift feed — small enough
// that a dependency isn't warranted. Times are emitted in UTC (Z suffix) so
// no VTIMEZONE block is needed; calendar apps convert to the viewer's zone.

export interface IcalEvent {
  /** Stable unique ID — the shift's row id. */
  uid: string
  /** ISO timestamps (any zone — converted to UTC). */
  start: string
  end: string
  summary: string
  description?: string
  url?: string
}

/** 20260704T211500Z */
function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** Escape per RFC 5545 §3.3.11: backslash, semicolon, comma, newline. */
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/**
 * Fold lines longer than 75 octets with CRLF + space continuation.
 * Splits on UTF-8 byte length so multi-byte characters never straddle a fold.
 */
function fold(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ''
  let currentBytes = 0
  let limit = 75
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length
    if (currentBytes + chBytes > limit) {
      out.push(current)
      current = ' '
      currentBytes = 1
      limit = 75
    }
    current += ch
    currentBytes += chBytes
  }
  out.push(current)
  return out.join('\r\n')
}

export function buildIcsCalendar(opts: { calendarName: string; events: IcalEvent[] }): string {
  const now = toIcsUtc(new Date().toISOString())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WDWShiftX//Shift Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.calendarName)}`,
    // Hint how often subscribers should re-fetch (support varies by app)
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const ev of opts.events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${esc(ev.uid)}@wdwshiftx.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsUtc(ev.start)}`,
      `DTEND:${toIcsUtc(ev.end)}`,
      `SUMMARY:${esc(ev.summary)}`,
    )
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`)
    if (ev.url) lines.push(`URL:${esc(ev.url)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
