import { useMemo } from 'react'
import type { Recipe } from '@/models'
import { CHARACTERISTICS, countCharacteristics } from './characteristics'
import { MOODS, countMoods } from './moods'
import styles from './FilterRail.module.css'

interface FilterRailProps {
  mood?: string
  onMoodChange: (mood: string | undefined) => void
  characteristics: string[]
  onCharacteristicsChange: (next: string[]) => void
  /** Counted before the mood is applied, so a mood's own count still means something. */
  moodRecipes: Recipe[]
  /** Counted after it, because a characteristic narrows what the mood left. */
  characteristicRecipes: Recipe[]
  pantryKeys?: Set<string>
}

/**
 * One rail, two questions.
 *
 * These were two stacked rows — moods above, "what it is" below — which cost a
 * phone 94px before a single photograph. They are one scrolling row now, in
 * the order the questions actually get asked: what do I feel like, and then
 * what am I cooking it in. A hairline divider keeps them legible as two ideas
 * without spending a second line on saying so.
 *
 * Three chips are gone in the merge. "Big batch", "Cheap" and "Good for
 * leftovers" existed in both lists with identical rules — `bulkScore >= 4` on
 * both sides — so on one row they would have appeared twice, side by side,
 * doing the same thing. The mood keeps them.
 */

/** Ideas the mood row already covers, dropped from the second half. */
const MOOD_IDS = new Set(MOODS.map((mood) => mood.id))

export function FilterRail({
  mood,
  onMoodChange,
  characteristics,
  onCharacteristicsChange,
  moodRecipes,
  characteristicRecipes,
  pantryKeys,
}: FilterRailProps) {
  const moodCounts = useMemo(
    () => countMoods(moodRecipes, { pantryKeys }),
    [moodRecipes, pantryKeys],
  )
  const traits = useMemo(() => CHARACTERISTICS.filter((entry) => !MOOD_IDS.has(entry.id)), [])
  const traitCounts = useMemo(
    () => countCharacteristics(characteristicRecipes),
    [characteristicRecipes],
  )

  const anything = !mood && characteristics.length === 0

  const toggleTrait = (id: string) => {
    onCharacteristicsChange(
      characteristics.includes(id)
        ? characteristics.filter((entry) => entry !== id)
        : [...characteristics, id],
    )
  }

  return (
    <div className={styles.rail}>
      {/* Both halves at once, because it is the only way back from either. */}
      <button
        type="button"
        className={styles.chip}
        aria-pressed={anything}
        onClick={() => {
          onMoodChange(undefined)
          onCharacteristicsChange([])
        }}
      >
        Anything
      </button>

      <div className={styles.group} role="group" aria-label="Mood">
        {MOODS.map((entry) => {
          const count = moodCounts.get(entry.id) ?? 0
          const selected = mood === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              className={styles.chip}
              aria-pressed={selected}
              // Never disable the one that is on, or it cannot be turned off.
              disabled={count === 0 && !selected}
              title={entry.blurb}
              onClick={() => onMoodChange(selected ? undefined : entry.id)}
            >
              {entry.label}
              <span className={styles.count}>{count}</span>
            </button>
          )
        })}
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <div className={styles.group} role="group" aria-label="What it is">
        {traits.map((entry) => {
          const count = traitCounts.get(entry.id) ?? 0
          const selected = characteristics.includes(entry.id)
          return (
            <button
              key={entry.id}
              type="button"
              className={styles.chip}
              aria-pressed={selected}
              disabled={count === 0 && !selected}
              onClick={() => toggleTrait(entry.id)}
            >
              {entry.label}
              <span className={styles.count}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
