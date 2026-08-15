import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ImportSettings } from '@/models'
import {
  PageFetchError,
  fetchRecipePage,
  hostnameOf,
  normalizeUrl,
  type FetchRoute,
} from '@/services/recipeImport'
import {
  WebSearchError,
  forgetWalledHost,
  isWalledHost,
  preparePage,
  rememberPage,
  rememberWalledHost,
  webSearch,
  type PreparedPage,
  type WebSearchPage,
} from '@/services/pageBrowser'

/**
 * The built-in browser's memory and behaviour: where you have been, what is
 * loading, and what to show. The screen is only a view of this.
 *
 * History holds both searches and pages, so "back" from a recipe returns to
 * the results it came from — with the results still there, not searched for
 * again. Loaded pages are kept for the last few entries so back and forward
 * are instant; older ones are fetched again when revisited.
 */

export interface BrowserError {
  kind: 'walled' | 'unreachable' | 'search'
  url?: string
  host?: string
  message: string
  suggestion?: string
}

export type SearchEntry = {
  id: number
  kind: 'search'
  query: string
  results?: WebSearchPage
  loadingMore?: boolean
}

export type PageEntry = {
  id: number
  kind: 'page'
  url: string
  title?: string
  page?: PreparedPage
  via?: FetchRoute
}

export type HistoryEntry = SearchEntry | PageEntry

interface State {
  entries: HistoryEntry[]
  /** -1 is the start page. */
  index: number
  /** The entry a load is in flight for, if any. */
  loadingId?: number
  /** An error, and the entry it belongs to. Cleared by any navigation. */
  error?: BrowserError
  errorFor?: number
}

type Action =
  | { type: 'push'; entry: HistoryEntry }
  | { type: 'go'; index: number }
  | { type: 'loading'; id: number }
  | { type: 'page-loaded'; id: number; page: PreparedPage; via: FetchRoute }
  | { type: 'results-loaded'; id: number; results: WebSearchPage; append: boolean }
  | { type: 'loading-more'; id: number; value: boolean }
  | { type: 'failed'; id: number; error: BrowserError }
  | { type: 'idle'; id: number }
  | { type: 'home' }

/** How many loaded pages to hold on to for instant back and forward. */
const KEPT_PAGES = 6

let nextEntryId = 1

function prune(entries: HistoryEntry[], keepAround: number): HistoryEntry[] {
  return entries.map((entry, i) => {
    if (entry.kind !== 'page' || !entry.page) return entry
    if (Math.abs(i - keepAround) < KEPT_PAGES) return entry
    const { page: _dropped, ...rest } = entry
    return rest
  })
}

function updateEntry(
  entries: HistoryEntry[],
  id: number,
  change: (entry: HistoryEntry) => HistoryEntry,
): HistoryEntry[] {
  return entries.map((entry) => (entry.id === id ? change(entry) : entry))
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'push': {
      const entries = [...state.entries.slice(0, state.index + 1), action.entry]
      const index = entries.length - 1
      return {
        entries: prune(entries, index),
        index,
        loadingId: action.entry.id,
        error: undefined,
        errorFor: undefined,
      }
    }
    case 'go':
      return { ...state, index: action.index, error: undefined, errorFor: undefined }
    case 'loading':
      return {
        ...state,
        loadingId: action.id,
        error: state.errorFor === action.id ? undefined : state.error,
        errorFor: state.errorFor === action.id ? undefined : state.errorFor,
      }
    case 'page-loaded': {
      const entries = updateEntry(state.entries, action.id, (entry) =>
        entry.kind === 'page'
          ? { ...entry, page: action.page, title: action.page.title, via: action.via }
          : entry,
      )
      return {
        ...state,
        entries: prune(entries, state.index),
        loadingId: state.loadingId === action.id ? undefined : state.loadingId,
      }
    }
    case 'results-loaded': {
      const entries = updateEntry(state.entries, action.id, (entry) => {
        if (entry.kind !== 'search') return entry
        const merged: WebSearchPage =
          action.append && entry.results
            ? { ...action.results, results: [...entry.results.results, ...action.results.results] }
            : action.results
        return { ...entry, results: merged, loadingMore: false }
      })
      return {
        ...state,
        entries,
        loadingId: state.loadingId === action.id ? undefined : state.loadingId,
      }
    }
    case 'loading-more':
      return {
        ...state,
        entries: updateEntry(state.entries, action.id, (entry) =>
          entry.kind === 'search' ? { ...entry, loadingMore: action.value } : entry,
        ),
      }
    case 'failed':
      return {
        ...state,
        loadingId: state.loadingId === action.id ? undefined : state.loadingId,
        error: action.error,
        errorFor: action.id,
      }
    case 'idle':
      return {
        ...state,
        loadingId: state.loadingId === action.id ? undefined : state.loadingId,
      }
    case 'home':
      return { ...state, index: -1, loadingId: undefined, error: undefined, errorFor: undefined }
  }
}

