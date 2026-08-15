import type { ImportSettings } from '@/models'

/**
 * Getting the HTML of somebody else's recipe page.
 *
 * A static site cannot do this on its own: browsers refuse cross-origin reads
 * unless the site opts in, and almost no recipe site does. So the page has to
 * be fetched by something that is not a browser tab.
 *
 * There is no single answer that always works, so this tries them in order of
 * how much MealHelp trusts them:
 *
 *   1. The site itself, in case it allows it. Costs nothing to try.
 *   2. The user's own fetcher, if they run one. Nobody else sees what they read.
 *   3. MealHelp's own fetcher — the Worker in `worker/`, run for the site.
 *   4. Shared public fetchers, which are convenient and can be turned off.
 *
 * Even all three together do not cover everything — the larger recipe sites
 * block datacentre traffic outright, and a fetcher of any kind looks exactly
 * like that. Those sites are what the page capture and the paste box are for.
 *
 * The same ladder carries the built-in browser and its web search, which is why
 * the general form below accepts any text and not only HTML.
 */

export type FetchRoute = 'direct' | 'own-proxy' | 'built-in' | 'shared'

export interface FetchedText {
  text: string
  /** Which tier actually produced it, for honest messaging. */
  via: FetchRoute
  finalUrl: string
}

export interface FetchedPage {
  html: string
  /** Which tier actually produced it, for honest messaging. */
  via: FetchRoute
  finalUrl: string
}

export type FetchFailureReason = 'blocked' | 'refused' | 'network' | 'not-html' | 'cancelled'

export class PageFetchError extends Error {
  reason: FetchFailureReason
  /** True when the site answered but refused to serve a robot. */
  botBlocked: boolean

  constructor(reason: FetchFailureReason, message: string, botBlocked = false) {
    super(message)
    this.name = 'PageFetchError'
    this.reason = reason
    this.botBlocked = botBlocked
  }
}

/**
 * MealHelp's own fetcher: the Worker in `worker/`, deployed for the site by
 * whoever runs it. It is tried before any shared fetcher because it is the
 * only route that is fast, uncapped and reliably reachable from the live
 * site — the shared ones turned out to be localhost-only, ten seconds slow,
 * or gone (see below). A fetcher the user sets in Settings still comes first.
 */
export const BUILT_IN_FETCHER = 'https://mealhelp-fetch.kidsdc.workers.dev/?url={url}'

/**
 * Shared fetchers. More than one, deliberately: any of them may disappear,
 * start charging or begin rate-limiting, and none of them should be able to
 * take recipe import down on their own. Checked 2026-08-15 from the live
 * site: corsproxy.io answers only from localhost (a JSON 403 elsewhere),
 * allorigins works but takes ten seconds or more, codetabs was down.
 */
const SHARED_FETCHERS: Array<(url: string) => string> = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

const TIMEOUT_MS = 12_000

/**
 * Signs of a page that answered but served a wall instead of a recipe.
 *
 * The status code is not enough on its own: shared fetchers sometimes pass a
 * challenge page back as a perfectly cheerful 200, and calling that "no recipe
 * found" sends the user off to fix the wrong thing.
 */
const WALL_PHRASES = [
  'access denied',
  'attention required',
  'are you a robot',
  'just a moment',
  'checking your browser',
  'verify you are human',
  'request unsuccessful',
  'security check',
]

export function looksBotBlocked(status: number, html: string): boolean {
  if (status === 403 || status === 429 || status === 401) return true

  /*
   * Only the page's own words count, and only its title and opening copy.
   *
   * Scanning raw markup does not work: a perfectly good BBC Good Food recipe
   * has the word "captcha" inside a consent script, and treating that as a
   * wall broke a site that had been importing fine. Scripts and markup are
   * stripped first, and the search stops after the opening lines — which is
   * all a genuine block page consists of.
   */
  const title = /<title[^>]*>([^<]*)/i.exec(html)?.[1]?.toLowerCase() ?? ''
  if (WALL_PHRASES.some((phrase) => title.includes(phrase))) return true

  const visible = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .slice(0, 1500)
    .toLowerCase()

  return WALL_PHRASES.some((phrase) => visible.includes(phrase))
}

export function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 400).toLowerCase()
  return head.includes('<html') || head.includes('<!doctype') || head.includes('<head')
}

/** RSS, Atom or any other XML document — what a web search comes back as. */
export function looksLikeXml(text: string): boolean {
  const head = text.slice(0, 400).trimStart().toLowerCase()
  return head.startsWith('<?xml') || head.startsWith('<rss') || head.startsWith('<feed')
}

