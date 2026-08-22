import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { addPlannedMeal, deletePlannedMeal, getOrCreatePlan } from '@/db/plans'
import type { Recipe } from '@/models'
import { useToast } from '@/components/common/Toast'
import { mealArt } from '@/components/meal/mealArtwork'
import {
  addDays,
  dayNameShort,
  monthDay,
  relativeDayLabel,
  startOfWeek,
  todayISO,
  weekDates,
} from '@/utils/date'
import styles from './QuickPlanBar.module.css'

interface QuickPlanBarProps {
  recipe: Recipe
  onClose: () => void
}

/**
 * Seven days, one tap.
 *
 * Deliberately a strip and not a dialog: a dialog would be the intermediate
 * screen this exists to remove. It sits above the tab bar, names the meal it
 * is placing so a mis-tap is obvious, marks the days that already have
 * something on them, and undoes itself from the toast.
 *
 * Meal type is not asked. Whatever the kitchen is set up for — dinner, for
 * almost everyone — is what a tap means, and the meal can be moved or changed
 * from the day card afterwards.
 */
export function QuickPlanBar({ recipe, onClose }: QuickPlanBarProps) {
  const { settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()

  const today = todayISO()
  const thisWeek = startOfWeek(today, settings.weekStartsOn)
  const [weekStart, setWeekStart] = useState(thisWeek)
  const [saving, setSaving] = useState(false)

  const dates = useMemo(() => weekDates(weekStart), [weekStart])
  const art = mealArt(recipe)

  // What is already on those days, so a day that is taken says so before it
  // is tapped rather than after.
  const taken = useLiveQuery(
    async () => {
      const meals = await db.plannedMeals.where('date').anyOf(dates).toArray()
      return new Set(meals.map((meal) => meal.date))
    },
    [dates.join(',')],
    new Set<string>(),
  )

  const place = async (date: string) => {
    if (saving) return
    setSaving(true)
    try {
      const plan = await getOrCreatePlan(startOfWeek(date, settings.weekStartsOn))
      const meal = await addPlannedMeal({
        planId: plan.id,
        date,
        mealType: settings.visibleMealTypes[0] ?? 'dinner',
        kind: 'recipe',
        recipeId: recipe.id,
        servings: recipe.servings ?? settings.defaultServings,
      })
      onClose()
      toast(`${recipe.title} — ${relativeDayLabel(date, today)}.`, {
        tone: 'success',
        action: {
          label: 'Undo',
          run: () => void deletePlannedMeal(meal.id),
        },
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.wrap} role="dialog" aria-label={`Put ${recipe.title} on a day`}>
      <div className={styles.head}>
        <span
          className={`${styles.thumb} ${art.kind === 'photo' ? '' : styles[`palette${art.palette}`]}`}
        >
          {art.kind === 'photo' ? <img src={art.src} alt="" /> : null}
        </span>
        <p className={styles.title}>
          <strong>{recipe.title}</strong>
          <small>Tap a day</small>
        </p>
        <div className={styles.weekNav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            disabled={weekStart <= thisWeek}
            aria-label="Previous week"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className={styles.weekLabel}>
            {weekStart === thisWeek ? 'This week' : 'Next week'}
          </span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            disabled={weekStart >= addDays(thisWeek, 7)}
            aria-label="Next week"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Not now">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.days}>
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            className={[
              styles.day,
              date === today ? styles.isToday : '',
              // A day that has been and gone is still tappable — you may be
              // recording what you actually ate — but it stops competing.
              date < today ? styles.isPast : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => void place(date)}
            disabled={saving}
          >
            <strong>{dayNameShort(date)}</strong>
            <small>{monthDay(date)}</small>
            {taken?.has(date) ? <span className={styles.dot} aria-label="already has a meal" /> : null}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.openPlan}
        onClick={() => {
          onClose()
          navigate(`/plan/${weekStart}`)
        }}
      >
        Open the week instead
      </button>
    </div>
  )
}