const INITIAL: State = { entries: [], index: -1 }

/**
 * Where you were is kept for the session, so switching to the grocery list
 * and back does not lose the recipe you were reading.
 */
let session: State = INITIAL

export type BrowserView =
  | { kind: 'start' }
  | { kind: 'results'; entry: SearchEntry }
  | { kind: 'page'; entry: PageEntry; page: PreparedPage }
  | { kind: 'error'; error: BrowserError; entry: HistoryEntry }
  | { kind: 'loading'; entry: HistoryEntry }

const OPEN_IN_BROWSER =
  'Open it in your browser and use the MealHelp button there, or paste the recipe text into Import.'

function walledError(url: string, host: string): BrowserError {
  return {
    kind: 'walled',
    url,
    host,
    message: `${host} only opens in a real browser.`,
    suggestion: OPEN_IN_BROWSER,
  }
}

function unreachableError(url: string, host: string): BrowserError {
  return {
    kind: 'unreachable',
    url,
    host,
    message: `MealHelp couldn't load that page from ${host}.`,
    suggestion:
      'It may be down, or not a web page, or the connection dropped. You can open it in your browser instead.',
  }
}

export function useEmbeddedBrowser(settings: ImportSettings) {
  const [state, dispatch] = useReducer(reducer, session)

  useEffect(() => {
    session = state
  }, [state])

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const stateRef = useRef(state)
  stateRef.current = state

  // Only the newest request may report back; anything older is a stale answer
  // to a question the user has moved on from.
  const token = useRef(0)
  const inFlight = useRef<AbortController>(null)

  useEffect(() => () => inFlight.current?.abort(), [])

  const begin = useCallback(() => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const mine = ++token.current
    return { signal: controller.signal, current: () => mine === token.current }
  }, [])

  const loadPage = useCallback(
    async (id: number, url: string, force = false) => {
      const { signal, current } = begin()
      const host = hostnameOf(url) ?? url
      dispatch({ type: 'loading', id })

      if (!force && isWalledHost(host)) {
        // Known to turn fetchers away: say so at once rather than making the
        // user wait through every route failing in turn.
        dispatch({ type: 'failed', id, error: walledError(url, host) })
        return
      }

      try {
        const fetched = await fetchRecipePage(url, settingsRef.current, {
          signal,
          stopAtBotWall: true,
        })
        if (!current()) return
        const page = preparePage(fetched.html, url)
        if (force) forgetWalledHost(host)
        rememberPage({ url, title: page.title, host })
        dispatch({ type: 'page-loaded', id, page, via: fetched.via })
      } catch (error) {
        if (!current()) return
        if (error instanceof PageFetchError && error.reason === 'cancelled') {
          dispatch({ type: 'idle', id })
          return
        }
        const botBlocked = error instanceof PageFetchError && error.botBlocked
        if (botBlocked) rememberWalledHost(host)
        dispatch({
          type: 'failed',
          id,
          error: botBlocked ? walledError(url, host) : unreachableError(url, host),
        })
      }
    },
    [begin],
  )

  const loadResults = useCallback(
    async (id: number, query: string, offset = 0, engine?: WebSearchPage['engine']) => {
      const { signal, current } = begin()
      if (offset > 0) dispatch({ type: 'loading-more', id, value: true })
      else dispatch({ type: 'loading', id })

      try {
        const results = await webSearch(query, settingsRef.current, { signal, offset, engine })
        if (!current()) return
        dispatch({ type: 'results-loaded', id, results, append: offset > 0 })
      } catch (error) {
        if (!current()) return
        dispatch({ type: 'loading-more', id, value: false })
        if (error instanceof PageFetchError && error.reason === 'cancelled') {
          dispatch({ type: 'idle', id })
          return
        }
        dispatch({
          type: 'failed',
          id,
          error: {
            kind: 'search',
            message:
              error instanceof WebSearchError ? error.message : "MealHelp couldn't search just now.",
            suggestion:
              error instanceof WebSearchError
                ? error.suggestion
                : 'Try again in a moment, or open one of the sites below.',
          },
        })
      }
    },
    [begin],
  )

  const open = useCallback(
    (rawUrl: string, options: { force?: boolean } = {}) => {
      let url: string
      try {
        url = normalizeUrl(rawUrl)
      } catch {
        return
      }
      const entry: PageEntry = { id: nextEntryId++, kind: 'page', url }
      dispatch({ type: 'push', entry })
      void loadPage(entry.id, url, options.force)
    },
    [loadPage],
  )

  const search = useCallback(
    (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) return
      const entry: SearchEntry = { id: nextEntryId++, kind: 'search', query: trimmed }
      dispatch({ type: 'push', entry })
      void loadResults(entry.id, trimmed)
    },
    [loadResults],
  )

  const revisit = useCallback(
    (index: number) => {
      const entry = stateRef.current.entries[index]
      if (!entry) return
      inFlight.current?.abort()
      token.current++
      dispatch({ type: 'go', index })
      if (entry.kind === 'page' && !entry.page) void loadPage(entry.id, entry.url)
      if (entry.kind === 'search' && !entry.results) void loadResults(entry.id, entry.query)
    },
    [loadPage, loadResults],
  )

  const home = useCallback(() => {
    inFlight.current?.abort()
    token.current++
    dispatch({ type: 'home' })
  }, [])

  const back = useCallback(() => {
    const { index } = stateRef.current
    if (index < 0) return
    if (index === 0) home()
    else revisit(index - 1)
  }, [revisit, home])

  const forward = useCallback(() => {
    const { index, entries } = stateRef.current
    if (index >= entries.length - 1) return
    revisit(index + 1)
  }, [revisit])

  const reload = useCallback(
    (options: { force?: boolean } = {}) => {
      const { index, entries } = stateRef.current
      const entry = entries[index]
      if (!entry) return
      if (entry.kind === 'page') void loadPage(entry.id, entry.url, options.force)
      else void loadResults(entry.id, entry.query)
    },
    [loadPage, loadResults],
  )

  const more = useCallback(() => {
    const { index, entries } = stateRef.current
    const entry = entries[index]
    if (!entry || entry.kind !== 'search' || entry.loadingMore) return
    const offset = entry.results?.nextOffset
    if (offset == null) return
    void loadResults(entry.id, entry.query, offset, entry.results?.engine)
  }, [loadResults])

  const stop = useCallback(() => {
    inFlight.current?.abort()
    token.current++
    const entry = stateRef.current.entries[stateRef.current.index]
    if (entry) dispatch({ type: 'idle', id: entry.id })
  }, [])

  const current: HistoryEntry | undefined = state.index >= 0 ? state.entries[state.index] : undefined
  const loading = current != null && state.loadingId === current.id

  const view: BrowserView = useMemo(() => {
    if (!current) return { kind: 'start' }
    if (state.error && state.errorFor === current.id) {
      return { kind: 'error', error: state.error, entry: current }
    }
    if (current.kind === 'page') {
      return current.page
        ? { kind: 'page', entry: current, page: current.page }
        : { kind: 'loading', entry: current }
    }
    return current.results
      ? { kind: 'results', entry: current }
      : { kind: 'loading', entry: current }
  }, [current, state.error, state.errorFor])

  return {
    view,
    loading,
    current,
    canBack: state.index >= 0,
    canForward: state.index < state.entries.length - 1,
    open,
    search,
    back,
    forward,
    reload,
    stop,
    home,
    more,
  }
}
