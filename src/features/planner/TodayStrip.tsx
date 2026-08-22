import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChefHat, Refrigerator } from 'lucide-react'
import { db } from '@/db/database'
import type { CookEvent, PlannedMeal, Recipe } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import { activeMinutes } from '@/services/recipeMetrics'
import { formatMinutes, relativeDayLabel, todayISO } from '@/utils/date'
import { mealTitle } from './mealTitle'
import styles from './TodayStrip.module.css'

interface TodayStripProps {
  meals: PlannedMeal[]
  recipesById: Map<string, Recipe>
}

/**
 * What the old Today screen was for, at the top of the week: tonight's meal
 * with a Start cooking button, anything to remember before then, and what is
 * in the fridge. It only appears on the current week, where "tonight" means
 * something.
 */
export function TodayStrip({ meals, recipesById }: TodayStripProps) {
  const today = todayISO()
  const tonight = meals.filter((meal) => meal.date === today && meal.kind !== 'skip')
  const reminders = meals.filter((meal) => meal.date >= today && meal.notes).slice(0, 3)
  const leftovers = useLiveQuery(
    async () =>
      (await db.cookEvents.toArray())
        .filter((event) => event.remainingServings > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    [],
    [] as CookEvent[],
  )

  if (!tonight.length && !reminders.length && !leftovers.length) return null

  return (
    <section className={styles.strip} aria-label="Today">
      {tonight.map((meal) => {
        const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
        return (
          <article key={meal.id} className={styles.tonight}>
            <p className={styles.eyebrow}>Tonight · {MEAL_TYPE_LABELS[meal.mealType]}</p>
            <h2 className={styles.title}>{mealTitle(meal, recipe)}</h2>
            <p className={styles.meta}>
              {meal.servings ? `${meal.servings} servings` : null}
              {recipe ? ` · ${formatMinutes(Math.round(activeMinutes(recipe)))} hands-on` : null}
              {recipe?.cookTimeMinutes ? ` · cook ${formatMinutes(recipe.cookTimeMinutes)}` : null}
            </p>
            {recipe ? (
              <div className={styles.actions}>
                <Link
                  to={`/recipes/${recipe.id}/cook?servings=${meal.servings ?? recipe.servings ?? 4}&plannedMeal=${meal.id}`}
                  className="btn btn-primary btn-sm"
                >
                  <ChefHat size={16} aria-hidden="true" />
                  {meal.kind === 'leftover' ? 'Open recipe' : 'Start cooking'}
                </Link>
                <Link to={`/recipes/${recipe.id}`} className="btn btn-ghost btn-sm">
                  View
                </Link>
              </div>
            ) : null}
          </article>
        )
      })}

      {reminders.length ? (
        <ul className={styles.reminders}>
          {reminders.map((meal) => (
            <li key={meal.id}>
              <strong>{relativeDayLabel(meal.date, today)}:</strong> {meal.notes}
            </li>
          ))}
        </ul>
      ) : null}

      {leftovers.length ? (
        <ul className={styles.fridge} aria-label="In the fridge">
          {leftovers.map((event) => (
            <li key={event.id}>
              <Refrigerator size={14} aria-hidden="true" />
              {event.recipeTitle}
              <span className={styles.fridgeCount}>
                {event.remainingServings} left
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
