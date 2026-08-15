import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetWalledHost,
  isWalledHost,
  recentPages,
  rememberPage,
  rememberWalledHost,
} from './browserMemory'
import { isKnownWalledHost } from './knownSites'

/** The test environment's localStorage is not a real Storage; this one is. */
function memoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('walled hosts', () => {
  it('knows the publishers that turn every fetcher away, including their subdomains', () => {
    expect(isKnownWalledHost('www.allrecipes.com')).toBe(true)
    expect(isKnownWalledHost('cooking.nytimes.com')).toBe(true)
    expect(isKnownWalledHost('www.budgetbytes.com')).toBe(false)
    // A lookalike is not a match.
    expect(isKnownWalledHost('notallrecipes.com')).toBe(false)
  })

  it('learns a host that walls it at runtime, and forgets after a fortnight', () => {
    const now = Date.parse('2026-08-15T12:00:00Z')
    expect(isWalledHost('blog.example', now)).toBe(false)

    rememberWalledHost('www.blog.example', now)
    expect(isWalledHost('blog.example', now)).toBe(true)
    expect(isWalledHost('blog.example', now + 13 * 24 * 3600 * 1000)).toBe(true)
    expect(isWalledHost('blog.example', now + 15 * 24 * 3600 * 1000)).toBe(false)
  })

  it('can be told it was wrong', () => {
    const now = Date.now()
    rememberWalledHost('blog.example', now)
    forgetWalledHost('blog.example', now)
    expect(isWalledHost('blog.example', now)).toBe(false)
  })
})

describe('recent pages', () => {
  it('keeps the newest first, one entry per address, and not too many', () => {
    for (let i = 0; i < 15; i++) {
      rememberPage(
        { url: `https://site.example/${i}`, title: `Page ${i}`, host: 'site.example' },
        new Date(2026, 7, 15, 12, i),
      )
    }
    rememberPage(
      { url: 'https://site.example/3#comments', title: 'Page 3 again', host: 'site.example' },
      new Date(2026, 7, 15, 13),
    )

    const recent = recentPages()
    expect(recent).toHaveLength(12)
    expect(recent[0].title).toBe('Page 3 again')
    // Revisiting page 3 replaced its older entry rather than adding a second.
    expect(recent.filter((page) => page.url.includes('/3')).length).toBe(1)
  })
})
