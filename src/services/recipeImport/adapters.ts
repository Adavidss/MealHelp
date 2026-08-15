import type { ImportSettings } from '@/models'
import { PageFetchError, fetchRecipePage } from './fetchPage'
import { hostnameOf, parseRecipeFromHtml } from './jsonLd'
import { parseRecipeText } from './parseText'
import {
  RecipeImportError,
  type RecipeImportAdapter,
  type RecipeImportResult,
} from './types'

/**
 * Import settings for the current run. The adapter interface takes a string and
 * nothing else, so the screen hands these over before starting rather than
 * threading a second argument through every adapter that does not need one.
 */
let activeImportSettings: ImportSettings = { useSharedFetchers: true }

/** Not a React hook — a plain setter the screen calls before importing. */
export function configureImportFetching(settings: ImportSettings): void {
  activeImportSettings = settings
}

/** A web address rather than words: has a scheme, or looks like host.tld/… */
export function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim()
  if (/\s/.test(trimmed)) return false
  return /^https?:\/\/\S+$/i.test(trimmed) || /^[\w-]+(\.[\w-]+)+\/\S*/.test(trimmed)
}

/**
 * The built-in browser's address bar has to decide between "go there" and
 * "search for that", and people type bare hostnames — budgetbytes.com — which
 * the stricter check above (written for pasted links) does not accept.
 */
export function looksLikeAddress(input: string): boolean {
  const trimmed = input.trim()
  if (looksLikeUrl(trimmed)) return true
  if (/\s/.test(trimmed)) return false
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(trimmed) && /\.[a-z]{2,}(\/|$)/i.test(trimmed)
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withScheme)
  // Tracking parameters change nothing about the recipe and make the stored
  // source URL ugly and long.
  for (const param of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_cid|mc_eid)/i.test(param)) url.searchParams.delete(param)
  }
  return url.toString()
}

/**
 * Reads the page by whatever route will actually work — see fetchPage for the
 * order it tries and why.
 *
 * When every route fails, the error distinguishes *which* failure it was:
 * "this site turns away robots" and "this page has no recipe on it" need
 * completely different things from the user, and telling them apart is the
 * difference between a useful message and a shrug.
 */
export const urlAdapter: RecipeImportAdapter = {
  id: 'url',
  label: 'Recipe website',
  canHandle: looksLikeUrl,
  async import(input: string): Promise<RecipeImportResult> {
    const url = normalizeUrl(input)

    let html: string
    try {
      html = (await fetchRecipePage(url, activeImportSettings)).html
    } catch (error) {
      if (error instanceof PageFetchError) {
        throw new RecipeImportError(
          error.botBlocked ? 'blocked' : 'network',
          error.message,
          error.botBlocked
            ? 'Open the recipe in your browser and tap the MealHelp button — that reads the page you are already looking at, which no site can refuse.'
            : 'Paste the recipe text below instead.',
        )
      }
      throw new RecipeImportError('blocked', 'That page could not be read.')
    }

    const parsed = parseRecipeFromHtml(html, url)

    if (!parsed) {
      // Either the page genuinely has no recipe markup, or what came back was a
      // wall dressed as a page. Both are fixed by reading it in your own
      // browser, so that is what gets offered first.
      throw new RecipeImportError(
        'no-recipe',
        `MealHelp reached ${hostnameOf(url) ?? 'the page'} but couldn't find a recipe on it.`,
        'Open it in your browser and tap the MealHelp button, or paste the recipe text below.',
      )
    }

    return { recipe: parsed.draft, warnings: parsed.warnings, adapterId: 'url' }
  },
}

/**
 * Handles a paste of page *source* — what you get from "view source" or from a
 * browser extension — which still contains the JSON-LD block.
 */
export const htmlPasteAdapter: RecipeImportAdapter = {
  id: 'html-paste',
  label: 'Pasted page source',
  canHandle(input: string) {
    return /<script[^>]+application\/ld\+json/i.test(input) || /<\/(html|body|div)>/i.test(input)
  },
  async import(input: string): Promise<RecipeImportResult> {
    const parsed = parseRecipeFromHtml(input)
    if (!parsed) {
      // Falling through to plain text is better than refusing: the markup still
      // contains the words, even if the structured data does not.
      const text = htmlToText(input)
      const fallback = parseRecipeText(text)
      return {
        recipe: fallback.draft,
        warnings: [
          'No structured recipe data was found in that page, so MealHelp read the text instead.',
          ...fallback.warnings,
        ],
        adapterId: 'html-paste',
      }
    }
    return { recipe: parsed.draft, warnings: parsed.warnings, adapterId: 'html-paste' }
  },
}

/** The always-available fallback: plain text copied off a page. */
export const textPasteAdapter: RecipeImportAdapter = {
  id: 'text-paste',
  label: 'Pasted recipe text',
  canHandle(input: string) {
    return input.trim().length > 0
  },
  async import(input: string): Promise<RecipeImportResult> {
    const parsed = parseRecipeText(input)
    return { recipe: parsed.draft, warnings: parsed.warnings, adapterId: 'text-paste' }
  },
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,nav,header,footer').forEach((el) => el.remove())
  return doc.body?.innerText ?? doc.body?.textContent ?? ''
}

export const IMPORT_ADAPTERS: RecipeImportAdapter[] = [
  urlAdapter,
  htmlPasteAdapter,
  textPasteAdapter,
]

/** Runs the first adapter that recognises the input. */
export async function importRecipe(input: string): Promise<RecipeImportResult> {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new RecipeImportError('empty', 'Enter a recipe link, or paste the recipe text.')
  }

  const adapter = IMPORT_ADAPTERS.find((candidate) => candidate.canHandle(trimmed))
  if (!adapter) {
    throw new RecipeImportError(
      'unsupported',
      "MealHelp didn't recognise that. Paste the recipe text and it will convert it.",
    )
  }

  return adapter.import(trimmed)
}
