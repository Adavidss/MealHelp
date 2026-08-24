import type { Preferences } from './preferences'
import styles from './PlanWizardPage.module.css'

interface FitTargetsSectionProps {
  prefs: Preferences
  currency: string
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
}

/**
 * What the week has to fit inside — money, time, protein.
 *
 * All three are optional on purpose. A planner that insists on a budget before
 * it will do anything is a planner people close; these are checked after the
 * week is built, with a way to nudge it cheaper or quicker if it misses.
 */
export function FitTargetsSection({ prefs, currency, set }: FitTargetsSectionProps) {
  return (
    <section>
      <h2 className="section-title">
        What does it have to fit?
        <span className="text-sm faint">Leave any of them blank</span>
      </h2>
      <div className={styles.fitInputs}>
        <label className={styles.fitField}>
          <span className="field-label">Budget for the week</span>
          <span className={styles.fitInput}>
            <span className={styles.prefix}>{currency}</span>
            <input
              className="input"
              type="number"
              min={0}
              step={5}
              inputMode="numeric"
              placeholder="no limit"
              value={prefs.budget ?? ''}
              onChange={(event) =>
                set('budget', event.target.value === '' ? undefined : Number(event.target.value))
              }
            />
          </span>
          <span className="field-hint">Estimated from typical shop prices.</span>
        </label>

        <label className={styles.fitField}>
          <span className="field-label">Longest night</span>
          <span className={styles.fitInput}>
            <input
              className="input"
              type="number"
              min={0}
              step={5}
              inputMode="numeric"
              placeholder="no limit"
              value={prefs.maxMinutesPerMeal ?? ''}
              onChange={(event) =>
                set(
                  'maxMinutesPerMeal',
                  event.target.value === '' ? undefined : Number(event.target.value),
                )
              }
            />
            <span className={styles.suffix}>min</span>
          </span>
          <span className="field-hint">Hands-on time, not time in the oven.</span>
        </label>

        <label className={styles.fitField}>
          <span className="field-label">Protein a day</span>
          <span className={styles.fitInput}>
            <input
              className="input"
              type="number"
              min={0}
              step={5}
              inputMode="numeric"
              placeholder="no goal"
              value={prefs.proteinPerDay ?? ''}
              onChange={(event) =>
                set(
                  'proteinPerDay',
                  event.target.value === '' ? undefined : Number(event.target.value),
                )
              }
            />
            <span className={styles.suffix}>g</span>
          </span>
          <span className="field-hint">Counted per person, per day.</span>
        </label>
      </div>
      <p className="field-hint">
        These are checked once the week is built, with a way to nudge it
        cheaper or quicker if it misses.
      </p>
    </section>
  )
}
