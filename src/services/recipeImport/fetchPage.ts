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
 *   3. Shared public fetchers, which are convenient and can be turned off.
 *
 * Even all three together do not cover everything — the larger recipe sites
 * block datacentre traffic outright, and a fetcher of any kind looks exactly
 * like that. Those sites are what the page capture and the paste box are for.
 */

export interface FetchedPage {
  html: string
  /** Which tier actually produced it, for honest messaging. */
  via: 'direct' | 'own-proxy' | 'shared'
  finalUrl: string
}

export type FetchFailureReason = 'blocked' | 'refused' | 'network' | 'not-html'

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
 * Shared fetchers. More than one, deliberately: any of them may disappear,
 * start charging or begin rate-limiting, and none of them should be able to
 * take recipe import down on their own.
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

function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 400).toLowerCase()
  return head.includes('<html') || head.includes('<!doctype') || head.includes('<head')
}

async function attempt(requestUrl: string): Promise<{ ok: true; html: string } | { ok: false; botBlocked: boolean }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(requestUrl, {
      signal: controller.signal,
      redirect: 'follow',
    })
    const text = await response.text()

    if (!response.ok || looksBotBlocked(response.status, text)) {
      return { ok: false, botBlocked: looksBotBlocked(response.status, text) }
    }
    if (!looksLikeHtml(text)) return { ok: false, botBlocked: false }
    return { ok: true, html: text }
  } catch {
    return { ok: false, botBlocked: false }
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchRecipePage(
  url: string,
  settings: ImportSettings = { useSharedFetchers: true },
): Promise<FetchedPage> {
  let sawBotBlock = false

  const direct = await attempt(url)
  if (direct.ok) return { html: direct.html, via: 'direct', finalUrl: url }
  sawBotBlock ||= direct.botBlocked

  const own = settings.proxyUrl?.trim()
  if (own) {
    const target = own.includes('{url}')
      ? own.replace('{url}', encodeURIComponent(url))
      : `${own}${own.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`
    const viaOwn = await attempt(target)
    if (viaOwn.ok) return { html: viaOwn.html, via: 'own-proxy', finalUrl: url }
    sawBotBlock ||= viaOwn.botBlocked
  }

  if (settings.useSharedFetchers) {
    for (const build of SHARED_FETCHERS) {
      const viaShared = await attempt(build(url))
      if (viaShared.ok) return { html: viaShared.html, via: 'shared', finalUrl: url }
      sawBotBlock ||= viaShared.botBlocked
    }
  }

  if (sawBotBlock) {
    throw new PageFetchError(
      'blocked',
      'That site only serves recipes to a real browser, and turns away anything else.',
      true,
    )
  }

  throw new PageFetchError(
    'refused',
    "That site would not share its page with MealHelp.",
  )
}
