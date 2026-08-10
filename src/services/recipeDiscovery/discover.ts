import type { Recipe } from '@/models'
import { normalizeIngredientKey } from '@/services/ingredientParser'
import {
  DiscoveryError,
  type DiscoveryProvider,
  type DiscoveryResult,
  type RankedDiscovery,
} from './types'

/**
 * Pantry-aware discovery.
 *
 * Rather than fetching every candidate recipe and comparing ingredient lists,
 * this asks the provider "what uses onions?", "what uses chicken?" and counts
 * how many of those answers each recipe appears in. A recipe that comes back
 * for three of your ingredients uses three of them — no extra requests, and
 * the ranking falls straight out of the search.
 */

/** More than this and it is a shopping list, not a "what have I got" question. */
export const MAX_INGREDIENTS_PER_SEARCH = 6

export interface IngredientSearchResult {
  ingredient: string
  results: DiscoveryResult[]
}

/**
 * Counts how many of the searched ingredients each recipe turned up for.
 * Pure: the network stays in the caller.
 */
export function rankByIngredientOverlap(
  searches: IngredientSearchResult[],
): RankedDiscovery[] {
  const byId = new Map<string, RankedDiscovery>()

  for (const search of searches) {
    for (const result of search.results) {
      const existing = byId.get(result.externalId)
      if (existing) {
        if (!existing.matched.includes(search.ingredient)) {
          existing.matched.push(search.ingredient)
        }
      } else {
        byId.set(result.externalId, { result, matched: [search.ingredient] })
      }
    }
  }

  return [...byId.values()].sort(
    (a, b) =>
      b.matched.length - a.matched.length ||
      a.result.title.localeCompare(b.result.title),
  )
}

/** Flags results the user already has, so discovery does not offer duplicates. */
export function markAlreadySaved(
  ranked: RankedDiscovery[],
  library: Recipe[],
): RankedDiscovery[] {
  const titles = new Set(library.map((recipe) => recipe.title.trim().toLowerCase()))
  return ranked.map((entry) => ({
    ...entry,
    alreadySaved: titles.has(entry.result.title.trim().toLowerCase()),
  }))
}

export interface DiscoverByIngredientsOptions {
  signal?: AbortSignal
  library?: Recipe[]
  /** Drop anything using fewer than this many of the chosen ingredients. */
  minMatches?: number
}

export async function discoverByIngredients(
  provider: DiscoveryProvider,
  ingredients: string[],
  options: DiscoverByIngredientsOptions = {},
): Promise<RankedDiscovery[]> {
  const chosen = [
    ...new Set(
      ingredients
        .map((ingredient) => ingredient.trim())
        .filter(Boolean)
        .map((ingredient) => ingredient.toLowerCase()),
    ),
  ].slice(0, MAX_INGREDIENTS_PER_SEARCH)

  if (!chosen.length) return []

  const settled = await Promise.allSettled(
    chosen.map(async (ingredient) => ({
      ingredient,
      results: await provider.searchByIngredient(ingredient, options.signal),
    })),
  )

  const searches = settled
    .filter(
      (entry): entry is PromiseFulfilledResult<IngredientSearchResult> =>
        entry.status === 'fulfilled',
    )
    .map((entry) => entry.value)

  // One ingredient the database has never heard of should not sink the search;
  // all of them failing means the database is not reachable at all.
  if (!searches.length) {
    const firstRejection = settled.find((entry) => entry.status === 'rejected')
    if (firstRejection && firstRejection.status === 'rejected') {
      throw firstRejection.reason
    }
    throw new DiscoveryError('unreachable', 'The recipe search did not answer.')
  }

  const ranked = rankByIngredientOverlap(searches)
  const filtered = options.minMatches
    ? ranked.filter((entry) => entry.matched.length >= (options.minMatches as number))
    : ranked

  return options.library ? markAlreadySaved(filtered, options.library) : filtered
}

/**
 * The ingredients worth offering as starting points: pantry staples are dull
 * search terms on their own ("salt"), so the things that actually decide a
 * meal come first.
 */
const WEAK_SEARCH_TERMS = new Set([
  'salt',
  'pepper',
  'black pepper',
  'water',
  'sugar',
  'olive oil',
  'vegetable oil',
  'oil',
  'flour',
  'baking powder',
  'baking soda',
  'vinegar',
])

export function isUsefulSearchIngredient(name: string): boolean {
  return !WEAK_SEARCH_TERMS.has(normalizeIngredientKey(name))
}

export function suggestedSearchIngredients(pantryNames: string[]): string[] {
  return pantryNames.filter(isUsefulSearchIngredient)
}
