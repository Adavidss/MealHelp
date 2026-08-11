import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import type { Recipe } from '@/models'
import { CHARACTERISTICS, countCharacteristics } from './characteristics'
import styles from './CharacteristicFilters.module.css'

interface CharacteristicFiltersProps {
  recipes: Recipe[]
  selected: string[]
  onChange: (selected: string[]) => void
}

/**
 * How many to show before folding the rest away. All eighteen at once fills a
 * phone screen entirely, which defeats a browsing screen whose whole job is to
 * put pictures in front of you.
 */
const VISIBLE_BY_DEFAULT = 8

/**
 * The picking controls.
 *
 * Every filter carries the number of recipes behind it, counted against what is
 * already selected — so a combination that leads nowhere is visibly empty
 * before it is tapped, rather than after. Filters that would return nothing are
 * kept in place but disabled, because a row of chips that rearranges itself
 * while you use it is impossible to aim at.
 */
export function CharacteristicFilters({
  recipes,
  selected,
  onChange,
}: CharacteristicFiltersProps) {
  const [expanded, setExpanded] = useState(false)
  const counts = countCharacteristics(recipes)

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((entry) => entry !== id)
        : [...selected, id],
    )
  }

  // Anything switched on stays visible even when collapsed, so a filter can
  // never be active somewhere the user cannot see or reach it.
  const shown = expanded
    ? CHARACTERISTICS
    : CHARACTERISTICS.filter(
        (entry, index) => index < VISIBLE_BY_DEFAULT || selected.includes(entry.id),
      )
  const hiddenCount = CHARACTERISTICS.length - shown.length

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {shown.map((characteristic) => {
          const count = counts.get(characteristic.id) ?? 0
          const isSelected = selected.includes(characteristic.id)
          // Never disable something already on, or it cannot be turned off.
          const disabled = count === 0 && !isSelected

          return (
            <button
              key={characteristic.id}
              type="button"
              className="chip chip-button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => toggle(characteristic.id)}
            >
              {characteristic.label}
              <span className={styles.count}>{count}</span>
            </button>
          )
        })}

        {hiddenCount > 0 ? (
          <button
            type="button"
            className={`chip chip-button ${styles.more}`}
            onClick={() => setExpanded(true)}
            aria-expanded={false}
          >
            {hiddenCount} more
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className={styles.footer}>
        {selected.length ? (
          <button type="button" className={styles.clear} onClick={() => onChange([])}>
            <X size={14} aria-hidden="true" />
            Clear {selected.length} filter{selected.length === 1 ? '' : 's'}
          </button>
        ) : null}
        {expanded ? (
          <button
            type="button"
            className={styles.clear}
            onClick={() => setExpanded(false)}
          >
            Show fewer
          </button>
        ) : null}
      </div>
    </div>
  )
}
