import type { RecipeDraft } from '@/models'
import { toRecipeDraft } from '@/services/recipeImport'
import {
  DiscoveryError,
  OFFLINE_MESSAGE,
  type DiscoveryProvider,
  type DiscoveryResult,
} from './types'

/**
 * Spoonacular — a much larger recipe database, opened with a key the user
 * brings themselves.
 *
 * TheMealDB is free and needs no account, which is why it is the default, but
 * it holds a few hundred recipes: fine for browsing, thin for searching. This
 * covers hundreds of thousands, and searches properly by ingredient.
 *
 * The key is the user's own and is stored on their device like everything else.
 * Nothing is shipped in the app, because a key baked into a static site is a
 * key given away to everyone who views source.
 */

const BASE = 'https://api.spoonacular.com'
const TIMEOUT_MS = 12_000
const PROVIDER_ID = 'spoonacular'

interface SearchItem {
  id: number
  title: string
  image?: string
  usedIngredients?: Array<{ name: string }>
  missedIngredients?: Array<{ name: string }>
}

interface RecipeDetail {
  id: number
  title: string
  image?: string
  servings?: number
  readyInMinutes?: number
  preparationMinutes?: number
  cookingMinutes?: number
  sourceUrl?: string
  sourceName?: string
  creditsText?: string
  dishTypes?: string[]
  cuisines?: string[]
  diets?: string[]
  extendedIngredients?: Array<{ original?: string; originalString?: string }>
  analyzedInstructions?: Array<{ steps?: Array<{ step: string }> }>
  instructions?: string
}

async function getJson<T>(
  path: string,
  key: string,
  signal?: AbortSignal,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new DiscoveryError('offline', OFFLINE_MESSAGE)
  }

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  const composite = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal
  const separator = path.includes('?') ? '&' : '?'

  try {
    const response = await fetch(`${BASE}${path}${separator}apiKey=${encodeURIComponent(key)}`, {
      signal: composite,
    })

    if (response.status === 401 || response.status === 403) {
      throw new DiscoveryError(
        'unreachable',
        'That Spoonacular key was not accepted.',
        'Check the key in Settings, or turn it off to go back to the free database.',
      )
    }
    if (response.status === 402 || response.status === 429) {
      throw new DiscoveryError(
        'unreachable',
        "Today's Spoonacular allowance is used up.",
        'The free database still works — switch source above.',
      )
    }
    if (!response.ok) {
      throw new DiscoveryError('unreachable', 'Spoonacular is not answering right now.')
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DiscoveryError) throw error
    if (signal?.aborted) throw error
    throw new DiscoveryError('unreachable', "MealHelp couldn't reach Spoonacular.")
  } finally {
    clearTimeout(timer)
  }
}

function toResult(item: SearchItem): DiscoveryResult {
  return {
    providerId: PROVIDER_ID,
    externalId: String(item.id),
    title: item.title,
    image: item.image,
  }
}

/** Pure: the API record → a MealHelp draft. */
export function spoonacularToDraft(recipe: RecipeDetail): RecipeDraft {
  const ingredientLines = (recipe.extendedIngredients ?? [])
    .map((ingredient) => ingredient.original ?? ingredient.originalString ?? '')
    .map((line) => line.trim())
    .filter(Boolean)

  const stepped = (recipe.analyzedInstructions ?? [])
    .flatMap((group) => group.steps ?? [])
    .map((step) => step.step.trim())
    .filter(Boolean)

  const instructionTexts = stepped.length
    ? stepped
    : (recipe.instructions ?? '')
        .replace(/<[^>]+>/g, '\n')
        .split(/\n+/)
        .map((step) => step.trim())
        .filter(Boolean)

  const prep = recipe.preparationMinutes && recipe.preparationMinutes > 0
    ? recipe.preparationMinutes
    : undefined
  const cook = recipe.cookingMinutes && recipe.cookingMinutes > 0
    ? recipe.cookingMinutes
    : undefined

  return toRecipeDraft({
    title: recipe.title,
    image: recipe.image,
    servings: recipe.servings,
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: recipe.readyInMinutes,
    sourceUrl: recipe.sourceUrl,
    sourceName: recipe.sourceName ?? recipe.creditsText,
    ingredientLines,
    instructionTexts,
    tags: [...(recipe.diets ?? []), ...(recipe.dishTypes ?? [])]
      .map((tag) => tag.toLowerCase())
      .slice(0, 8),
    categories: recipe.cuisines ?? [],
  })
}

export function createSpoonacularProvider(key: string): DiscoveryProvider {
  return {
    id: PROVIDER_ID,
    label: 'Spoonacular',
    attribution: 'Results from Spoonacular, using your key',
    attributionUrl: 'https://spoonacular.com/food-api',

    async searchByText(query, signal) {
      const data = await getJson<{ results: SearchItem[] }>(
        `/recipes/complexSearch?number=25&query=${encodeURIComponent(query.trim())}`,
        key,
        signal,
      )
      return (data.results ?? []).map(toResult)
    },

    async searchByIngredient(ingredient, signal) {
      const data = await getJson<SearchItem[]>(
        `/recipes/findByIngredients?number=25&ranking=2&ignorePantry=true&ingredients=${encodeURIComponent(ingredient.trim())}`,
        key,
        signal,
      )
      return (data ?? []).map(toResult)
    },

    async random(signal) {
      const data = await getJson<{ recipes: SearchItem[] }>(
        '/recipes/random?number=5',
        key,
        signal,
      )
      return (data.recipes ?? []).map(toResult)
    },

    async fetchRecipe(externalId, signal) {
      const data = await getJson<RecipeDetail>(
        `/recipes/${encodeURIComponent(externalId)}/information`,
        key,
        signal,
      )
      return spoonacularToDraft(data)
    },
  }
}

/**
 * Spoonacular can search several ingredients at once and rank by how few are
 * missing, so the multi-request overlap trick the free provider needs is not
 * required here.
 */
export async function spoonacularByIngredients(
  key: string,
  ingredients: string[],
  signal?: AbortSignal,
): Promise<Array<{ result: DiscoveryResult; matched: string[] }>> {
  const cleaned = ingredients.map((item) => item.trim()).filter(Boolean)
  if (!cleaned.length) return []

  const data = await getJson<SearchItem[]>(
    `/recipes/findByIngredients?number=30&ranking=2&ignorePantry=true&ingredients=${encodeURIComponent(cleaned.join(','))}`,
    key,
    signal,
  )

  return (data ?? []).map((item) => ({
    result: toResult(item),
    matched: (item.usedIngredients ?? []).map((used) => used.name),
  }))
}
