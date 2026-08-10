import type { Recipe } from '@/models'
import { normalizeIngredientKey } from '@/services/ingredientParser'
import { activeMinutes, ingredientKeys } from '@/services/recipeMetrics'

/**
 * "Replace this meal" wants a recipe that slots into the same evening: similar
 * effort, similar yield, ideally overlapping shopping. That is a different
 * question from "what is the best recipe this week", so it gets its own
 * comparison rather than reusing the weekly scorer.
 */
export interface SimilarityResult {
  recipe: Recipe
  similarity: number
  reasons: string[]
}

export function findAlternatives(
  target: Recipe,
  library: Recipe[],
  limit = 8,
): SimilarityResult[] {
  const targetKeys = new Set(ingredientKeys(target).map(normalizeIngredientKey))
  const targetActive = activeMinutes(target)

  return library
    .filter((recipe) => recipe.id !== target.id)
    .map((recipe) => {
      const reasons: string[] = []
      let similarity = 0

      const sharedMethods = recipe.cookingMethods.filter((method) =>
        target.cookingMethods.includes(method),
      )
      if (sharedMethods.length) {
        similarity += 25
        reasons.push('Same kind of cooking')
      }

      const activeDelta = Math.abs(activeMinutes(recipe) - targetActive)
      if (activeDelta <= 10) {
        similarity += 20
        reasons.push('About the same effort')
      } else if (activeDelta <= 25) {
        similarity += 8
      }

      if (target.servings && recipe.servings) {
        const ratio = recipe.servings / target.servings
        if (ratio >= 0.75 && ratio <= 1.35) {
          similarity += 15
          reasons.push('Feeds about the same number')
        }
      }

      const keys = ingredientKeys(recipe).map(normalizeIngredientKey)
      const shared = keys.filter((key) => targetKeys.has(key)).length
      if (keys.length && shared) {
        const share = shared / keys.length
        similarity += share * 30
        if (share > 0.35) reasons.push('Shares most of the shopping')
      }

      const sharedTags = recipe.tags.filter((tag) => target.tags.includes(tag))
      if (sharedTags.length) similarity += Math.min(10, sharedTags.length * 4)

      if (recipe.favorite) similarity += 6
      if (recipe.rating != null) similarity += (recipe.rating - 3) * 2

      return { recipe, similarity, reasons }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}

export interface IngredientMatch {
  recipe: Recipe
  /** Fraction of the recipe's ingredients the user has. */
  coverage: number
  have: string[]
  missing: string[]
}

/**
 * "What can I make?" — ranks by how much of a recipe is already covered, and
 * deliberately does not require full coverage, because one missing spice is
 * not a reason to hide a recipe.
 */
export function matchByIngredients(
  library: Recipe[],
  available: string[],
  options: { minCoverage?: number; limit?: number } = {},
): IngredientMatch[] {
  const { minCoverage = 0.3, limit = 30 } = options
  const availableKeys = available.map(normalizeIngredientKey).filter(Boolean)
  if (!availableKeys.length) return []

  return library
    .map((recipe) => {
      const have: string[] = []
      const missing: string[] = []

      for (const ingredient of recipe.ingredients) {
        const key = normalizeIngredientKey(ingredient.ingredientName ?? '')
        if (!key) continue
        const owned = availableKeys.some(
          (candidate) => key.includes(candidate) || candidate.includes(key),
        )
        if (owned) have.push(ingredient.ingredientName)
        else missing.push(ingredient.ingredientName)
      }

      const total = have.length + missing.length
      return {
        recipe,
        coverage: total ? have.length / total : 0,
        have,
        missing,
      }
    })
    .filter((match) => match.have.length > 0 && match.coverage >= minCoverage)
    .sort((a, b) => b.coverage - a.coverage || a.missing.length - b.missing.length)
    .slice(0, limit)
}
