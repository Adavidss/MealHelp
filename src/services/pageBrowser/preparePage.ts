import { hostnameOf, parseRecipeFromDocument } from '@/services/recipeImport'
import type { PreparedPage } from './types'

/**
 * Turning somebody else's page into something MealHelp can safely show.
 *
 * The frame it goes into is sandboxed with scripts off, so nothing here can
 * run — but a page written for a browser with JavaScript needs help to look
 * right without it. Lazily loaded pictures never get their real address, a
 * meta refresh would carry the frame off to a place MealHelp cannot follow,
 * and preload hints would fetch megabytes of script that will never execute.
 * This fixes what can be fixed and drops what cannot be used.
 *
 * What is deliberately kept: the site's own stylesheets and images, so the
 * page still looks like the site and not like a text dump. What is
 * deliberately not attempted: hiding cookie banners or ads by guessing at
 * class names — most of those are drawn by scripts and never appear anyway,
 * and guessing wrong hides the recipe.
 */

/** Elements that either cannot work without scripts or would fetch things nothing will use. */
const STRIP_SELECTOR = [
  'script',
  'iframe',
  'frame',
  'object',
  'embed',
  'applet',
  'meta[http-equiv="refresh" i]',
  'meta[http-equiv="content-security-policy" i]',
  'link[rel~="preload" i]',
  'link[rel~="modulepreload" i]',
  'link[rel~="prefetch" i]',
  'link[rel~="prerender" i]',
  'link[rel~="preconnect" i]',
  'link[rel~="dns-prefetch" i]',
  'link[rel~="manifest" i]',
  'link[rel~="serviceworker" i]',
].join(',')

/** Where lazy-loading libraries keep the real picture. */
const LAZY_SRC_ATTRIBUTES = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-url']
const LAZY_SRCSET_ATTRIBUTES = ['data-srcset', 'data-lazy-srcset']
const LAZY_SIZES_ATTRIBUTES = ['data-sizes', 'data-lazy-sizes']

/** Tracking beacons dressed as pictures. */
const BEACON_PATTERN =
  /facebook\.com\/tr\b|google-analytics\.com|googletagmanager\.com|doubleclick\.net|bat\.bing\.com|scorecardresearch|quantserve|pixel\.wp\.com|\/pixel[./?]|\/beacon[./?]/i

/*
 * Masks are the one decoration that has to go. A CSS mask image must be
 * same-origin with the document, and inside the frame the document is
 * MealHelp — so a site's own circle-shaped photo masks fail to load, and a
 * failed mask hides the picture completely. No mask beats no picture.
 */
const FRAME_STYLE = `
html.async-hide { opacity: 1 !important; }
html, body { overflow-y: auto !important; height: auto !important; }
img.lazyload, img.lazyloading, img[data-src], img[data-lazy-src], .lazyload, .lazyloading {
  opacity: 1 !important; visibility: visible !important;
}
*, *::before, *::after { -webkit-mask-image: none !important; mask-image: none !important; }
`.trim()

function firstAttribute(el: Element, names: string[]): string | undefined {
  for (const name of names) {
    const value = el.getAttribute(name)?.trim()
    if (value) return value
  }
  return undefined
}

/** A src that is standing in for the real one until a script arrives. */
function isPlaceholderSrc(src: string | null): boolean {
  if (!src) return true
  const value = src.trim().toLowerCase()
  if (!value) return true
  if (value.startsWith('data:')) return true
  return /placeholder|blank\.gif|spacer\.gif|1x1|lazy[-_]?load|transparent\.(gif|png)/.test(value)
}

function looksLikeBeacon(img: HTMLImageElement): boolean {
  const width = img.getAttribute('width')
  const height = img.getAttribute('height')
  if (width === '1' && height === '1') return true
  const src = img.getAttribute('src') ?? ''
  return BEACON_PATTERN.test(src)
}

function unlazyImages(doc: Document): void {
  for (const img of doc.querySelectorAll('img')) {
    if (looksLikeBeacon(img)) {
      img.remove()
      continue
    }
    const lazySrc = firstAttribute(img, LAZY_SRC_ATTRIBUTES)
    if (lazySrc && isPlaceholderSrc(img.getAttribute('src'))) {
      img.setAttribute('src', lazySrc)
    }
    const lazySrcset = firstAttribute(img, LAZY_SRCSET_ATTRIBUTES)
    if (lazySrcset && !img.getAttribute('srcset')) {
      img.setAttribute('srcset', lazySrcset)
    }
    // Without sizes the browser picks the largest candidate for a thumbnail.
    const lazySizes = firstAttribute(img, LAZY_SIZES_ATTRIBUTES)
    if (lazySizes && lazySizes !== 'auto' && !img.getAttribute('sizes')) {
      img.setAttribute('sizes', lazySizes)
    }
    // Lazy-loading libraries hide the picture with a class until the script
    // swaps it. The script is never coming, so mark it as already loaded.
    if (img.classList.contains('lazyload') || img.classList.contains('lazyloading')) {
      img.classList.remove('lazyload', 'lazyloading')
      img.classList.add('lazyloaded')
    }
  }

  for (const source of doc.querySelectorAll('picture source')) {
    const lazySrcset = firstAttribute(source, LAZY_SRCSET_ATTRIBUTES)
    if (lazySrcset && !source.getAttribute('srcset')) source.setAttribute('srcset', lazySrcset)
  }
}

