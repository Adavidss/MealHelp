import type { EffortLevel, Recipe, Score5 } from '@/models'

/**
 * Recipes arrive from the web with almost none of the planning metadata the
 * recommendation engine wants. Rather than nagging for it, MealHelp infers a
 * sensible default from what a recipe does say; anything the user fills in by
 * hand always wins.
 *
 * All the 1–5 scales point the same way: 5 is the answer you want on a Tuesday.
 */

export function activeMinutes(recipe: Recipe): number {
  if (recipe.activeTimeMinutes != null) return recipe.activeTimeMinutes
  if (recipe.prepTimeMinutes != null) {
    // A slow cooker runs itself, so its cook time is not work.
    const handsOff =
      recipe.cookingMethods.includes('slow-cooker') ||
      recipe.cookingMethods.includes('instant-pot') ||
      recipe.cookingMethods.includes('oven') ||
      recipe.cookingMethods.includes('sheet-pan')
    return handsOff
      ? recipe.prepTimeMinutes
      : recipe.prepTimeMinutes + (recipe.cookTimeMinutes ?? 0) * 0.5
  }
  return recipe.totalTimeMinutes ?? 45
}

export function totalMinutes(recipe: Recipe): number | undefined {
  if (recipe.totalTimeMinutes != null) return recipe.totalTimeMinutes
  if (recipe.prepTimeMinutes == null && recipe.cookTimeMinutes == null) return undefined
  return (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)
}

function clamp5(value: number): Score5 {
  return Math.max(1, Math.min(5, Math.round(value))) as Score5
}

export function leftoverScore(recipe: Recipe): Score5 {
  if (recipe.leftoverScore) return recipe.leftoverScore
  if (recipe.reheatsWell === false) return 2
  const servings = recipe.servings ?? 4
  let score = 3
  if (servings >= 8) score += 2
  else if (servings >= 6) score += 1
  if (recipe.reheatsWell) score += 1
  if (recipe.cookingMethods.includes('slow-cooker')) score += 1
  return clamp5(score)
}

export function bulkScore(recipe: Recipe): Score5 {
  if (recipe.bulkScore) return recipe.bulkScore
  const servings = recipe.servings ?? 4
  if (servings >= 10) return 5
  if (servings >= 8) return 5
  if (servings >= 6) return 4
  if (servings >= 4) return 3
  return 2
}

export function cleanupScore(recipe: Recipe): Score5 {
  if (recipe.cleanupScore) return recipe.cleanupScore
  let score = 3
  if (recipe.cookingMethods.includes('one-pot')) score += 2
  if (recipe.cookingMethods.includes('sheet-pan')) score += 2
  if (recipe.cookingMethods.includes('slow-cooker')) score += 1
  if (recipe.cookingMethods.includes('instant-pot')) score += 1
  if (recipe.cookingMethods.includes('no-cook')) score += 1
  if (recipe.cookingMethods.length >= 3) score -= 1
  return clamp5(score)
}

export function weeknightScore(recipe: Recipe): Score5 {
  if (recipe.weeknightScore) return recipe.weeknightScore
  const active = activeMinutes(recipe)
  if (active <= 15) return 5
  if (active <= 25) return 4
  if (active <= 40) return 3
  if (active <= 60) return 2
  return 1
}

export function reheatScore(recipe: Recipe): Score5 {
  if (recipe.reheatScore) return recipe.reheatScore
  if (recipe.reheatsWell) return 5
  if (recipe.reheatsWell === false) return 1
  return leftoverScore(recipe)
}

export function effortLevel(recipe: Recipe): EffortLevel {
  if (recipe.effort) return recipe.effort
  const active = activeMinutes(recipe)
  if (active <= 12) return 'very-low'
  if (active <= 25) return 'low'
  if (active <= 45) return 'medium'
  return 'high'
}

export function cleanupLevel(recipe: Recipe): EffortLevel {
  if (recipe.cleanup) return recipe.cleanup
  const score = cleanupScore(recipe)
  if (score >= 5) return 'very-low'
  if (score === 4) return 'low'
  if (score === 3) return 'medium'
  return 'high'
}

/**
 * How many meals one cooking session covers for a household of `perMeal`
 * servings. Four servings for a household of two is tonight plus one lunch.
 */
export function mealsCovered(recipe: Recipe, perMeal: number): number {
  const servings = recipe.servings ?? perMeal
  if (perMeal <= 0) return 1
  return Math.max(1, Math.floor(servings / perMeal))
}

/** The set of normalized ingredient keys a recipe needs, for overlap scoring. */
export function ingredientKeys(recipe: Recipe): string[] {
  return recipe.ingredients
    .map((ingredient) => ingredient.ingredientName?.toLowerCase().trim())
    .filter((name): name is string => Boolean(name))
}
