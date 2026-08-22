import type { Recipe } from '@/models'
import {
  activeMinutes,
  bulkScore,
  cleanupScore,
  effortLevel,
  leftoverScore,
} from '@/services/recipeMetrics'

/**
 * The words people actually use to pick a recipe.
 *
 * "Crock pot meal" and "simple" are not fields on a recipe — they are things
 * you can tell *about* a recipe from what it is made of and how long it takes.
 * MealHelp already works all of that out for the planner; this puts the same
 * judgements in front of the user as something they can tap.
 *
 * Each one is a plain predicate so the browsing screen, the filter counts and
 * the badges on a card can never disagree about what "simple" means.
 */

export interface Characteristic {
  id: string
  label: string
  /** Shown on a card when true. Some filters are useful but not worth a badge. */
  badge: boolean
  /** Lower sorts first when a card has several. */
  priority: number
  matches: (recipe: Recipe) => boolean
}

export const CHARACTERISTICS: Characteristic[] = [
  {
    id: 'slow-cooker',
    label: 'Crock-Pot',
    badge: true,
    priority: 1,
    matches: (recipe) => recipe.cookingMethods.includes('slow-cooker'),
  },
  {
    id: 'instant-pot',
    label: 'Instant Pot',
    badge: true,
    priority: 1,
    matches: (recipe) => recipe.cookingMethods.includes('instant-pot'),
  },
  {
    id: 'one-pot',
    label: 'One pot',
    badge: true,
    priority: 2,
    matches: (recipe) => recipe.cookingMethods.includes('one-pot'),
  },
  {
    id: 'sheet-pan',
    label: 'Sheet pan',
    badge: true,
    priority: 2,
    matches: (recipe) => recipe.cookingMethods.includes('sheet-pan'),
  },
  {
    id: 'air-fryer',
    label: 'Air fryer',
    badge: true,
    priority: 2,
    matches: (recipe) => recipe.cookingMethods.includes('air-fryer'),
  },
  {
    id: 'no-cook',
    label: 'No cooking',
    badge: true,
    priority: 2,
    matches: (recipe) => recipe.cookingMethods.includes('no-cook'),
  },
  {
    id: 'simple',
    label: 'Simple',
    badge: true,
    priority: 3,
    matches: (recipe) => {
      const effort = effortLevel(recipe)
      return effort === 'very-low' || effort === 'low'
    },
  },
  {
    id: 'quick',
    label: 'Quick',
    badge: true,
    priority: 3,
    matches: (recipe) => activeMinutes(recipe) <= 25,
  },
  {
    /**
     * The slow cooker case: hours on the clock, minutes of your attention.
     * Worth its own label because "quick" and "takes all day" are both true.
     */
    id: 'hands-off',
    label: 'Hands off',
    badge: true,
    priority: 3,
    matches: (recipe) => {
      const cook = recipe.cookTimeMinutes ?? 0
      return cook >= 90 && activeMinutes(recipe) <= 25
    },
  },
  {
    id: 'big-batch',
    label: 'Big batch',
    badge: true,
    priority: 4,
    matches: (recipe) => bulkScore(recipe) >= 4,
  },
  {
    id: 'leftovers',
    label: 'Great leftovers',
    badge: true,
    priority: 4,
    matches: (recipe) => leftoverScore(recipe) >= 4,
  },
  {
    id: 'low-cleanup',
    label: 'Little washing up',
    badge: true,
    priority: 5,
    matches: (recipe) => cleanupScore(recipe) >= 4,
  },
  {
    id: 'freezer',
    label: 'Freezes well',
    badge: true,
    priority: 5,
    matches: (recipe) => Boolean(recipe.freezerFriendly),
  },
  {
    id: 'meal-prep',
    label: 'Meal prep',
    badge: false,
    priority: 6,
    matches: (recipe) => Boolean(recipe.mealPrepFriendly),
  },
  {
    id: 'cheap',
    label: 'Cheap',
    badge: true,
    priority: 5,
    matches: (recipe) => recipe.costTier === '$',
  },
  {
    id: 'favorite',
    label: 'Favorites',
    badge: false,
    priority: 7,
    matches: (recipe) => recipe.favorite,
  },
  {
    id: 'new-to-me',
    label: 'Never cooked',
    badge: false,
    priority: 7,
    matches: (recipe) => (recipe.timesCooked ?? 0) === 0,
  },
  {
    id: 'loved',
    label: 'Highly rated',
    badge: false,
    priority: 7,
    matches: (recipe) => (recipe.rating ?? 0) >= 4,
  },
]

const BY_ID = new Map(CHARACTERISTICS.map((entry) => [entry.id, entry]))

export function characteristicById(id: string): Characteristic | undefined {
  return BY_ID.get(id)
}

/**
 * How many recipes each characteristic would leave. Shown next to every filter
 * so the ones that lead nowhere are visibly empty before they are tapped.
 */
export function countCharacteristics(recipes: Recipe[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of CHARACTERISTICS) {
    counts.set(entry.id, recipes.filter((recipe) => entry.matches(recipe)).length)
  }
  return counts
}

/** Recipes matching every selected characteristic. */
export function filterByCharacteristics(
  recipes: Recipe[],
  selected: string[],
): Recipe[] {
  if (!selected.length) return recipes
  const active = selected
    .map((id) => BY_ID.get(id))
    .filter((entry): entry is Characteristic => Boolean(entry))
  return recipes.filter((recipe) => active.every((entry) => entry.matches(recipe)))
}

/**
 * Artwork for a recipe with no photograph.
 *
 * Most recipes people type in have no picture, and a browsing screen full of
 * grey rectangles is not a browsing screen. The title picks a warm colour
 * deterministically, so a recipe looks the same every time you see it and the
 * wall of cards stays distinguishable.
 */
export const TILE_PALETTES = 6

/**
 * FNV-1a with a final mix, rather than the obvious `hash * 31 % 100000`.
 *
 * That simpler version clumps badly here: reducing modulo 100000 before taking
 * modulo 6 leaves a bias, and a real library came out with five of twelve
 * recipes on the same colour — which is exactly the wall of identical tiles
 * this is meant to avoid.
 */
export function tilePalette(recipe: Pick<Recipe, 'title'>): number {
  let hash = 2_166_136_261
  for (const character of recipe.title) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0x5bd1e995)
  hash ^= hash >>> 15

  return Math.abs(hash) % TILE_PALETTES
}
