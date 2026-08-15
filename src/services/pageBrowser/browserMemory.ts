import { isKnownWalledHost, normaliseHost } from './knownSites'

/**
 * What the built-in browser remembers between visits.
 *
 * Two small things, both in localStorage because neither is worth losing sleep
 * over: recipes, plans and lists live in IndexedDB and are backed up; this is
 * not. If it vanishes, the browser forgets which sites walled it and which
 * pages you were on, and nothing else changes.
 */

const WALLED_KEY = 'mealhelp.browser.walledHosts'
const RECENT_KEY = 'mealhelp.browser.recent'

/** Long enough that a site is not retried on every visit; short enough that a change of heart is noticed. */
const WALLED_MEMORY_MS = 14 * 24 * 60 * 60 * 1000
const MAX_RECENT = 12

export interface RecentPage {
  url: string
  title: string
  host: string
  /** ISO timestamp of the last visit. */
  at: string
}

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing on some phones refuses writes; forgetting is fine.
  }
}

/* ---------- Walled hosts ---------- */

type WalledMap = Record<string, number>

function liveWalled(now: number): WalledMap {
  const stored = readJson<WalledMap>(WALLED_KEY, {})
  const live: WalledMap = {}
  for (const [host, expires] of Object.entries(stored)) {
    if (typeof expires === 'number' && expires > now) live[host] = expires
  }
  return live
}

/** Known from the start, or learned since. */
export function isWalledHost(host: string, now = Date.now()): boolean {
  const normalised = normaliseHost(host)
  if (isKnownWalledHost(normalised)) return true
  return normalised in liveWalled(now)
}

export function rememberWalledHost(host: string, now = Date.now()): void {
  const normalised = normaliseHost(host)
  if (!normalised) return
  const live = liveWalled(now)
  live[normalised] = now + WALLED_MEMORY_MS
  writeJson(WALLED_KEY, live)
}

/** For when a site on the list is tried anyway and turns out to be open. */
export function forgetWalledHost(host: string, now = Date.now()): void {
  const live = liveWalled(now)
  delete live[normaliseHost(host)]
  writeJson(WALLED_KEY, live)
}

/* ---------- Recent pages ---------- */

export function recentPages(): RecentPage[] {
  const stored = readJson<RecentPage[]>(RECENT_KEY, [])
  return Array.isArray(stored)
    ? stored.filter((page) => page && typeof page.url === 'string' && typeof page.title === 'string')
    : []
}

export function rememberPage(page: Omit<RecentPage, 'at'>, now = new Date()): RecentPage[] {
  const key = page.url.replace(/#.*$/, '')
  const rest = recentPages().filter((entry) => entry.url.replace(/#.*$/, '') !== key)
  const next = [{ ...page, at: now.toISOString() }, ...rest].slice(0, MAX_RECENT)
  writeJson(RECENT_KEY, next)
  return next
}

export function forgetRecentPages(): void {
  writeJson(RECENT_KEY, [])
}
