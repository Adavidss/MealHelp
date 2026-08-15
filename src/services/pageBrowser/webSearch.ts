import type { ImportSettings } from '@/models'
import {
  PageFetchError,
  fetchThroughFetchers,
  hostnameOf,
  looksLikeHtml,
  looksLikeXml,
} from '@/services/recipeImport'
import type { WebSearchPage, WebSearchResult } from './types'

/**
 * Searching the web from inside MealHelp.
 *
 * A search engine's normal results page is built for a browser with scripts
 * on, and most engines answer a datacentre with a robot check instead. Three
 * still answer plainly from somewhere, and MealHelp draws the list itself
 * from what they send:
 *
 *   - Brave Search serves its results page as real HTML, and it is the one
 *     asked first: the results are good and it has never been seen to answer
 *     the wrong question. It rate-limits Cloudflare's addresses, though, so
 *     from the live site (whose fetcher is a Worker) it usually says no.
 *   - DuckDuckGo's lite page — a plain table meant for text browsers — answers
 *     the Worker, and refuses the shared fetchers. One page of ten, no more.
 *   - Bing publishes results as an RSS feed — tiny and stable, and reachable
 *     from anywhere, but with a habit of answering a multi-word query with
 *     results for its first word alone. It is the last resort, and its
 *     answers are checked before use.
 *
 * Which one answers depends on which fetcher the request went through, which
 * is why all three are tried in turn rather than one being chosen. They all
 * reach MealHelp by the same ladder as any recipe page. Nothing about a search
 * is stored anywhere but on the device.
 */

export type SearchEngineId = 'brave' | 'duckduckgo' | 'bing'

interface SearchEngine {
  id: SearchEngineId
  label: string
  pageSize: number
  url: (query: string, offset: number, freshness?: string) => string
  accept: (text: string) => boolean
  parse: (text: string) => WebSearchResult[]
}

export class WebSearchError extends Error {
  suggestion?: string
  constructor(message: string, suggestion?: string) {
    super(message)
    this.name = 'WebSearchError'
    this.suggestion = suggestion
  }
}

/**
 * "chicken tikka masala" and "chicken tikka masala recipe" get very different
 * results, and the second is always the one wanted here. Words the user typed
 * are never removed, only that one added.
 */
export function recipeQuery(raw: string): string {
  const query = raw.trim().replace(/\s+/g, ' ')
  if (!query) return query
  if (/\brecipes?\b/i.test(query)) return query
  return `${query} recipe`
}

/**
 * Places a result can point at that are dead ends here — a video, a social
 * post, a site that is an app rather than pages. Left out rather than shown
 * as something to tap and be disappointed by.
 */
const DEAD_END_HOSTS = [
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'pinterest.co.uk',
  'pinterest.ca',
  'x.com',
  'twitter.com',
  'reddit.com',
]

function isDeadEnd(host: string): boolean {
  return DEAD_END_HOSTS.some((dead) => host === dead || host.endsWith(`.${dead}`))
}

