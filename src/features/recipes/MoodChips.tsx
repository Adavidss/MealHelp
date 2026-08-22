import { useMemo } from 'react'
import type { Recipe } from '@/models'
import { MOODS, countMoods } from './moods'
import styles from './MoodChips.module.css'

interface MoodChipsProps {
  value?: string
  onChange: (mood: string | undefined) => void
  recipes: Recipe[]
  pantryKeys?: Set<string>
}

/**
 * How the board is narrowed: by mood, not by cuisine.
 *
 * The row scrolls sideways rather than wrapping, so it costs one line whatever
 * the screen width, and every chip carries its count — a mood that would lead
 * to an empty board says so before it is tapped. Tapping the chosen one again
 * clears it, which is the only way back to "anything".
 */
export function MoodChips({ value, onChange, recipes, pantryKeys }: MoodChipsProps) {
  const counts = useMemo(
    () => countMoods(recipes, { pantryKeys }),
    [recipes, pantryKeys],
  )

  return (
    <div className={styles.row} role="group" aria-label="Mood">
      <button
        type="button"
        className={styles.chip}
        aria-pressed={!value}
        onClick={() => onChange(undefined)}
      >
        Anything
      </button>
      {MOODS.map((mood) => {
        const count = counts.get(mood.id) ?? 0
        const selected = value === mood.id
        return (
          <button
            key={mood.id}
            type="button"
            className={styles.chip}
            aria-pressed={selected}
            // Never disable the one that is on, or it cannot be turned off.
            disabled={count === 0 && !selected}
            title={mood.blurb}
            onClick={() => onChange(selected ? undefined : mood.id)}
          >
            {mood.label}
            <span className={styles.count}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
