import { useMemo } from 'react'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { isWalledHost, type WebSearchPage, type WebSearchResult } from '@/services/pageBrowser'
import styles from './SearchResults.module.css'

interface SearchResultsProps {
  query: string
  page: WebSearchPage
  loadingMore: boolean
  /** Source URLs already in the library, so a result you own says so. */
  savedUrls: Set<string>
  onOpen: (url: string) => void
  onOpenExternal: (url: string) => void
  onMore: () => void
}

/**
 * MealHelp draws the results itself, so it can be honest about each one:
 * results from sites that open here come first, and the ones that only answer
 * a real browser are grouped after, marked, and open outside with one tap.
 */
export function SearchResults({
  query,
  page,
  loadingMore,
  savedUrls,
  onOpen,
  onOpenExternal,
  onMore,
}: SearchResultsProps) {
  const { openable, walled } = useMemo(() => {
    const openable: WebSearchResult[] = []
    const walled: WebSearchResult[] = []
    for (const result of page.results) {
      ;(isWalledHost(result.host) ? walled : openable).push(result)
    }
    return { openable, walled }
  }, [page.results])

  const renderResult = (result: WebSearchResult, external: boolean) => (
    <li key={result.url}>
      <button
        type="button"
        className={styles.result}
        onClick={() => (external ? onOpenExternal(result.url) : onOpen(result.url))}
      >
        <span className={styles.resultHost}>
          {result.host}
          {external ? (
            <span className={styles.externalBadge}>
              <ExternalLink size={11} aria-hidden="true" />
              opens in your browser
            </span>
          ) : null}
          {savedUrls.has(stripHash(result.url)) ? (
            <span className={styles.savedBadge}>
              <Check size={11} aria-hidden="true" />
              in your recipes
            </span>
          ) : null}
        </span>
        <span className={styles.resultTitle}>{result.title}</span>
        {result.snippet ? <span className={styles.resultSnippet}>{result.snippet}</span> : null}
      </button>
    </li>
  )

  return (
    <div className={styles.results}>
      <p className={styles.summary}>
        Results for <strong>{query}</strong>
        {page.query !== query ? <span className={styles.searchedAs}> · searched as “{page.query}”</span> : null}
      </p>

      {page.results.length === 0 ? (
        <p className={styles.empty}>Nothing came back. Try different words.</p>
      ) : null}

      <ul className={styles.list}>{openable.map((result) => renderResult(result, false))}</ul>

      {walled.length ? (
        <>
          <p className={styles.groupLabel}>
            These sites only answer a real browser — they open in yours, where the
            MealHelp button still works.
          </p>
          <ul className={styles.list}>{walled.map((result) => renderResult(result, true))}</ul>
        </>
      ) : null}

      {page.nextOffset != null ? (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={onMore}
          disabled={loadingMore}
        >
          {loadingMore ? <Loader2 size={17} aria-hidden="true" /> : null}
          {loadingMore ? 'Loading…' : 'More results'}
        </button>
      ) : null}

      <p className={styles.attribution}>Web results from {page.engineLabel}.</p>
    </div>
  )
}

function stripHash(url: string): string {
  return url.replace(/#.*$/, '')
}
