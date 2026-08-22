import type { ImportSettings } from '@/models'
import { fetchThroughFetchers, looksLikeHtml } from '@/services/recipeImport'

/**
 * The picture a page uses to advertise itself.
 *
 * Search engines that answer a robot return titles and text, never images, so
 * a results list is a wall of blue links — the opposite of what this app is
 * for. Nearly every recipe page carries an `og:image` for exactly this
 * purpose, which is the page's own choice of picture, published to be shown
 * by whoever links to it.
 *
 * The cost is real: reading one means fetching the page. So this is only
 * called for results that have scrolled into view, at most a few at a time,
 * and every answer — including "this page has no picture" — is remembered for
 * the session so scrolling back never pays twice.
 */

const cache = new Map<string, string | null>()
const inFlight = new Map<string, Promise<string | null>>()

/** Two at a time: enough to keep a scrolling list filling in, gentle on the fetcher. */
const MAX_PARALLEL = 2
let active = 0
const queue: Array<() => void> = []

function acquire(): Promise<void> {
  if (active < MAX_PARALLEL) {
    active += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}

function release(): void {
  const next = queue.shift()
  if (next) next()
  else active -= 1
}

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
]

export function previewImageFromHtml(html: string, pageUrl: string): string | undefined {
  for (const pattern of META_PATTERNS) {
    const match = pattern.exec(html)
    if (!match?.[1]) continue
    try {
      // Some sites publish a path rather than a URL.
      return new URL(decodeEntities(match[1]), pageUrl).toString()
    } catch {
      continue
    }
  }
  return undefined
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

/** What is already known, without fetching anything. */
export function cachedPreviewImage(url: string): string | null | undefined {
  return cache.get(url)
}

export async function previewImage(
  url: string,
  settings: ImportSettings,
  signal?: AbortSignal,
): Promise<string | null> {
  const known = cache.get(url)
  if (known !== undefined) return known
  const running = inFlight.get(url)
  if (running) return running

  const work = (async () => {
    await acquire()
    try {
      const page = await fetchThroughFetchers(url, settings, {
        accept: looksLikeHtml,
        signal,
        // A page that turns away robots will not hand over its picture
        // either, and waiting through every fetcher to learn that is a long
        // time to leave a thumbnail spinning.
        stopAtBotWall: true,
        timeoutMs: 9000,
      })
      const image = previewImageFromHtml(page.text, url) ?? null
      cache.set(url, image)
      return image
    } catch {
      // Remembered as "no picture": a page that would not answer once will
      // not answer on the next scroll either.
      cache.set(url, null)
      return null
    } finally {
      release()
      inFlight.delete(url)
    }
  })()

  inFlight.set(url, work)
  return work
}