/**
 * With scripting off, the browser shows <noscript> content — usually the
 * plain <img> a lazy loader left as a fallback. That is welcome unless the
 * picture beside it was just un-lazied, in which case it would show twice.
 */
function resolveNoscript(doc: Document): void {
  for (const noscript of doc.querySelectorAll('noscript')) {
    const hasImage = noscript.querySelector('img') != null
    if (!hasImage) {
      noscript.remove()
      continue
    }
    const previous = noscript.previousElementSibling
    const previousWasLazy =
      previous != null &&
      (previous.tagName === 'IMG' || previous.tagName === 'PICTURE') &&
      (firstAttribute(previous, LAZY_SRC_ATTRIBUTES) != null ||
        firstAttribute(previous, LAZY_SRCSET_ATTRIBUTES) != null ||
        previous.querySelector('[data-src],[data-srcset],[data-lazy-src]') != null)
    if (previousWasLazy) {
      noscript.remove()
      continue
    }
    noscript.replaceWith(...noscript.childNodes)
  }
}

function neutraliseMedia(doc: Document): void {
  for (const media of doc.querySelectorAll('video, audio')) {
    media.removeAttribute('autoplay')
    media.setAttribute('preload', 'none')
  }
  // Click beacons: a POST fired at a tracker every time a link is followed.
  for (const anchor of doc.querySelectorAll('a[ping]')) anchor.removeAttribute('ping')
}

function ensureHead(doc: Document): HTMLHeadElement {
  if (doc.head) return doc.head
  const head = doc.createElement('head')
  doc.documentElement.insertBefore(head, doc.documentElement.firstChild)
  return head
}

/**
 * Prepares a fetched page for the frame, and reads the recipe off it first.
 *
 * `pageUrl` is what every relative address on the page is resolved against —
 * the frame's own address is about:srcdoc, which resolves nothing.
 */
export function preparePage(html: string, pageUrl: string): PreparedPage {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const head = ensureHead(doc)

  // First, so that anything reading the document sees addresses resolved
  // against the page rather than against MealHelp.
  for (const stale of doc.querySelectorAll('base')) stale.remove()
  const base = doc.createElement('base')
  base.setAttribute('href', pageUrl)
  head.insertBefore(base, head.firstChild)

  // Pictures and stylesheets are fetched by the frame, and the frame lives at
  // MealHelp's address. Sending that as the referrer tells every image host
  // where you are reading from, and trips the hotlink protection some of
  // them run. Sending nothing does neither.
  for (const stale of doc.querySelectorAll('meta[name="referrer" i]')) stale.remove()
  const referrer = doc.createElement('meta')
  referrer.setAttribute('name', 'referrer')
  referrer.setAttribute('content', 'no-referrer')
  base.after(referrer)

  const canonicalHref = doc.querySelector('link[rel~="canonical" i]')?.getAttribute('href')
  const canonicalUrl = canonicalHref ? resolveUrl(canonicalHref, pageUrl) : undefined

  // The recipe lives in <script type="application/ld+json">, and scripts are
  // about to be removed — so it is read now, while it is still there.
  const recipe = parseRecipeFromDocument(doc, pageUrl)

  for (const el of doc.querySelectorAll(STRIP_SELECTOR)) el.remove()

  unlazyImages(doc)
  resolveNoscript(doc)
  neutraliseMedia(doc)

  const style = doc.createElement('style')
  style.setAttribute('data-mealhelp', '')
  style.textContent = FRAME_STYLE
  head.append(style)

  const title = doc.title.trim() || hostnameOf(pageUrl) || pageUrl

  return {
    html: `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`,
    title,
    recipe: recipe ?? undefined,
    canonicalUrl,
    readsLikeRecipe: recipe ? true : readsLikeRecipe(doc),
  }
}

/**
 * Whether the words on the page look like a recipe even when the markup does
 * not say so — the cue for offering to read the text instead. Deliberately
 * rough: it decides whether to *offer*, and the preview decides the rest.
 */
function readsLikeRecipe(doc: Document): boolean {
  if (!doc.body) return false
  // Text nodes joined with spaces, so "</h2><ul>" does not glue words together
  // the way textContent does.
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const parts: string[] = []
  let length = 0
  while (walker.nextNode() && length < 60_000) {
    const value = walker.currentNode.nodeValue?.trim()
    if (value) {
      parts.push(value)
      length += value.length
    }
  }
  const text = parts.join(' ').toLowerCase()
  return /\bingredients\b/.test(text) && /\b(instructions|directions|method|preparation)\b/.test(text)
}

function resolveUrl(href: string, against: string): string | undefined {
  try {
    const url = new URL(href, against)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
