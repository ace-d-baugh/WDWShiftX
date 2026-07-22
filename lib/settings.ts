const KEY = 'wdwshiftx-settings'

export type WeekStart  = 0 | 1 | 6          // 0=Sun, 1=Mon, 6=Sat
export type DateFormat = 'mdy' | 'dmy'       // MM/DD or DD/MM
export type TimeFormat = '12h' | '24h'

export interface UserSettings {
  weekStart:  WeekStart
  dateFormat: DateFormat
  timeFormat: TimeFormat
  timezone:   string     // IANA timezone string e.g. "America/New_York"
}

export const DEFAULT_SETTINGS: UserSettings = {
  weekStart:  0,
  dateFormat: 'mdy',
  timeFormat: '12h',
  timezone:   'America/New_York',
}

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(patch: Partial<UserSettings>): UserSettings {
  const next = { ...getSettings(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  return next
}

/** Format an ISO time string using the user's 12h/24h preference (ET) */
export function fmtTime(iso: string, fmt: TimeFormat, tz = 'America/New_York'): string {
  // Called only client-side so dynamic import is fine
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour:   'numeric',
    minute: '2-digit',
    hour12: fmt === '12h',
    timeZone: tz,
  })
}
