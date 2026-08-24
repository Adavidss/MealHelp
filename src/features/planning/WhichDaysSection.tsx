import type { Dispatch, SetStateAction } from 'react'
import { DAY_LOADS, DAY_LOAD_LABELS, type DayLoad } from '@/models'
import { dayName, dayNameShort, monthDay } from '@/utils/date'
import { DAY_PRESETS } from './dayPresets'
import type { Preferences } from './preferences'
import styles from './PlanWizardPage.module.css'

interface WhichDaysSectionProps {
  dates: string[]
  prefs: Preferences
  setPrefs: Dispatch<SetStateAction<Preferences>>
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
}

export function WhichDaysSection({ dates, prefs, setPrefs, set }: WhichDaysSectionProps) {
  return (
    <section>
      <h2 className="section-title">
        Which days
        <span className={styles.dayPresets}>
          {DAY_PRESETS.map((preset) => {
            const chosen = preset.pick(dates)
            const active =
              chosen.length === prefs.selectedDates.length &&
              chosen.every((date) => prefs.selectedDates.includes(date))
            return (
              <button
                key={preset.id}
                type="button"
                className="chip chip-button"
                aria-pressed={active}
                onClick={() =>
                  setPrefs((current) => ({
                    ...current,
                    selectedDates: chosen,
                    mealsNeeded: chosen.length,
                    // Cooking more nights than there are days is not a plan,
                    // it is an error message waiting to happen.
                    targetCookSessions: Math.min(current.targetCookSessions, chosen.length),
                  }))
                }
              >
                {preset.label}
              </button>
            )
          })}
        </span>
      </h2>

      <div className={styles.days}>
        {dates.map((date) => {
          const selected = prefs.selectedDates.includes(date)
          return (
            <div key={date} className={styles.dayColumn}>
              <button
                type="button"
                className={`${styles.dayToggle} ${selected ? styles.dayOn : ''}`}
                aria-pressed={selected}
                onClick={() =>
                  set(
                    'selectedDates',
                    selected
                      ? prefs.selectedDates.filter((d) => d !== date)
                      : [...prefs.selectedDates, date].sort(),
                  )
                }
              >
                <strong>{dayNameShort(date)}</strong>
                <small>{monthDay(date)}</small>
              </button>
              <select
                className={`select ${styles.loadSelect}`}
                value={prefs.dayLoads[date] ?? 'normal'}
                onChange={(event) =>
                  set('dayLoads', {
                    ...prefs.dayLoads,
                    [date]: event.target.value as DayLoad,
                  })
                }
                disabled={!selected}
                aria-label={`How busy is ${dayName(date)}?`}
              >
                {DAY_LOADS.map((load) => (
                  <option key={load} value={load}>
                    {DAY_LOAD_LABELS[load]}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </section>
  )
}
