import type { Nutrition, Recipe, RecipeIngredient } from '@/models'
import { convert, dimensionOf, normalizeUnit } from '@/services/unitConversion'
import { normalizeIngredientKey } from '@/services/ingredientParser'
import { FOOD_TABLE, type FoodEntry } from './foodTable'
import { round } from './parseSchemaNutrition'

/**
 * Estimating a recipe's nutrition from its ingredient lines.
 *
 * The method is Tandoor's recipe-property calculation with the food table
 * built in: find the food an ingredient line is talking about, work out how
 * many grams the line amounts to, multiply by the food's values per 100 g,
 * add it all up and divide by the servings.
 *
 * It is an estimate and it says so. Coverage — how many lines were
 * recognised and weighed — travels with the numbers, so "estimated from 7 of
 * 9 ingredients" can be shown rather than a confident-looking total.
 */

export interface NutritionEstimate {
  perServing: Nutrition
  /** Lines that were recognised and could be weighed, out of all lines. */
  matched: number
  total: number
  /** Ingredient names that contributed nothing, for the user to see. */
  unmatched: string[]
  servings: number
}

/** The longest matching food wins, so "chicken stock" is stock, not chicken. */
export function findFood(ingredientName: string): FoodEntry | undefined {
  const key = ` ${normalizeIngredientKey(ingredientName)} `
  if (key.trim() === '') return undefined
  let best: { entry: FoodEntry; length: number } | undefined
  for (const entry of FOOD_TABLE) {
    for (const term of entry.match) {
      const needle = ` ${normalizeIngredientKey(term)}`
      const index = key.indexOf(needle)
      if (index === -1) continue
      // A term must end at a word boundary (plurals handled by normalisation).
      const after = key[index + needle.length]
      if (after !== ' ' && after !== undefined && !/^[a-z]/.test(after ?? '')) continue
      if (!best || term.length > best.length) best = { entry, length: term.length }
    }
  }
  return best?.entry
}

/** How many grams one ingredient line comes to, or undefined when it cannot be weighed. */
export function gramsOf(ingredient: RecipeIngredient, food: FoodEntry): number | undefined {
  const amount = ingredient.quantity
  if (amount == null) return undefined
  const unit = normalizeUnit(ingredient.unit)

  if (!unit) {
    // "2 eggs", "1 onion": a count of the thing itself.
    return food.grams?.each != null ? amount * food.grams.each : undefined
  }

  const dimension = dimensionOf(unit)
  if (dimension === 'mass') {
    return convert(amount, unit, 'g') ?? undefined
  }

  if (dimension === 'volume') {
    // Volume needs the food's own density: a cup of flour is not a cup of oil.
    const perCup = food.grams?.cup
    const perTbsp = food.grams?.tbsp ?? (perCup ? perCup / 16 : undefined)
    const perTsp = food.grams?.tsp ?? (perTbsp ? perTbsp / 3 : undefined)
    const ml = convert(amount, unit, 'ml')
    if (ml == null) return undefined
    if (perCup) return (ml / 236.588) * perCup
    if (perTbsp) return (ml / 14.7868) * perTbsp
    if (perTsp) return (ml / 4.92892) * perTsp
    // No density known: treat it as water, which is right for stock and
    // nearly right for most liquids.
    return ml
  }

  // A unit the registry does not convert: clove, slice, can, stalk, bunch…
  const special = food.grams?.[unit as keyof NonNullable<FoodEntry['grams']>]
  if (special != null) return amount * special
  if (/^(clove|slice|can|stalk|bunch|head|sprig|leaf|piece|item)s?$/.test(unit) && food.grams?.each) {
    return amount * food.grams.each
  }
  return undefined
}

function contribution(food: FoodEntry, grams: number): Nutrition {
  const factor = grams / 100
  return {
    calories: food.kcal * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: (food.fiber ?? 0) * factor,
    sugar: (food.sugar ?? 0) * factor,
    sodium: (food.sodium ?? 0) * factor,
  }
}

export function estimateNutrition(recipe: Pick<Recipe, 'ingredients' | 'servings'>): NutritionEstimate {
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 4
  const totals: Required<Pick<Nutrition, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium'>> = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  }
  let matched = 0
  const unmatched: string[] = []
  const lines = recipe.ingredients.filter((line) => line.ingredientName?.trim())

  for (const line of lines) {
    const food = findFood(line.ingredientName)
    const grams = food ? gramsOf(line, food) : undefined
    if (!food || grams == null) {
      unmatched.push(line.ingredientName)
      continue
    }
    matched++
    const part = contribution(food, grams)
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] += part[key] ?? 0
    }
  }

  const perServing: Nutrition = {}
  for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
    perServing[key] = round(totals[key] / servings, key === 'calories' || key === 'sodium' ? 0 : 1)
  }

  return { perServing, matched, total: lines.length, unmatched, servings }
}
