import type { PlannedMeal, Recipe } from '@/models'

/**
 * What a planned slot is called, wherever it is shown — the planner, the
 * dashboard, the printed sheet. One definition so a leftover night reads the
 * same way on paper as it does on the phone.
 */
export function mealTitle(meal: PlannedMeal, recipe?: Recipe): string {
  if (meal.kind === 'eating-out') return meal.customName || 'Eating out'
  if (meal.kind === 'skip') return meal.customName || 'Nothing planned'
  if (meal.customName) return meal.customName
  if (recipe) return meal.kind === 'leftover' ? `${recipe.title} — leftovers` : recipe.title
  return 'Meal'
}
