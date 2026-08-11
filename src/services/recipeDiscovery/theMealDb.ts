import type { RecipeDraft } from '@/models'
import { toRecipeDraft } from '@/services/recipeImport'
import {
  DiscoveryError,
  OFFLINE_MESSAGE,
  type DiscoveryProvider,
  type DiscoveryResult,
} from './types'

/**
 * TheMealDB — a free, keyless, CORS-enabled recipe database.
 *
 * Chosen because it needs no account and no server of ours standing in front
 * of it, which keeps discovery from quietly becoming infrastructure MealHelp
 * depends on. Recipes it returns are converted into ordinary MealHelp recipes
 * on save, keeping their original source link, and from then on they are the
 * user's own — nothing here is needed to cook them again.
 */

const BASE = 'https://www.themealdb.com/api/json/v1/1'
const TIMEOUT_MS = 9000
const PROVIDER_ID = 'themealdb'

/** The API repeats ingredient/measure pairs as numbered fields, 1 to 20. */
const MAX_INGREDIENT_FIELDS = 20

interface MealSummary {
  idMeal: string
  strMeal: string
  strMealThumb?: string
}

interface MealDetail extends MealSummary {
  strCategory?: string
  strArea?: string
  strInstructions?: string
  strSource?: string
  strYoutube?: string
  strTags?: string
  [key: string]: string | undefined
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new DiscoveryError('offline', OFFLINE_MESSAGE)
  }

  // A hanging request is worse than a failed one: it leaves a spinner forever.
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  const composite = signal
    ? AbortSignal.any([signal, timeout.signal])
    : timeout.signal

  try {
    const response = await fetch(`${BASE}${path}`, { signal: composite })
    if (!response.ok) {
      throw new DiscoveryError(
        'unreachable',
        'The recipe database is not answering right now.',
        'Try again in a moment, or paste a recipe in from any website.',
      )
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DiscoveryError) throw error
    if (signal?.aborted) throw error
    throw new DiscoveryError(
      'unreachable',
      "MealHelp couldn't reach the recipe database.",
      'Check your connection, or paste a recipe in from any website.',
    )
  } finally {
    clearTimeout(timer)
  }
}

function toResult(meal: MealSummary): DiscoveryResult {
  return {
    providerId: PROVIDER_ID,
    externalId: meal.idMeal,
    title: meal.strMeal,
    image: meal.strMealThumb,
    category: (meal as MealDetail).strCategory,
    cuisine: (meal as MealDetail).strArea,
  }
}

/**
 * Preparation words this source likes to hide in the measure field, where they
 * would otherwise be read as part of the ingredient's name — leaving "chopped
 * garlic clove" as a different grocery item from "garlic".
 */
const MEASURE_PREP_WORDS = [
  'finely chopped',
  'roughly chopped',
  'thinly sliced',
  'freshly grated',
  'chopped',
  'diced',
  'minced',
  'sliced',
  'grated',
  'shredded',
  'crushed',
  'cubed',
  'halved',
  'quartered',
  'peeled',
  'beaten',
  'melted',
  'softened',
  'drained',
  'rinsed',
  'trimmed',
  'cooked',
]

/** "1 chopped" + "Tomato" → "1 Tomato, chopped"; "2 sprigs" + "Thyme" is left alone. */
export function composeIngredientLine(measure: string, name: string): string {
  const trimmed = measure.trim()
  if (!trimmed) return name

  const lower = trimmed.toLowerCase()
  const prep = MEASURE_PREP_WORDS.find(
    (word) => lower === word || lower.endsWith(` ${word}`),
  )
  if (!prep) return `${trimmed} ${name}`

  const amount = trimmed.slice(0, trimmed.length - prep.length).trim()
  const head = amount ? `${amount} ${name}` : name
  return `${head}, ${prep}`
}

/** "1 whole" + "Chicken" → "1 whole Chicken", which the parser then reads. */
export function ingredientLinesFrom(meal: MealDetail): string[] {
  const lines: string[] = []
  for (let i = 1; i <= MAX_INGREDIENT_FIELDS; i++) {
    const name = meal[`strIngredient${i}`]?.trim()
    if (!name) continue
    lines.push(composeIngredientLine(meal[`strMeasure${i}`] ?? '', name))
  }
  return lines
}

/**
 * Converts one API record into a draft. Pure, so the shape of somebody else's
 * JSON is pinned down by tests rather than discovered in production.
 */