function looksLikeJson(text: string): boolean {
  const head = text.slice(0, 200).trimStart()
  return head.startsWith('{') || head.startsWith('[')
}

export interface FetchOptions {
  /**
   * What counts as a usable answer. A shared fetcher that is down often
   * replies with a JSON error and a 200, and that must not be mistaken for
   * the page.
   */
  accept?: (text: string) => boolean
  /** Lets the caller give up — the built-in browser cancels a load when you tap elsewhere. */
  signal?: AbortSignal
  /**
   * Stop as soon as any route reports a bot wall. A site that turns away one
   * datacentre turns them all away, and while trying every route is fine for
   * a one-off import, it is a long wait for someone browsing.
   */
  stopAtBotWall?: boolean
  timeoutMs?: number
}

type Attempt =
  | { ok: true; text: string }
  | { ok: false; botBlocked: boolean; cancelled?: boolean }

async function attempt(
  requestUrl: string,
  accept: (text: string) => boolean,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Attempt> {
  if (signal?.aborted) return { ok: false, botBlocked: false, cancelled: true }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onOuterAbort = () => controller.abort()
  signal?.addEventListener('abort', onOuterAbort, { once: true })

  try {
    const response = await fetch(requestUrl, {
      signal: controller.signal,
      redirect: 'follow',
    })
    const text = await response.text()

    // A fetcher's own complaint — a JSON error about plans, keys or limits —
    // arrives with a 4xx too, and must not be mistaken for the site's wall:
    // no recipe site turns robots away with a JSON body.
    if (looksLikeJson(text)) return { ok: false, botBlocked: false }

    if (!response.ok || looksBotBlocked(response.status, text)) {
      return { ok: false, botBlocked: looksBotBlocked(response.status, text) }
    }
    if (!accept(text)) return { ok: false, botBlocked: false }
    return { ok: true, text }
  } catch {
    return { ok: false, botBlocked: false, cancelled: signal?.aborted ?? false }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

/** Where the user's own fetcher wants the address: in place of {url}, or appended. */
export function ownFetcherUrl(template: string, url: string): string {
  return template.includes('{url}')
    ? template.replace('{url}', encodeURIComponent(url))
    : `${template}${template.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`
}

/**
 * Fetches any text resource through the ladder: the site itself, then the
 * user's own fetcher, then the shared ones. Throws a PageFetchError that says
 * *why* nothing worked, because "turned away as a robot" and "could not be
 * reached" need different things from the user.
 */
export async function fetchThroughFetchers(
  url: string,
  settings: ImportSettings = { useSharedFetchers: true },
  options: FetchOptions = {},
): Promise<FetchedText> {
  const accept = options.accept ?? (() => true)
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS
  const { signal } = options
  let sawBotBlock = false

  const routes: Array<{ via: FetchRoute; requestUrl: string }> = [
    { via: 'direct', requestUrl: url },
  ]
  const own = settings.proxyUrl?.trim()
  if (own) routes.push({ via: 'own-proxy', requestUrl: ownFetcherUrl(own, url) })
  if (own !== BUILT_IN_FETCHER) {
    routes.push({ via: 'built-in', requestUrl: ownFetcherUrl(BUILT_IN_FETCHER, url) })
  }
  if (settings.useSharedFetchers) {
    for (const build of SHARED_FETCHERS) routes.push({ via: 'shared', requestUrl: build(url) })
  }

  for (const route of routes) {
    const result = await attempt(route.requestUrl, accept, timeoutMs, signal)
    if (result.ok) return { text: result.text, via: route.via, finalUrl: url }
    if (result.cancelled) {
      throw new PageFetchError('cancelled', 'That page load was cancelled.')
    }
    sawBotBlock ||= result.botBlocked
    if (result.botBlocked && options.stopAtBotWall) break
  }

  if (sawBotBlock) {
    throw new PageFetchError(
      'blocked',
      'That site only serves recipes to a real browser, and turns away anything else.',
      true,
    )
  }

  throw new PageFetchError('refused', 'That site would not share its page with MealHelp.')
}

export async function fetchRecipePage(
  url: string,
  settings: ImportSettings = { useSharedFetchers: true },
  options: Omit<FetchOptions, 'accept'> = {},
): Promise<FetchedPage> {
  const fetched = await fetchThroughFetchers(url, settings, { ...options, accept: looksLikeHtml })
  return { html: fetched.text, via: fetched.via, finalUrl: fetched.finalUrl }
}
