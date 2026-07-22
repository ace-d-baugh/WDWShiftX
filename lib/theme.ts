export type Theme =
  | 'light' | 'dark' | 'midnight' | 'cyberpunk' | 'nordic' | 'kitty'
  | 'christmas' | 'halloween' | 'patriotic'

export const THEME_STORAGE_KEY = 'wdwshiftx-theme'

export interface ThemeInfo {
  id: Theme
  label: string
  description: string
  pro: boolean
  /**
   * Never rendered in the picker for anyone but the global Admin ("Overlord")
   * role — not a Pro perk, just hidden entirely from every other user. See
   * `visibleThemes()`. Note this hides it from the UI only: the CSS/labels
   * still ship in the normal client bundle like every other theme (no
   * per-role code splitting), so it's a presentation gate, not a secret.
   */
  adminOnly?: boolean
  /** Swatch colors for the theme picker preview. */
  preview: { bg: string; accent: string; text: string }
}

// Order here is the picker's DOM/tab order — kept as "light family, then dark
// family" (light, nordic, kitty, dark, midnight, cyberpunk) to match the
// desktop 3-col visual layout; ProfileClient's THEME_GRID_POSITION overrides
// visual placement per breakpoint so mobile's 2-col layout groups the same
// way (light themes together, dark themes together) despite the different
// column count. The three adminOnly themes render in their own separate
// section (Overlord only), so their order here doesn't interact with that map.
export const THEMES: ThemeInfo[] = [
  { id: 'light',     label: 'Light',     description: 'The classic WDWShiftX look',                  pro: false, preview: { bg: '#FFFFFF', accent: '#BD80FF', text: '#2F2040' } },
  { id: 'nordic',    label: 'Nordic',    description: 'Muted sage, cream, and slate',               pro: true,  preview: { bg: '#F7F4EC', accent: '#5E8570', text: '#3C4650' } },
  { id: 'kitty',     label: 'Kitty',     description: 'Soft pastels — mint, sky, lavender & blush',  pro: true,  preview: { bg: '#FBF3FB', accent: '#C9A6F5', text: '#3D2E52' } },
  { id: 'dark',      label: 'Dark',      description: 'Easy on the eyes',                           pro: false, preview: { bg: '#191023', accent: '#BD80FF', text: '#E9E3F2' } },
  { id: 'midnight',  label: 'Midnight',  description: 'True OLED black — saves battery on mobile',  pro: true,  preview: { bg: '#000000', accent: '#BD80FF', text: '#EBEBEB' } },
  { id: 'cyberpunk', label: 'Cyberpunk', description: 'Neon on black, monospace edge',              pro: true,  preview: { bg: '#060213', accent: '#FF2ED2', text: '#7CFCE0' } },
  { id: 'christmas', label: 'Christmas', description: 'Pine, candy-cane red, and gold lights',       pro: false, adminOnly: true, preview: { bg: '#0D1F16', accent: '#D93F4C', text: '#F2EAD9' } },
  { id: 'halloween', label: 'Halloween', description: 'Pumpkin orange and witching-hour purple',     pro: false, adminOnly: true, preview: { bg: '#0F0A1A', accent: '#F2932E', text: '#EFE5D8' } },
  { id: 'patriotic', label: 'Patriotic', description: 'Old Glory red, white, and blue',              pro: false, adminOnly: true, preview: { bg: '#FDFDFD', accent: '#1E52B8', text: '#1E2A44' } },
]

/** Themes built on the dark palette — they carry the `dark` class so every `.dark` style applies. */
const DARK_BASED: readonly Theme[] = ['dark', 'midnight', 'cyberpunk', 'christmas', 'halloween']

/** Themes that add their own `theme-<id>` class on top of the light/dark base. */
const CLASSED: readonly Theme[] = ['midnight', 'cyberpunk', 'nordic', 'kitty', 'christmas', 'halloween', 'patriotic']

export function isTheme(value: unknown): value is Theme {
  return THEMES.some(t => t.id === value)
}

export function isProTheme(theme: Theme): boolean {
  return THEMES.find(t => t.id === theme)?.pro ?? false
}

/**
 * The free theme a Pro theme falls back to when a non-Pro user lands on it
 * (e.g. after downgrading). A downgraded member keeps their look everywhere
 * else — this only fires on the Profile page, which re-checks Pro status and
 * reverts. Dark-based Pro themes (Midnight, Cyberpunk) fall back to Dark;
 * light-based ones (Nordic, Kitty) fall back to Light. Non-Pro themes are
 * returned unchanged.
 */
export function freeThemeFallback(theme: Theme): Theme {
  if (!isProTheme(theme)) return theme
  return DARK_BASED.includes(theme) ? 'dark' : 'light'
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(stored) ? stored : 'light'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', DARK_BASED.includes(theme))
  for (const t of CLASSED) root.classList.toggle(`theme-${t}`, t === theme)
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}
