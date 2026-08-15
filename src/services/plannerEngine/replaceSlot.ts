import type { Recipe } from '@/models'
import { rankRecipes, type ScoredRecipe, type ScoringContext } from '@/services/recommendationEngine'
import { loadLimit, pickRecipe, type GeneratedSlot } from './generatePlan'

/**
 * Changing one night of a generated week without disturbing the rest.
 *
 * A cooking night is not an island: the leftover nights after it eat from it,
 * so a new recipe on Monday has to become Tuesday's leftovers too, and it has
 * to be cooked in a batch big enough for both. Both of these live here so
 * that "replace with the one I picked" and "try another" behave the same way.
 */

/** How many leftover nights eat from the cooking session on `date`. */
export function dependentsOf(slots: GeneratedSlot[], date: string): number {
  return slots.filter((slot) => slot.kind === 'leftover' && slot.sourceDate === date).length
}

/**
 * Puts `recipe` on `date` and carries it through to the leftover nights that
 * depend on that session. Servings are sized the way the planner sizes them:
 * the recipe's own yield, or enough for every night it has to feed, whichever
 * is more.
 */
export function replaceCookSlot(
  slots: GeneratedSlot[],
  date: string,
  recipe: Recipe,
  perMeal: number,
  reasons: string[],
): GeneratedSlot[] {
  const dependents = dependentsOf(slots, date)
  const minServings = (dependents + 1) * perMeal
  const servings = Math.max(recipe.servings ?? perMeal, minServings)
  const fullReasons =
    dependents > 0
      ? [`Cooks ${servings} servings — enough for ${dependents + 1} nights`, ...reasons]
      : reasons

  return slots.map((slot) => {
    if (slot.date === date) {
      return {
        ...slot,
        kind: 'recipe',
        recipeId: recipe.id,
        recipe,
        servings,
        unfilled: false,
        reasons: fullReasons,
      }
    }
    if (slot.kind === 'leftover' && slot.sourceDate === date) {
      return { ...slot, recipeId: recipe.id, recipe }
    }
    return slot
  })
}

export interface SuggestAnotherOptions {
  slots: GeneratedSlot[]
  date: string
  library: Recipe[]
  /** The week's scoring context — preferences, pantry, equipment, recency. */
  context: ScoringContext
  perMeal: number
  /** How busy the day is, when the user said. */
  dayLoad?: ScoringContext['dayLoad']
  /** Recipes turned down for this night already, so they do not come back. */
  passedOver?: ReadonlySet<string>
}

export interface SuggestedReplacement {
  slots: GeneratedSlot[]
  scored: ScoredRecipe
}

/**
 * The next-best recipe for one night, ranked against the rest of the week
 * exactly as the planner would rank it — same context, the other nights as
 * "already chosen" for variety, the batch size the leftover nights need — but
 * with the current pick and everything passed over before taken out of the
 * running. Returns nothing when the library has run dry for that night.
 */
export function suggestAnother(options: SuggestAnotherOptions): SuggestedReplacement | undefined {
  const { slots, date, library, perMeal } = options
  const current = slots.find((slot) => slot.date === date)
  if (!current) return undefined

  const otherRecipes = slots
    .filter((slot) => slot.date !== date && slot.kind === 'recipe' && slot.recipe)
    .map((slot) => slot.recipe as Recipe)
  const usedIds = new Set(otherRecipes.map((recipe) => recipe.id))

  const excluded = new Set<string>(options.passedOver ?? [])
  if (current.recipeId) excluded.add(current.recipeId)
  for (const id of options.context.excludeRecipeIds ?? []) excluded.add(id)

  const dependents = dependentsOf(slots, date)
  const minServings = (dependents + 1) * perMeal

  const candidates = rankRecipes(
    library.filter((recipe) => !usedIds.has(recipe.id)),
    {
      ...options.context,
      dayLoad: options.dayLoad,
      maxActiveTimeMinutes: options.context.maxActiveTimeMinutes ?? loadLimit(options.dayLoad),
      chosenRecipes: otherRecipes,
      minServings,
      excludeRecipeIds: excluded,
    },
  )

  const chosen = pickRecipe(candidates, {
    minServings: dependents > 0 ? minServings : undefined,
  })
  if (!chosen) return undefined

  return {
    scored: chosen,
    slots: replaceCookSlot(slots, date, chosen.recipe, perMeal, chosen.reasons),
  }
}
