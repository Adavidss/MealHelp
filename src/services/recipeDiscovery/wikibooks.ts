import type { RecipeDraft } from '@/models'
import { toRecipeDraft } from '@/services/recipeImport'
import {
  DiscoveryError,
  OFFLINE_MESSAGE,
  type DiscoveryProvider,
  type DiscoveryResult,
} from './types'

/**
 * The Wikibooks Cookbook — thousands of recipes, no key, no account, and run by
 * the Wikimedia Foundation rather than a company that might start charging on a
 * Tuesday. The text is CC BY-SA, so saving one is squarely allowed as long as
 * the page it came from is credited, which every saved recipe keeps.
 *
 * The trade is that these are wiki pages rather than database rows: headings
 * vary, and some entries are hub pages listing variants instead of recipes.
 * Both are handled below.
 */

const API = 'https://en.wikibooks.org/w/api.php'
const PROVIDER_ID = 'wikibooks'
const NAMESPACE = 102 // The Cookbook has a namespace of its own.
const TIMEOUT_MS = 12_000

/**
 * Cookbook pages that are reference material rather than something to cook.
 * Searching for "chicken" otherwise surfaces the essay about chicken.
 */
const NOT_A_RECIPE =
  /^Cookbook:(Table of Contents|Ingredients|Cuisine of|Cooking|Recipes|Units? of|Equipment|Techniques|Glossary|Basic|Herbs and Spices|Special:)/i

async function callApi<T>(params: string, signal?: AbortSignal): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new DiscoveryError('offline', OFFLINE_MESSAGE)
  }

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  const composite = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal

  try {
    // origin=* is what makes the MediaWiki API answer a browser at all.
    const response = await fetch(`${API}?format=json&origin=*&${params}`, {
      signal: composite,
    })
    if (!response.ok) {
      throw new DiscoveryError('unreachable', 'The Wikibooks Cookbook is not answering.')
    }
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DiscoveryError) throw error
    if (signal?.aborted) throw error
    throw new DiscoveryError('unreachable', "MealHelp couldn't reach the Wikibooks Cookbook.")
  } finally {
    clearTimeout(timer)
  }
}

function toResult(title: string): DiscoveryResult {
  return {
    providerId: PROVIDER_ID,
    externalId: title,
    // "Cookbook:Chicken Curry" is the page name; nobody wants to read the prefix.
    title: title.replace(/^Cookbook:/, ''),
    sourceUrl: `https://en.wikibooks.org/wiki/${encodeURIComponent(title)}`,
  }
}

interface SearchResponse {
  query?: { search?: Array<{ title: string }> }
}

interface ParseResponse {
  parse?: { title?: string; text?: { '*'?: string } }
}

export interface WikibooksExtraction {
  ingredientLines: string[]
  instructionTexts: string[]
  /** Set when the page only lists variants; these are pages to try instead. */
  variants: string[]
}

/**
 * Pulls a recipe out of a rendered Cookbook page.
 *
 * Pure and exported so the shape of a wiki page is pinned down by tests rather
 * than discovered when somebody is trying to cook.
 */
