import { Check, TriangleAlert, Wallet, Timer, Beef, Flame } from 'lucide-react'
import type { WeekFit, WeekTargets } from '@/services/plannerEngine'
import { formatMoney } from '@/services/pricing'
import { dayNameShort } from '@/utils/date'
import styles from './WeekFitPanel.module.css'

interface WeekFitPanelProps {
  fit: WeekFit
  targets: WeekTargets
  currency?: string
  /** Regenerate leaning cheaper, or quicker — the two things people ask for. */
  onCheaper: () => void
  onQuicker: () => void
}

/**
 * Whether this is the week you asked for, in numbers.
 *
 * "Lean towards cheap" is a preference; "under sixty pounds" is a question,
 * and until the answer is on screen you are guessing. Each figure sits next to
 * what it was measured against, and the two that people actually act on —
 * money and time — come with a way to act.
 *
 * Everything here is an estimate built on estimates, which the footnote says
 * rather than implying with a precise-looking number.
 */
export function WeekFitPanel({ fit, targets, currency = '$', onCheaper, onQuicker }: WeekFitPanelProps) {
  const anyTarget =
    targets.budget != null ||
    targets.maxMinutesPerMeal != null ||
    targets.proteinPerDay != null ||
    targets.caloriesPerDay != null

  const rows = [
    {
      id: 'cost',
      icon: Wallet,
      label: 'This week',
      metric: fit.cost,
      format: (value: number) => formatMoney(value, currency),
      overNote:
        fit.dearest[0] && fit.dearest[0].cost > 0
          ? `${dayNameShort(fit.dearest[0].slot.date)} is the dearest night at about ${formatMoney(fit.dearest[0].cost, currency)}`
          : undefined,
      action: fit.cost.status === 'over' ? { label: 'Make it cheaper', run: onCheaper } : undefined,
    },
    {
      id: 'time',
      icon: Timer,
      label: 'Longest night',
      metric: fit.longestMeal,
      format: (value: number) => `${value} min`,
      overNote: fit.slowest[0]
        ? `${dayNameShort(fit.slowest[0].slot.date)}: ${fit.slowest[0].slot.recipe?.title}`
        : undefined,
      action:
        fit.longestMeal.status === 'over' ? { label: 'Make it quicker', run: onQuicker } : undefined,
    },
    {
      id: 'protein',
      icon: Beef,
      label: 'Protein a day',
      metric: fit.protein,
      format: (value: number) => `${Math.round(value)} g`,
    },
    {
      id: 'calories',
      icon: Flame,
      label: 'Calories a day',
      metric: fit.calories,
      format: (value: number) => `${Math.round(value)} kcal`,
    },
  ].filter((row) => row.metric.value != null || row.metric.target != null)

  if (!rows.length) return null

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Does it fit?</h2>

      <ul className={styles.rows}>
        {rows.map((row) => (
          <li key={row.id} className={`${styles.row} ${styles[row.metric.status]}`}>
            <span className={styles.label}>
              <row.icon size={15} aria-hidden="true" />
              {row.label}
            </span>

            <span className={styles.value}>
              {row.metric.partial && row.metric.value != null ? (
                <small className={styles.atLeast}>at least </small>
              ) : null}
              {row.metric.value != null ? row.format(row.metric.value) : '—'}
              {row.metric.target != null ? (
                <small>
                  {row.id === 'protein' ? ' goal ' : ' of '}
                  {row.format(row.metric.target)}
                </small>
              ) : null}
            </span>

            <span className={styles.status}>
              {row.metric.status === 'good' ? (
                <Check size={15} aria-hidden="true" />
              ) : row.metric.status === 'over' || row.metric.status === 'under' ? (
                <TriangleAlert size={15} aria-hidden="true" />
              ) : null}
            </span>

            {(row.metric.status === 'over' || row.metric.status === 'under') && row.overNote ? (
              <span className={styles.note}>{row.overNote}</span>
            ) : null}

            {row.action ? (
              <button type="button" className={styles.fix} onClick={row.action.run}>
                {row.action.label}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <p className={styles.footnote}>
        Estimates: typical shop prices, and nutrition from the recipes that have
        any.{' '}
        {fit.uncountedMeals
          ? ` ${fit.uncountedMeals} meal${fit.uncountedMeals === 1 ? '' : 's'} had no nutrition to count, so the daily figures are a floor rather than a total — add numbers on those recipes to have them checked against a goal.`
          : null}
        {!anyTarget ? ' Set a budget or a time limit to have this checked against something.' : null}
      </p>
    </section>
  )
}
