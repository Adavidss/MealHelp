/**
 * Themes.
 *
 * A theme is a palette, not a layout: the same components, the same spacing,
 * different paper and ink. Every theme carries a light and a dark palette so
 * "follow the system" works for all of them, and a couple are dark-only
 * because their whole point is being dark.
 *
 * The palettes live here in code rather than in CSS so one definition feeds
 * both the running app and the preview swatches in Settings, and so a theme
 * can be applied before React mounts without a second copy in index.html.
 */

export interface ThemePalette {
  paper: string
  surface: string
  surfaceSunk: string
  surfaceRaised: string
  line: string
  lineStrong: string
  ink: string
  inkSoft: string
  inkFaint: string
  accent: string
  accentHover: string
  accentSoft: string
  accentInk: string
}

export interface Theme {
  id: string
  name: string
  /** One line, shown under the name in the picker. */
  blurb: string
  light: ThemePalette
  dark: ThemePalette
  /** Set when the theme only makes sense in one scheme. */
  only?: 'light' | 'dark'
}

export type SchemePreference = 'auto' | 'light' | 'dark'
export type ResolvedScheme = 'light' | 'dark'

export const THEMES: Theme[] = [
  {
    id: 'paper',
    name: 'Paper',
    blurb: 'Warm paper and paprika — the cookbook look',
    light: {
      paper: '#fdf8f3',
      surface: '#ffffff',
      surfaceSunk: '#f6efe6',
      surfaceRaised: '#ffffff',
      line: '#e7dbcc',
      lineStrong: '#d6c5b0',
      ink: '#2f2723',
      inkSoft: '#6b5c50',
      inkFaint: '#91806f',
      accent: '#b4541f',
      accentHover: '#9a4517',
      accentSoft: '#fbeade',
      accentInk: '#8c3f14',
    },
    dark: {
      paper: '#1a1613',
      surface: '#241f1b',
      surfaceSunk: '#1f1a17',
      surfaceRaised: '#2b2521',
      line: '#3a322c',
      lineStrong: '#4c423a',
      ink: '#f3ece4',
      inkSoft: '#c3b5a8',
      inkFaint: '#9b8b7c',
      accent: '#e8813f',
      accentHover: '#f19a5d',
      accentSoft: '#3a2317',
      accentInk: '#f0a877',
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    blurb: 'Greens and linen, for a calmer kitchen',
    light: {
      paper: '#f4f7f2',
      surface: '#ffffff',
      surfaceSunk: '#e9efe6',
      surfaceRaised: '#ffffff',
      line: '#d5dfd0',
      lineStrong: '#b9c9b2',
      ink: '#1f2a22',
      inkSoft: '#51604f',
      inkFaint: '#7c8a78',
      accent: '#3f7a4f',
      accentHover: '#336540',
      accentSoft: '#e1efe3',
      accentInk: '#2b5638',
    },
    dark: {
      paper: '#121814',
      surface: '#1a221c',
      surfaceSunk: '#161d18',
      surfaceRaised: '#202a22',
      line: '#2b3a2e',
      lineStrong: '#3b4f3f',
      ink: '#e9f0e8',
      inkSoft: '#b9c6b6',
      inkFaint: '#8a9a88',
      accent: '#7fc28f',
      accentHover: '#95d0a3',
      accentSoft: '#203326',
      accentInk: '#a9dcb4',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    blurb: 'Cool blues, crisp and clear',
    light: {
      paper: '#f3f7fa',
      surface: '#ffffff',
      surfaceSunk: '#e7eff5',
      surfaceRaised: '#ffffff',
      line: '#d2dfe9',
      lineStrong: '#b3c8d8',
      ink: '#1b2733',
      inkSoft: '#4d5f70',
      inkFaint: '#7b8b9a',
      accent: '#1f6f9a',
      accentHover: '#185a7d',
      accentSoft: '#dfeef7',
      accentInk: '#174f6e',
    },
    dark: {
      paper: '#0f161c',
      surface: '#161f27',
      surfaceSunk: '#121a21',
      surfaceRaised: '#1c2730',
      line: '#263440',
      lineStrong: '#354755',
      ink: '#e6eef5',
      inkSoft: '#b2c2cf',
      inkFaint: '#8496a5',
      accent: '#5fb0dc',
      accentHover: '#7dc2e7',
      accentSoft: '#1a2e3d',
      accentInk: '#9bd0ef',
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    blurb: 'Berry and cream, a little dressed up',
    light: {
      paper: '#f8f4f8',
      surface: '#ffffff',
      surfaceSunk: '#f0e8f0',
      surfaceRaised: '#ffffff',
      line: '#e1d3e1',
      lineStrong: '#c9b3c9',
      ink: '#2b2030',
      inkSoft: '#5d4d63',
      inkFaint: '#8a7a90',
      accent: '#7a3f7e',
      accentHover: '#643266',
      accentSoft: '#f1e3f1',
      accentInk: '#5c2e5f',
    },
    dark: {
      paper: '#171219',
      surface: '#211a24',
      surfaceSunk: '#1b151e',
      surfaceRaised: '#2a2130',
      line: '#372b3b',
      lineStrong: '#4b3b50',
      ink: '#f1e9f2',
      inkSoft: '#c6b8c9',
      inkFaint: '#998b9d',
      accent: '#c58bcb',
      accentHover: '#d3a2d8',
      accentSoft: '#3a2640',
      accentInk: '#e0b3e4',
    },
  },
  {
    id: 'citrus',
    name: 'Citrus',
    blurb: 'Sunny and bright, orange on butter',
    light: {
      paper: '#fffaf0',
      surface: '#ffffff',
      surfaceSunk: '#fff1d6',
      surfaceRaised: '#ffffff',
      line: '#f1dfb8',
      lineStrong: '#e0c68f',
      ink: '#2d2410',
      inkSoft: '#6a5a35',
      inkFaint: '#968660',
      accent: '#d9781a',
      accentHover: '#bb6612',
      accentSoft: '#ffeacc',
      accentInk: '#9a5410',
    },
    dark: {
      paper: '#1b160d',
      surface: '#262012',
      surfaceSunk: '#1f1a0f',
      surfaceRaised: '#2e2716',
      line: '#3e3520',
      lineStrong: '#55482c',
      ink: '#f7f0e2',
      inkSoft: '#cbbf9f',
      inkFaint: '#a09270',
      accent: '#f0a23a',
      accentHover: '#f5b45c',
      accentSoft: '#3d2c12',
      accentInk: '#f7c27a',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    blurb: 'Quiet greys and navy — nothing shouts',
    light: {
      paper: '#f6f6f7',
      surface: '#ffffff',
      surfaceSunk: '#ededf0',
      surfaceRaised: '#ffffff',
      line: '#dcdce1',
      lineStrong: '#c2c2ca',
      ink: '#1e1f24',
      inkSoft: '#56575f',
      inkFaint: '#82838c',
      accent: '#34507a',
      accentHover: '#2a4164',
      accentSoft: '#e3e9f3',
      accentInk: '#263a58',
    },
    dark: {
      paper: '#131417',
      surface: '#1b1c21',
      surfaceSunk: '#16171b',
      surfaceRaised: '#22232a',
      line: '#2d2e36',
      lineStrong: '#3e404a',
      ink: '#ecedf1',
      inkSoft: '#b7b9c2',
      inkFaint: '#878a95',
      accent: '#8fb0e6',
      accentHover: '#a7c3ee',
      accentSoft: '#222c3b',
      accentInk: '#b9cdf2',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Near-black with amber, for the stove at night',
    only: 'dark',
    light: {
      paper: '#0b0b0d',
      surface: '#141418',
      surfaceSunk: '#0f0f12',
      surfaceRaised: '#1a1a20',
      line: '#24242c',
      lineStrong: '#34343e',
      ink: '#f2f2f4',
      inkSoft: '#bdbdc6',
      inkFaint: '#8b8b96',
      accent: '#ffb454',
      accentHover: '#ffc377',
      accentSoft: '#33260f',
      accentInk: '#ffd08e',
    },
    dark: {
      paper: '#0b0b0d',
      surface: '#141418',
      surfaceSunk: '#0f0f12',
      surfaceRaised: '#1a1a20',
      line: '#24242c',
      lineStrong: '#34343e',
      ink: '#f2f2f4',
      inkSoft: '#bdbdc6',
      inkFaint: '#8b8b96',
      accent: '#ffb454',
      accentHover: '#ffc377',
      accentSoft: '#33260f',
      accentInk: '#ffd08e',
    },
  },
]

export const DEFAULT_THEME_ID = 'paper'

/**
 * The families every theme shares — leftovers are always sage, highlights
 * always honey, timers always plum, danger always red — in a light and a dark
 * cut. They change with the scheme, not with the theme, so a meaning keeps
 * its colour whatever the paper is.
 */
const SHARED_LIGHT: Record<string, string> = {
  '--sage': '#4e7a5b',
  '--sage-soft': '#e6f0e7',
  '--sage-ink': '#3b5f46',
  '--honey': '#c98a1b',
  '--honey-soft': '#fdf1d9',
  '--plum': '#7a4a70',
  '--plum-soft': '#f5e9f3',
  '--danger': '#b3261e',
  '--danger-soft': '#fdeceb',
  '--shadow-sm': '0 1px 2px rgb(66 44 26 / 8%)',
  '--shadow': '0 2px 10px rgb(66 44 26 / 8%)',
  '--shadow-lg': '0 12px 32px rgb(66 44 26 / 14%)',
}

const SHARED_DARK: Record<string, string> = {
  '--sage': '#7fb08d',
  '--sage-soft': '#223026',
  '--sage-ink': '#a2c9ad',
  '--honey': '#e0aa4d',
  '--honey-soft': '#33280f',
  '--plum': '#c093b8',
  '--plum-soft': '#2f2130',
  '--danger': '#f0857c',
  '--danger-soft': '#3a1e1c',
  '--shadow-sm': '0 1px 2px rgb(0 0 0 / 40%)',
  '--shadow': '0 2px 10px rgb(0 0 0 / 40%)',
  '--shadow-lg': '0 12px 32px rgb(0 0 0 / 50%)',
}

export function themeById(id: string | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}

export function resolveScheme(
  preference: SchemePreference,
  theme: Theme,
  systemPrefersDark: boolean,
): ResolvedScheme {
  if (theme.only) return theme.only
  if (preference === 'auto') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/** The CSS custom properties for one palette, ready to set on an element. */
export function paletteVariables(palette: ThemePalette, scheme: ResolvedScheme): Record<string, string> {
  return {
    '--paper': palette.paper,
    '--surface': palette.surface,
    '--surface-sunk': palette.surfaceSunk,
    '--surface-raised': palette.surfaceRaised,
    '--line': palette.line,
    '--line-strong': palette.lineStrong,
    '--ink': palette.ink,
    '--ink-soft': palette.inkSoft,
    '--ink-faint': palette.inkFaint,
    '--accent': palette.accent,
    '--accent-hover': palette.accentHover,
    '--accent-soft': palette.accentSoft,
    '--accent-ink': palette.accentInk,
    ...(scheme === 'dark' ? SHARED_DARK : SHARED_LIGHT),
  }
}

export interface Appearance {
  theme: string
  scheme: SchemePreference
}

const STORAGE_KEY = 'mealhelp.appearance'

/** What was last applied, so the first paint after a reload already matches. */
export function rememberedAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { theme: DEFAULT_THEME_ID, scheme: 'auto' }
    const parsed = JSON.parse(raw) as Partial<Appearance>
    return {
      theme: themeById(parsed.theme).id,
      scheme: parsed.scheme === 'light' || parsed.scheme === 'dark' ? parsed.scheme : 'auto',
    }
  } catch {
    return { theme: DEFAULT_THEME_ID, scheme: 'auto' }
  }
}

const systemDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false

let systemListener: (() => void) | undefined

/**
 * Puts a theme on the page: the palette as custom properties on <html>, the
 * scheme where the browser can see it (form controls, scrollbars), and the
 * browser chrome colour to match. Follows the system while the preference is
 * "auto".
 */
export function applyAppearance(appearance: Appearance): ResolvedScheme {
  const theme = themeById(appearance.theme)
  const scheme = resolveScheme(appearance.scheme, theme, systemDark())
  const palette = scheme === 'dark' ? theme.dark : theme.light
  const root = document.documentElement

  for (const [name, value] of Object.entries(paletteVariables(palette, scheme))) {
    root.style.setProperty(name, value)
  }
  root.style.setProperty('color-scheme', scheme)
  root.dataset.theme = theme.id
  root.dataset.scheme = scheme

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.paper)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: theme.id, scheme: appearance.scheme }))
  } catch {
    // Private mode, or storage full: the theme still applies for this visit.
  }

  // Re-resolve when the system flips, but only while following it.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    if (systemListener) media.removeEventListener('change', systemListener)
    systemListener = appearance.scheme === 'auto' ? () => applyAppearance(appearance) : undefined
    if (systemListener) media.addEventListener('change', systemListener)
  }

  return scheme
}
