import { Link } from 'react-router-dom'
import { ChefHat, Lock, Refrigerator, Store, Utensils } from 'lucide-react'
import type { PlannedMeal, Recipe } from '@/models'
import { formatMinutes } from '@/utils/date'
import { activeMinutes } from '@/services/recipeMetrics'
import { mealTitle } from './mealTitle'
import styles from './MealSlot.module.css'

interface MealSlotProps {
  meal: PlannedMeal
  recipe?: Recipe
  onOpenMenu: (meal: PlannedMeal) => void
  compact?: boolean
}

const KIND_ICON = {
  recipe: ChefHat,
  leftover: Refrigerator,
  custom: Utensils,
  'eating-out': Store,
  skip: Utensils,
} as const

export function MealSlot({ meal, recipe, onOpenMenu, compact }: MealSlotProps) {
  const Icon = KIND_ICON[meal.kind]
  const title = mealTitle(meal, recipe)

  return (
    <div className={`${styles.slot} ${styles[meal.kind]} ${compact ? styles.compact : ''}`}>
      <button
        type="button"
        className={styles.main}
        onClick={() => onOpenMenu(meal)}
        aria-label={`${title} — open meal options`}
      >
        <span className={styles.icon} aria-hidden="true">
          <Icon size={15} />
        </span>
        <span className={styles.text}>
          <span className={styles.title}>{title}</span>
          <span className={styles.meta}>
            {meal.kind === 'leftover' ? 'Leftovers' : null}
            {meal.kind === 'recipe' && recipe ? (
              <>
                {formatMinutes(Math.round(activeMinutes(recipe)))} active
                {meal.servings ? ` · ${meal.servings} servings` : ''}
              </>
            ) : null}
            {meal.kind === 'eating-out' ? 'Eating out' : null}
          </span>
        </span>
        {meal.locked ? (
          <Lock size={13} aria-hidden="true" className={styles.lock} />
        ) : null}
      </button>

      {meal.kind === 'recipe' && recipe ? (
        <Link
          to={`/recipes/${recipe.id}`}
          className={styles.open}
          aria-label={`Open ${recipe.title}`}
        >
          View
        </Link>
      ) : null}
    </div>
  )
}