export function mealToDraft(meal: MealDetail): RecipeDraft {
  const instructionTexts = (meal.strInstructions ?? '')
    .split(/\r?\n+/)
    .map((step) => step.replace(/^\s*(?:step\s*)?\d+[.):]\s*/i, '').trim())
    .filter(Boolean)

  const tags = (meal.strTags ?? '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)

  const categories = [meal.strCategory, meal.strArea].filter(
    (value): value is string => Boolean(value),
  )

  const draft = toRecipeDraft({
    title: meal.strMeal,
    image: meal.strMealThumb,
    // The original publisher's page when there is one, so credit and the real
    // recipe are never lost behind an API id.
    sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    sourceName: meal.strSource ? hostOf(meal.strSource) : 'TheMealDB',
    ingredientLines: ingredientLinesFrom(meal),
    instructionTexts,
    tags,
    categories,
  })

  return draft
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/** TheMealDB wants underscores where an ingredient has spaces. */
export function toIngredientQuery(ingredient: string): string {
  return ingredient.trim().toLowerCase().replace(/\s+/g, '_')
}

/**
 * Browsing, rather than searching.
 *
 * This database is small but it is *organised* — every recipe carries a
 * category and a cuisine — which makes "show me Japanese food" a better way
 * into a few hundred recipes than typing guesses into a search box.
 */
export async function listCategories(signal?: AbortSignal): Promise<string[]> {
  const data = await getJson<{ meals: Array<{ strCategory: string }> | null }>(
    '/list.php?c=list',
    signal,
  )
  return (data.meals ?? []).map((entry) => entry.strCategory).filter(Boolean)
}

/**
 * The cuisines this database actually holds recipes for.
 *
 * Its own list endpoint returns 195 countries, most of which have nothing —
 * tapping "French" or "Andorran" would open an empty screen. Checking them at
 * runtime is not an option either: it is 195 requests against a free service
 * that rate-limits, which is both rude and unreliable. So the list is fixed,
 * measured once against the live API.
 *
 * The cost of it being out of date is a cuisine not offered, never a dead end.
 */
const CUISINES_WITH_RECIPES = [
  'Algerian',
  'Australian',
  'British',
  'Canadian',
  'Chinese',
  'Croatian',
  'Egyptian',
  'Filipino',
  'Greek',
  'Irish',
  'Italian',
  'Jamaican',
  'Japanese',
  'Kenyan',
  'Malaysian',
  'Mexican',
  'Moroccan',
  'Polish',
  'Portuguese',
  'Russian',
  'Spanish',
  'Thai',
  'Tunisian',
  'Turkish',
  'Ukrainian',
  'Uruguayan',
  'Vietnamese',
]

export function listCuisines(): string[] {
  return CUISINES_WITH_RECIPES
}

export async function browseByCategory(
  category: string,
  signal?: AbortSignal,
): Promise<DiscoveryResult[]> {
  const data = await getJson<{ meals: MealSummary[] | null }>(
    `/filter.php?c=${encodeURIComponent(category)}`,
    signal,
  )
  return (data.meals ?? []).map(toResult)
}

export async function browseByCuisine(
  cuisine: string,
  signal?: AbortSignal,
): Promise<DiscoveryResult[]> {
  const data = await getJson<{ meals: MealSummary[] | null }>(
    `/filter.php?a=${encodeURIComponent(cuisine)}`,
    signal,
  )
  return (data.meals ?? []).map(toResult)
}

export const theMealDbProvider: DiscoveryProvider = {
  id: PROVIDER_ID,
  label: 'TheMealDB',
  attribution: 'Results from TheMealDB',
  attributionUrl: 'https://www.themealdb.com',

  async searchByText(query, signal) {
    const data = await getJson<{ meals: MealDetail[] | null }>(
      `/search.php?s=${encodeURIComponent(query.trim())}`,
      signal,
    )
    return (data.meals ?? []).map(toResult)
  },

  async searchByIngredient(ingredient, signal) {
    const data = await getJson<{ meals: MealSummary[] | null }>(
      `/filter.php?i=${encodeURIComponent(toIngredientQuery(ingredient))}`,
      signal,
    )
    return (data.meals ?? []).map(toResult)
  },

  async random(signal) {
    const data = await getJson<{ meals: MealDetail[] | null }>('/random.php', signal)
    return (data.meals ?? []).map(toResult)
  },

  async fetchRecipe(externalId, signal) {
    const data = await getJson<{ meals: MealDetail[] | null }>(
      `/lookup.php?i=${encodeURIComponent(externalId)}`,
      signal,
    )
    const meal = data.meals?.[0]
    if (!meal) {
      throw new DiscoveryError('empty', 'That recipe could not be loaded.')
    }
    return mealToDraft(meal)
  },
}
