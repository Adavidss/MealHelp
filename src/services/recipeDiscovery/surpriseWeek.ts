import type { BudgetLevel, CookingMethod, EffortLevel, MealSlotConfig } from '@/models'
import { COOKING_METHOD_LABELS, slotsForDate } from '@/models'

/**
 * Planning a week out of recipes you do not own yet.
 *
 * The ordinary planner picks from your library, which is the right default and
 * useless on the day you are bored of everything in it. This works out what
 * the week actually needs — how many *cooking* meals, which is not the same as
 * how many meals — and what to ask the recipe databases for, given the
 * preferences already on screen.
 */

export interface WeekNeeds {
  /** Distinct recipes the week needs cooking for. */
  recipes: number
  /** Which slots will be filled from the web, for saying so plainly. */
  cookSlots: MealSlotConfig[]
}

/**
 * How many recipes a scoped week needs.
 *
 * Only cooking slots count: a routine slot has its own answer already, and a
 * leftovers slot eats what the cooking made. A slot that cooks three times a
 * week needs three recipes however many days it appears on.
 */
export function weekNeeds(slots: MealSlotConfig[], dates: string[]): WeekNeeds {
  const cookSlots = slots.filter((slot) => slot.fill === 'cook')
  const recipes = cookSlots.reduce((total, slot) => {
    const days = dates.filter((date) => slotsForDate([slot], date).length > 0).length
    if (!days) return total
    return total + Math.min(slot.cookSessions ?? days, days)
  }, 0)
  return { recipes, cookSlots }
}

export interface WeekPreferences {
  preferredMethods?: CookingMethod[]
  requiredMethods?: CookingMethod[]
  preferredEffort?: EffortLevel
  budgetPreference?: BudgetLevel
  useUpIngredients?: string[]
  /** Meal types being planned, so lunches are not all casseroles. */
  mealTypes?: string[]
}

/**
 * What to ask the recipe databases, given what the user has already said.
 *
 * The preferences the planner uses are measurements — active minutes, bulk
 * score, cost tier — and none of that exists for a recipe nobody has saved
 * yet. So each one is translated into the words recipes are actually written
 * with, most specific first, and the generic ones are only there so a week
 * with no preferences at all still has something to search for.
 */
export function weekQueries(preferences: WeekPreferences): string[] {
  const queries: string[] = []

  // Something to use up is the most specific thing anyone ever says.
  for (const ingredient of preferences.useUpIngredients ?? []) {
    if (ingredient.trim()) queries.push(`${ingredient.trim()} dinner`)
  }

  const methods = [
    ...(preferences.requiredMethods ?? []),
    ...(preferences.preferredMethods ?? []),
  ]
  for (const method of [...new Set(methods)]) {
    queries.push(`${COOKING_METHOD_LABELS[method].toLowerCase()} dinner`)
  }

  if (preferences.budgetPreference === '$') queries.push('budget dinner')
  if (preferences.preferredEffort === 'very-low' || preferences.preferredEffort === 'low') {
    queries.push('easy weeknight dinner')
  }

  for (const mealType of preferences.mealTypes ?? []) {
    if (mealType === 'lunch') queries.push('easy lunch')
    if (mealType === 'breakfast') queries.push('breakfast recipe')
  }

  // A week of one search is a week of one dish, so there is always a spread
  // to fall back on — and it doubles as the answer when nothing was asked for.
  queries.push('chicken dinner', 'vegetarian dinner', 'pasta dinner', 'soup and stew')

  return [...new Set(queries)]
}