/** Adds a result to the list, unless it is a repeat, unreadable, or a dead end. */
function collect(results: WebSearchResult[], seen: Set<string>, candidate: {
  url?: string | null
  title?: string | null
  snippet?: string | null
}): void {
  const url = candidate.url?.trim() ?? ''
  const title = candidate.title?.replace(/\s+/g, ' ').trim() ?? ''
  if (!/^https?:\/\//i.test(url) || !title) return
  const host = hostnameOf(url) ?? url
  if (isDeadEnd(host)) return
  const key = url.replace(/#.*$/, '').replace(/\/$/, '')
  if (seen.has(key)) return
  seen.add(key)
  const snippet = candidate.snippet?.replace(/\s+/g, ' ').trim() || undefined
  results.push({ title, url, host, snippet })
}

/* ---------- Brave ---------- */

/** Brave's results page. `offset` is a page number; the freshness marker keeps shared caches honest. */
export function braveSearchUrl(query: string, offset = 0, freshness?: string): string {
  const url = new URL('https://search.brave.com/search')
  url.searchParams.set('q', query)
  url.searchParams.set('source', 'web')
  if (offset > 0) url.searchParams.set('offset', String(offset))
  if (freshness) url.searchParams.set('_', freshness)
  return url.toString()
}

/** Reads results out of Brave's page. Hooks chosen for being semantic, not decorative. */
export function parseBraveResults(html: string): WebSearchResult[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const seen = new Set<string>()
  const results: WebSearchResult[] = []
  for (const snippet of doc.querySelectorAll('[data-type="web"]')) {
    const anchor = snippet.querySelector('a[href^="http"]')
    const titleEl = snippet.querySelector('.title')
    // The first block inside .content is the description; what follows it on
    // recipe results is a row of ratings, times and calories.
    const content = snippet.querySelector('.content')
    const description = (content?.querySelector(':scope > div') ?? content)?.textContent
    collect(results, seen, {
      url: anchor?.getAttribute('href'),
      title: titleEl?.getAttribute('title') || titleEl?.textContent || anchor?.textContent,
      snippet: description?.replace(LEADING_DATE, ''),
    })
  }
  return results
}

/** "October 4, 2024 -", "4 days ago -", "Yesterday -": how descriptions open, saying nothing. */
const LEADING_DATE =
  /^\s*(?:[A-Z][a-z]+ \d{1,2}, \d{4}|\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago|yesterday|today)\s*-\s*/i

/* ---------- DuckDuckGo lite ---------- */

/** The lite page. Later pages need a POSTed token, so there is only ever this one. */
export function duckDuckGoLiteUrl(query: string, offset = 0, freshness?: string): string {
  const url = new URL('https://lite.duckduckgo.com/lite/')
  url.searchParams.set('q', query)
  if (offset > 0) url.searchParams.set('s', String(offset))
  if (freshness) url.searchParams.set('_', freshness)
  return url.toString()
}

/** Result links point at a DuckDuckGo redirect with the real address in `uddg`. */
function unwrapDuckDuckGoLink(href: string): string | undefined {
  try {
    const url = new URL(href, 'https://duckduckgo.com/')
    if (/(^|\.)duckduckgo\.com$/.test(url.hostname) && url.pathname === '/l/') {
      return url.searchParams.get('uddg') ?? undefined
    }
    return url.toString()
  } catch {
    return undefined
  }
}

/** Reads results out of the lite page: a link row, then a snippet row, ten times. */
export function parseDuckDuckGoLite(html: string): WebSearchResult[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const seen = new Set<string>()
  const results: WebSearchResult[] = []
  const links = [...doc.querySelectorAll('a.result-link')]
  const snippets = [...doc.querySelectorAll('td.result-snippet')]
  links.forEach((link, index) => {
    collect(results, seen, {
      url: unwrapDuckDuckGoLink(link.getAttribute('href') ?? ''),
      title: link.textContent,
      snippet: snippets[index]?.textContent,
    })
  })
  return results
}

/* ---------- Bing ---------- */

/**
 * Bing's RSS endpoint. Spaces go as %20 — a + is read as a literal plus.
 *
 * `freshness` is folded into the address so that shared fetchers, which cache
 * by URL, do not serve one stale answer for ever: an hourly bucket means a
 * repeated search within the hour is quick, and a bad answer is gone by the
 * next. A retry passes something finer to get past the cache entirely.
 */
export function bingRssUrl(query: string, offset = 0, freshness?: string): string {
  const url = new URL('https://www.bing.com/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'rss')
  if (offset > 0) url.searchParams.set('first', String(offset + 1))
  if (freshness) url.searchParams.set('_', freshness)
  return url.toString().replace(/\+/g, '%20')
}

/** Reads results out of the feed. Tolerant: one odd item is skipped, not fatal. */
export function parseBingRss(xml: string): WebSearchResult[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return []
  const seen = new Set<string>()
  const results: WebSearchResult[] = []
  for (const item of doc.querySelectorAll('item')) {
    collect(results, seen, {
      url: item.querySelector('link')?.textContent,
      title: item.querySelector('title')?.textContent,
      snippet: item.querySelector('description')?.textContent,
    })
  }
  return results
}

/* ---------- Judging an answer ---------- */

/** Words that say nothing about which recipe is meant. */
const NOISE_WORDS = new Set([
  'recipe', 'recipes', 'easy', 'best', 'simple', 'quick', 'homemade', 'the', 'a', 'an',
  'and', 'or', 'with', 'for', 'of', 'in', 'to', 'how', 'make', 'made', 'my', 'from',
])

/** The words in a query worth checking results against. */
export function significantTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .map((word) => word.replace(/'s$/, ''))
        .filter((word) => word.length >= 3 && !NOISE_WORDS.has(word)),
    ),
  ]
}

/**
 * Bing sometimes answers a multi-word query with results for its first word
 * — "slow cooker chili recipe" comes back as dictionary entries for "slow".
 * Those answers are recognisable: most results mention almost none of the
 * words that were asked for.
 */
export function looksOffTopic(query: string, results: WebSearchResult[]): boolean {
  const terms = significantTerms(query)
  if (terms.length < 2 || results.length === 0) return false
  const needed = Math.ceil(terms.length / 2)
  const onTopic = results.filter((result) => {
    const haystack = `${result.title} ${result.snippet ?? ''}`.toLowerCase()
    return terms.filter((term) => haystack.includes(term)).length >= needed
  })
  return onTopic.length < results.length / 2
}

/* ---------- The search ---------- */

const ENGINES: Record<SearchEngineId, SearchEngine> = {
  brave: {
    id: 'brave',
    label: 'Brave Search',
    pageSize: 20,
    url: (query, offset, freshness) => braveSearchUrl(query, offset / 20, freshness),
    accept: looksLikeHtml,
    parse: parseBraveResults,
  },
  duckduckgo: {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    // One page only: asking for more needs a token that only a POST carries,
    // so a full page is reported as the end rather than as "more".
    pageSize: Number.POSITIVE_INFINITY,
    url: duckDuckGoLiteUrl,
    accept: looksLikeHtml,
    parse: parseDuckDuckGoLite,
  },
  bing: {
    id: 'bing',
    label: 'Bing',
    pageSize: 10,
    url: bingRssUrl,
    accept: looksLikeXml,
    parse: parseBingRss,
  },
}

const ENGINE_ORDER: SearchEngineId[] = ['brave', 'duckduckgo', 'bing']

export interface WebSearchOptions {
  signal?: AbortSignal
  /** Zero-based offset into the results, as returned in `nextOffset`. */
  offset?: number
  /** Stay with the engine that answered page one, so later pages line up. */
  engine?: SearchEngineId
  /** For tests: what "now" is, for the freshness bucket. */
  now?: number
}

async function fetchAnswer(
  url: string,
  engine: SearchEngine,
  settings: ImportSettings,
  signal?: AbortSignal,
): Promise<string | undefined> {
  try {
    const fetched = await fetchThroughFetchers(url, settings, {
      accept: engine.accept,
      signal,
      stopAtBotWall: true,
    })
    return fetched.text
  } catch (error) {
    if (error instanceof PageFetchError && error.reason === 'cancelled') throw error
    return undefined
  }
}

export async function webSearch(
  rawQuery: string,
  settings: ImportSettings,
  options: WebSearchOptions = {},
): Promise<WebSearchPage> {
  const query = recipeQuery(rawQuery)
  if (!query) throw new WebSearchError('Type something to search for.')

  const offset = options.offset ?? 0
  const now = options.now ?? Date.now()
  const hourly = String(Math.floor(now / 3_600_000))
  const order = options.engine ? [ENGINES[options.engine]] : ENGINE_ORDER.map((id) => ENGINES[id])

  const page = (engine: SearchEngine, results: WebSearchResult[]): WebSearchPage => ({
    query,
    results,
    engine: engine.id,
    engineLabel: engine.label,
    nextOffset: results.length >= engine.pageSize ? offset + engine.pageSize : undefined,
  })

  let fallback: WebSearchPage | undefined
  let reached = false

  for (const engine of order) {
    const answer = await fetchAnswer(engine.url(query, offset, hourly), engine, settings, options.signal)
    if (answer == null) continue
    reached = true

    let results = engine.parse(answer)
    if (engine.id === 'bing' && looksOffTopic(query, results)) {
      // Once more, past every cache. Keep whichever answer is about the question.
      const fresh = await fetchAnswer(engine.url(query, offset, String(now)), engine, settings, options.signal)
      const retried = fresh == null ? [] : engine.parse(fresh)
      if (retried.length && !looksOffTopic(query, retried)) results = retried
      else if (retried.length > results.length) results = retried
    }

    if (results.length && !looksOffTopic(query, results)) return page(engine, results)
    if (results.length && (!fallback || results.length > fallback.results.length)) {
      fallback = page(engine, results)
    }
  }

  if (fallback) return fallback
  if (reached) return page(order[0], [])

  throw new WebSearchError(
    "MealHelp couldn't reach a search engine.",
    'Check the connection and try again, or open a recipe site from the start page.',
  )
}
