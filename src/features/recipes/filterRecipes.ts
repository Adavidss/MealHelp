import type { CookingMethod, Recipe } from '@/models'
import { COOKING_METHOD_LABELS } from '@/models'
import { activeMinutes, bulkScore, leftoverScore } from '@/services/recipeMetrics'

/**
 * Library search and filtering.
 *
 * The haystack for each recipe is built once and cached against the recipe
 * object, so typing into the search box is a string scan over a few thousand
 * pre-built strings rather than a walk of every ingredient array on every
 * keystroke.
 */
const HAYSTACKS = new WeakMap<Recipe, { updatedAt: string; text: string }>()

function haystack(recipe: Recipe): string {
  const cached = HAYSTACKS.get(recipe)
  if (cached && cached.updatedAt === recipe.updatedAt) return cached.text

  const parts = [
    recipe.title,
    recipe.description ?? '',
    recipe.notes ?? '',
    recipe.sourceName ?? '',
    recipe.author ?? '',
    recipe.tags.join(' '),
    recipe.categories.join(' '),
    recipe.equipment.join(' '),
    recipe.cookingMethods.map((method) => COOKING_METHOD_LABELS[method]).join(' '),
    // "crockpot" is what people type; the label says "Slow Cooker".
    recipe.cookingMethods.join(' ').replace(/-/g, ''),
    recipe.cookingMethods.includes('slow-cooker') ? 'crockpot crock pot' : '',
    recipe.ingredients.map((i) => i.ingredientName).join(' '),
    recipe.instructions.map((s) => s.text).join(' '),
    `${Math.round(activeMinutes(recipe))} minute min`,
  ]

  const text = parts.join(' \n ').toLowerCase()
  HAYSTACKS.set(recipe, { updatedAt: recipe.updatedAt, text })
  return text
}

export interface RecipeFilters {
  query?: string
  methods?: CookingMethod[]
  tags?: string[]
  favoritesOnly?: boolean
  neverCooked?: boolean
  quickOnly?: boolean
  bulkOnly?: boolean
  leftoverFriendly?: boolean
  freezerFriendly?: boolean
  mealPrepFriendly?: boolean
  highlyRated?: boolean
  recipeIds?: string[]
}

export const RECIPE_SORTS = [
  'recent',
  'title',
  'rating',
  'last-cooked',
  'most-cooked',
  'quickest',
] as const
export type RecipeSort = (typeof RECIPE_SORTS)[number]

export const RECIPE_SORT_LABELS: Record<RecipeSort, string> = {
  recent: 'Recently added',
  title: 'Name',
  rating: 'Highest rated',
  'last-cooked': 'Recently cooked',
  'most-cooked': 'Most cooked',
  quickest: 'Quickest',
}

/** A recipe with 20 minutes of hands-on work counts as quick. */
export const QUICK_MINUTES = 25

export function filterRecipes(
  recipes: Recipe[],
  filters: RecipeFilters,
  sort: RecipeSort = 'recent',
): Recipe[] {
  const tokens = (filters.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const allowedIds = filters.recipeIds ? new Set(filters.recipeIds) : undefined

  const filtered = recipes.filter((recipe) => {
    if (allowedIds && !allowedIds.has(recipe.id)) return false
    if (filters.favoritesOnly && !recipe.favorite) return false
    if (filters.neverCooked && (recipe.timesCooked ?? 0) > 0) return false
    if (filters.highlyRated && (recipe.rating ?? 0) < 4) return false
    if (filters.quickOnly && activeMinutes(recipe) > QUICK_MINUTES) return false
    if (filters.bulkOnly && bulkScore(recipe) < 4) return false
    if (filters.leftoverFriendly && leftoverScore(recipe) < 4) return false
    if (filters.freezerFriendly && !recipe.freezerFriendly) return false
    if (filters.mealPrepFriendly && !recipe.mealPrepFriendly) return false

    if (filters.methods?.length) {
      const hasMethod = filters.methods.some((method) =>
        recipe.cookingMethods.includes(method),
      )
      if (!hasMethod) return false
    }

    if (filters.tags?.length) {
      const hasTag = filters.tags.every((tag) => recipe.tags.includes(tag))
      if (!hasTag) return false
    }

    if (tokens.length) {
      const text = haystack(recipe)
      // Every word must appear somewhere: "instant pot chicken" narrows.
      if (!tokens.every((token) => text.includes(token))) return false
    }

    return true
  })

  return sortRecipes(filtered, sort)
}

export function sortRecipes(recipes: Recipe[], sort: RecipeSort): Recipe[] {
  const sorted = [...recipes]
  switch (sort) {
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'rating':
      return sorted.sort(
        (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title),
      )
    case 'last-cooked':
      return sorted.sort((a, b) => (b.lastCookedAt ?? '').localeCompare(a.lastCookedAt ?? ''))
    case 'most-cooked':
      return sorted.sort((a, b) => (b.timesCooked ?? 0) - (a.timesCooked ?? 0))
    case 'quickest':
      return sorted.sort((a, b) => activeMinutes(a) - activeMinutes(b))
    case 'recent':
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

/** Every tag in the library, most used first, for the filter row. */
export function collectTags(recipes: Recipe[]): string[] {
  const counts = new Map<string, number>()
  for (const recipe of recipes) {
    for (const tag of recipe.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}

export function activeFilterCount(filters: RecipeFilters): number {
  let count = 0
  if (filters.methods?.length) count += filters.methods.length
  if (filters.tags?.length) count += filters.tags.length
  for (const key of [
    'favoritesOnly',
    'neverCooked',
    'quickOnly',
    'bulkOnly',
    'leftoverFriendly',
    'freezerFriendly',
    'mealPrepFriendly',
    'highlyRated',
  ] as const) {
    if (filters[key]) count += 1
  }
  return count
}
