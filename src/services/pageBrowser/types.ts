import type { JsonLdParseResult } from '@/services/recipeImport'

/**
 * A fetched web page, made ready to show inside MealHelp's own frame.
 *
 * The frame runs with scripts off, so what it shows is the page as the server
 * sent it: the words, the pictures and the styling, none of the pop-ups. That
 * is also why the recipe is read *before* the page is prepared — the
 * structured data lives in script tags, and those are the first thing removed.
 */
export interface PreparedPage {
  /** The document to hand to the frame's srcdoc. */
  html: string
  title: string
  /** The recipe on the page, when its structured data carries one. */
  recipe?: JsonLdParseResult
  /** The page's own idea of its permanent address, if it says. */
  canonicalUrl?: string
  /**
   * The words look like a recipe even if the markup does not carry one, so
   * reading the visible text is worth offering. Always true when `recipe` is.
   */
  readsLikeRecipe: boolean
}

export interface WebSearchResult {
  title: string
  url: string
  /** Hostname without www, for showing where a result leads. */
  host: string
  snippet?: string
}

export interface WebSearchPage {
  /** The query actually sent, which may have had "recipe" added. */
  query: string
  results: WebSearchResult[]
  /** Which engine answered, and how to credit it. */
  engine: 'brave' | 'bing'
  engineLabel: string
  /** Offset for the next page of results, when there is one. */
  nextOffset?: number
}

/** A place worth starting from: a site that opens inside the frame today. */
export interface StartingSite {
  name: string
  url: string
  blurb: string
}
