import { hostnameOf, parseRecipeFromHtml } from './jsonLd'
import { parseRecipeText } from './parseText'
import {
  PASTE_FALLBACK_MESSAGE,
  RecipeImportError,
  type RecipeImportAdapter,
  type RecipeImportResult,
} from './types'

function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim()
  if (/\s/.test(trimmed)) return false
  return /^https?:\/\/\S+$/i.test(trimmed) || /^[\w-]+(\.[\w-]+)+\/\S*/.test(trimmed)
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
 * Reads the page straight from the browser.
 *
 * This works for sites that send permissive CORS headers and fails for the many
 * that do not. That failure is expected, not exceptional: it hands over to the
 * paste flow with an explanation instead of showing a network error.
 */
export const directFetchAdapter: RecipeImportAdapter = {
  id: 'direct-fetch',
  label: 'Recipe website',
  canHandle: looksLikeUrl,
  async import(input: string): Promise<RecipeImportResult> {
    const url = normalizeUrl(input)

    let response: Response
    try {
      response = await fetch(url, {
        headers: { Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      })
    } catch {
      throw new RecipeImportError('blocked', PASTE_FALLBACK_MESSAGE, `Blocked by ${hostnameOf(url) ?? 'the site'}.`)
    }

    if (!response.ok) {
      throw new RecipeImportError(
        'network',
        `${hostnameOf(url) ?? 'That site'} answered with an error (${response.status}).`,
        'Check the link, or paste the recipe text instead.',
      )
    }

    const html = await response.text()
    const parsed = parseRecipeFromHtml(html, url)

    if (!parsed) {
      throw new RecipeImportError(
        'no-recipe',
        `MealHelp reached ${hostnameOf(url) ?? 'the page'} but couldn't find a recipe on it.`,
        'Paste the recipe text below and MealHelp will convert it.',
      )
    }

    return { recipe: parsed.draft, warnings: parsed.warnings, adapterId: 'direct-fetch' }
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
  directFetchAdapter,
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
