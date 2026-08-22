import { Check, Moon, Sun, SunMoon } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { THEMES, type SchemePreference, type Theme, type ThemePalette } from '@/app/themes'
import styles from './ThemePicker.module.css'

const SCHEMES: Array<{ id: SchemePreference; label: string; icon: typeof Sun }> = [
  { id: 'auto', label: 'Follow system', icon: SunMoon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
]

/**
 * Every theme drawn in miniature with its own colours — paper, a card, a
 * line of ink, the accent button — so you can see what you would get before
 * you tap, and the tap applies it at once. Nothing to save.
 */
export function ThemePicker() {
  const { settings, update } = useSettings()
  const current = settings.theme ?? 'paper'
  const scheme = settings.colorScheme ?? 'auto'

  const systemDark =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const previewDark = scheme === 'dark' || (scheme === 'auto' && systemDark)

  return (
    <div className={styles.wrap}>
      <div className={styles.schemes} role="radiogroup" aria-label="Light or dark">
        {SCHEMES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={scheme === option.id}
            className={`chip chip-button ${styles.schemeChip}`}
            onClick={() => void update({ colorScheme: option.id })}
          >
            <option.icon size={15} aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>

      <ul className={styles.grid} role="radiogroup" aria-label="Theme">
        {THEMES.map((theme) => (
          <li key={theme.id}>
            <ThemeCard
              theme={theme}
              palette={theme.only === 'dark' || (previewDark && !theme.only) ? theme.dark : theme.light}
              selected={theme.id === current}
              onSelect={() => void update({ theme: theme.id })}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ThemeCard({
  theme,
  palette,
  selected,
  onSelect,
}: {
  theme: Theme
  palette: ThemePalette
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      onClick={onSelect}
    >
      <span
        className={styles.preview}
        style={{ background: palette.paper, borderColor: palette.line }}
        aria-hidden="true"
      >
        <span className={styles.previewCard} style={{ background: palette.surface, borderColor: palette.line }}>
          <span className={styles.previewTitle} style={{ background: palette.ink }} />
          <span className={styles.previewLine} style={{ background: palette.inkFaint }} />
          <span className={styles.previewLine} style={{ background: palette.inkFaint, width: '55%' }} />
          <span className={styles.previewButton} style={{ background: palette.accent }} />
        </span>
        <span className={styles.previewChip} style={{ background: palette.accentSoft, color: palette.accentInk }}>
          Aa
        </span>
      </span>
      <span className={styles.text}>
        <strong>
          {theme.name}
          {theme.only === 'dark' ? <span className={styles.tag}>dark</span> : null}
        </strong>
        <small>{theme.blurb}</small>
      </span>
      {selected ? (
        <span className={styles.check}>
          <Check size={14} aria-hidden="true" />
        </span>
      ) : null}
    </button>
  )
}