export function extractFromWikibooksHtml(html: string): WikibooksExtraction {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc
    .querySelectorAll('.mw-editsection, style, script, table, .navbox, .metadata, sup')
    .forEach((element) => element.remove())

  const ingredientLines: string[] = []
  const instructionTexts: string[] = []
  let section: 'ingredients' | 'steps' | '' = ''

  for (const element of doc.querySelectorAll('h1, h2, h3, h4, ul, ol, p')) {
    const tag = element.tagName.toLowerCase()

    if (tag.startsWith('h')) {
      const heading = element.textContent?.toLowerCase() ?? ''
      if (/ingredient/.test(heading)) section = 'ingredients'
      else if (/procedure|method|direction|preparation|instruction|steps/.test(heading)) {
        section = 'steps'
      } else section = ''
      continue
    }

    const text = element.textContent?.trim() ?? ''
    if (!text) continue

    if (section === 'ingredients' && (tag === 'ul' || tag === 'ol')) {
      element.querySelectorAll('li').forEach((item) => {
        const line = item.textContent?.trim()
        if (line) ingredientLines.push(line)
      })
    } else if (section === 'steps') {
      if (tag === 'ul' || tag === 'ol') {
        element.querySelectorAll('li').forEach((item) => {
          const line = item.textContent?.trim()
          if (line) instructionTexts.push(line)
        })
      } else if (tag === 'p') {
        instructionTexts.push(text)
      }
    }
  }

  // A page with no ingredients that links to other Cookbook pages is an index
  // of variants — "Guacamole" pointing at "Guacamole I" and "Guacamole II".
  const variants = ingredientLines.length
    ? []
    : [...doc.querySelectorAll('a[href*="/wiki/Cookbook:"]')]
        .map((link) => decodeURIComponent(link.getAttribute('href') ?? ''))
        .map((href) => href.replace(/^.*\/wiki\//, ''))
        .filter((title) => title.startsWith('Cookbook:') && !NOT_A_RECIPE.test(title))
        .slice(0, 5)

  return { ingredientLines, instructionTexts, variants }
}

function draftFrom(title: string, extraction: WikibooksExtraction): RecipeDraft {
  return toRecipeDraft({
    title: title.replace(/^Cookbook:/, ''),
    ingredientLines: extraction.ingredientLines,
    instructionTexts: extraction.instructionTexts,
    sourceUrl: `https://en.wikibooks.org/wiki/${encodeURIComponent(title)}`,
    sourceName: 'Wikibooks Cookbook',
    notes: 'From the Wikibooks Cookbook, shared under CC BY-SA.',
  })
}

export const wikibooksProvider: DiscoveryProvider = {
  id: PROVIDER_ID,
  label: 'Wikibooks Cookbook',
  attribution: 'Wikibooks Cookbook, CC BY-SA',
  attributionUrl: 'https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents',

  async searchByText(query, signal) {
    // Constrained to Category:Recipes. A plain full-text search returns the
    // Cookbook's reference pages too — searching "lasagne" otherwise offers
    // you Basil, Celery and the Manual of Style, because they mention it.
    const data = await callApi<SearchResponse>(
      `action=query&list=search&srnamespace=${NAMESPACE}&srlimit=20&srsearch=${encodeURIComponent(
        `incategory:Recipes ${query.trim()}`,
      )}`,
      signal,
    )
    return (data.query?.search ?? [])
      .map((hit) => hit.title)
      .filter((title) => !NOT_A_RECIPE.test(title))
      .map(toResult)
  },

  async searchByIngredient(ingredient, signal) {
    return wikibooksProvider.searchByText(ingredient, signal)
  },

  async random(signal) {
    // Drawn from Category:Recipes rather than the whole namespace, for the same
    // reason as the search: a random Cookbook page is often not a recipe.
    const data = await callApi<{
      query?: { categorymembers?: Array<{ title: string }> }
    }>(
      `action=query&list=categorymembers&cmtitle=${encodeURIComponent(
        'Category:Recipes',
      )}&cmnamespace=${NAMESPACE}&cmlimit=500`,
      signal,
    )

    const titles = (data.query?.categorymembers ?? [])
      .map((page) => page.title)
      .filter((title) => !NOT_A_RECIPE.test(title))

    const picked: string[] = []
    while (picked.length < 4 && titles.length) {
      const [chosen] = titles.splice(Math.floor(Math.random() * titles.length), 1)
      picked.push(chosen)
    }
    return picked.map(toResult)
  },

  async fetchRecipe(externalId, signal) {
    const load = async (page: string) => {
      const data = await callApi<ParseResponse>(
        `action=parse&prop=text&page=${encodeURIComponent(page)}`,
        signal,
      )
      const html = data.parse?.text?.['*'] ?? ''
      return { html, title: data.parse?.title ?? page }
    }

    const first = await load(externalId)
    const extraction = extractFromWikibooksHtml(first.html)

    if (extraction.ingredientLines.length) {
      return draftFrom(first.title, extraction)
    }

    // Hub page: follow the first variant it lists rather than showing nothing.
    for (const variant of extraction.variants) {
      const next = await load(variant)
      const nested = extractFromWikibooksHtml(next.html)
      if (nested.ingredientLines.length) return draftFrom(next.title, nested)
    }

    throw new DiscoveryError(
      'empty',
      `"${externalId.replace(/^Cookbook:/, '')}" is a page about the dish rather than a recipe for it.`,
      'Try one of the other results.',
    )
  },
}
