import type {
  Nutrition,
  NutritionLogEntry,
  NutritionTargets,
  PlannedMeal,
  Recipe,
} from '@/models'
import { NUTRIENTS, NUTRIENT_KEYS, type NutrientKey } from '@/models'
import { round } from './parseSchemaNutrition'

/** Adds whatever both sides know; a missing number on one side is treated as zero. */
export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  const out: Nutrition = { ...a }
  for (const key of NUTRIENT_KEYS) {
    const value = b[key]
    if (value == null) continue
    out[key] = (out[key] ?? 0) + value
  }
  return out
}

export function scaleNutrition(nutrition: Nutrition, factor: number): Nutrition {
  const out: Nutrition = {}
  for (const key of NUTRIENT_KEYS) {
    const value = nutrition[key]
    if (value != null) out[key] = value * factor
  }
  return out
}

export function roundNutrition(nutrition: Nutrition): Nutrition {
  const out: Nutrition = {}
  for (const key of NUTRIENT_KEYS) {
    const value = nutrition[key]
    if (value != null) out[key] = round(value, key === 'calories' || key === 'sodium' || key === 'cholesterol' ? 0 : 1)
  }
  return out
}

export function hasNutrition(nutrition: Nutrition | undefined): nutrition is Nutrition {
  return Boolean(nutrition && NUTRIENT_KEYS.some((key) => nutrition[key] != null))
}

export interface DayContribution {
  id: string
  label: string
  kind: 'meal' | 'log'
  /** Set for meals whose recipe has no numbers, so the day can say so. */
  missing?: boolean
  recipeId?: string
  nutrition: Nutrition
}

export interface DayTotals {
  date: string
  total: Nutrition
  contributions: DayContribution[]
  /** Meals that could not be counted because their recipe has no nutrition. */
  uncounted: number
}

/**
 * One day, added up. Each planned meal counts as one serving eaten — that is
 * what a plan means for one person — whether it is cooked fresh or eaten as
 * leftovers. Log entries count their quantity. Meals with nothing to count are
 * listed, not silently skipped.
 */
export function dayTotals(
  date: string,
  meals: PlannedMeal[],
  recipesById: Map<string, Recipe>,
  log: NutritionLogEntry[],
): DayTotals {
  let total: Nutrition = {}
  const contributions: DayContribution[] = []
  let uncounted = 0

  for (const meal of meals) {
    if (meal.date !== date) continue
    if (meal.kind === 'skip' || meal.kind === 'eating-out') continue
    const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
    const label = recipe?.title ?? meal.customName ?? 'Meal'
    if (!recipe || !hasNutrition(recipe.nutrition)) {
      uncounted++
      contributions.push({ id: meal.id, label, kind: 'meal', missing: true, recipeId: recipe?.id, nutrition: {} })
      continue
    }
    contributions.push({ id: meal.id, label, kind: 'meal', recipeId: recipe.id, nutrition: recipe.nutrition })
    total = addNutrition(total, recipe.nutrition)
  }

  for (const entry of log) {
    if (entry.date !== date) continue
    const scaled = scaleNutrition(entry.nutrition, entry.quantity || 1)
    contributions.push({ id: entry.id, label: entry.name, kind: 'log', nutrition: scaled })
    total = addNutrition(total, scaled)
  }

  return { date, total: roundNutrition(total), contributions, uncounted }
}

/** The targets to measure against: the user's, with the Daily Value filling gaps. */
export function resolveTargets(targets: NutritionTargets | undefined): Record<NutrientKey, number> {
  const out = {} as Record<NutrientKey, number>
  for (const nutrient of NUTRIENTS) {
    const own = targets?.[nutrient.key]
    out[nutrient.key] = own != null && own > 0 ? own : nutrient.dailyValue
  }
  return out
}

export function percentOfTarget(value: number | undefined, target: number): number {
  if (value == null || target <= 0) return 0
  return Math.round((value / target) * 100)
}

export function formatNutrient(key: NutrientKey, value: number | undefined): string {
  if (value == null) return '—'
  const info = NUTRIENTS.find((n) => n.key === key)
  const rounded = key === 'calories' || key === 'sodium' || key === 'cholesterol' ? Math.round(value) : round(value, 1)
  return info?.unit === 'kcal' ? `${rounded}` : `${rounded} ${info?.unit ?? ''}`.trim()
}
