import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Home,
  Loader2,
  Plus,
  RotateCw,
  ShieldAlert,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { saveRecipe } from '@/db/recipes'
import type { Recipe, RecipeDraft } from '@/models'
import {
  looksLikeAddress,
  parseRecipeText,
  type RecipeImportResult,
} from '@/services/recipeImport'
import {
  forgetRecentPages,
  recentPages,
  surpriseIdeaItems,
  type RecentPage,
} from '@/services/pageBrowser'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { ImportPreview } from '@/features/import/ImportPreview'
import { SegmentedTabs } from '@/components/common/SegmentedTabs'
import { useSectionTab } from '@/app/useSectionTab'
import { pickSurprise, rememberPick } from '@/utils/surprise'
import { DatabasesView } from '@/features/discover/DiscoverPage'
import { AddressBar } from './AddressBar'
import { PageFrame } from './PageFrame'
import { SearchResults } from './SearchResults'
import { StartPage } from './StartPage'
import { useEmbeddedBrowser, type BrowserError, type HistoryEntry } from './useEmbeddedBrowser'
import styles from './BrowserPage.module.css'

/**
 * A browser inside MealHelp, for finding recipes and adding them without
 * leaving. Search or type an address, read the page, and when the page has a
 * recipe on it an Add button appears — the same preview-then-save as Import.
 *
 * It is a browser with scripts off, reading pages through the same fetchers
 * Import uses, so what it can and cannot open is exactly what Import can and
 * cannot import. Sites that refuse fetchers are handed to the real browser
 * with the MealHelp button as the way back.
 */
export function BrowserPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()

  const browser = useEmbeddedBrowser(settings.importSettings)
  const { view, loading, current } = browser

  const frameRef = useRef<HTMLIFrameElement>(null)
  const [tab, setTab] = useSectionTab<'web' | 'databases'>(['web', 'databases'], 'web')
  const [recent, setRecent] = useState<RecentPage[]>(() => recentPages())
  const [preview, setPreview] = useState<RecipeImportResult>()
  const [menuOpen, setMenuOpen] = useState(false)

  // Arriving with ?q= or ?url= — from Import, Discover, or a typed link —
  // starts there, then the address is tidied so a reload does not repeat it.
  useEffect(() => {
    const q = params.get('q')
    const url = params.get('url')
    if (!q && !url) return
    setParams({}, { replace: true })
    if (url) browser.open(url)
    else if (q) browser.search(q)
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view.kind === 'start') setRecent(recentPages())
  }, [view.kind])

  // Recipes already saved from the web, keyed by where they came from, so the
  // Add button can say "you have this" instead of offering a duplicate.
  const library = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const savedByUrl = useMemo(() => {
    const map = new Map<string, Recipe>()
    for (const recipe of library) {
      if (recipe.sourceUrl) map.set(stripHash(recipe.sourceUrl), recipe)
    }
    return map
  }, [library])
  const savedUrls = useMemo(() => new Set(savedByUrl.keys()), [savedByUrl])

  const pageUrl = view.kind === 'page' ? view.entry.url : undefined
  const savedRecipe = useMemo(() => {
    if (!pageUrl) return undefined
    return (
      savedByUrl.get(stripHash(pageUrl)) ??
      (view.kind === 'page' && view.page.canonicalUrl
        ? savedByUrl.get(stripHash(view.page.canonicalUrl))
        : undefined)
    )
  }, [pageUrl, savedByUrl, view])

  const display =
    current?.kind === 'page' ? prettyUrl(current.url) : current?.kind === 'search' ? current.query : ''

  const go = useCallback(
    (text: string) => {
      setTab('web')
      if (looksLikeAddress(text)) browser.open(text)
      else browser.search(text)
    },
    [browser, setTab],
  )

  const openExternal = useCallback(
    (url: string, why: 'walled' | 'choice' = 'choice') => {
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        toast('Your browser blocked the new tab — copy the link instead.', { tone: 'error' })
        return
      }
      if (why === 'walled') {
        toast('Opened in your browser. Use the MealHelp button there to add it.', {
          action: { label: 'Set up', run: () => navigate('/import') },
        })
      }
    },
    [toast, navigate],
  )

  const copyLink = async () => {
    const url = current?.kind === 'page' ? current.url : undefined
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied.', { tone: 'success' })
    } catch {
      toast('Your browser blocked the clipboard.', { tone: 'error' })
    }
    setMenuOpen(false)
  }

  const addFromPage = () => {
    if (view.kind !== 'page' || !view.page.recipe) return
    setPreview({
      recipe: view.page.recipe.draft,
      warnings: view.page.recipe.warnings,
      adapterId: 'browser',
    })
  }

  /**
   * For pages with a recipe in the words but not in the markup — older blogs,
   * mostly. Reads the rendered page's text, the same way the MealHelp button
   * does when a page has no structured data.
   */
  const readPageText = () => {
    if (view.kind !== 'page') return
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    const scope =
      doc.querySelector('[itemprop="recipeIngredient"]')
        ? doc.body
        : (doc.querySelector('article, main, [class*="recipe" i]') ?? doc.body)
    const text = `${doc.title}\n${(scope as HTMLElement | null)?.innerText ?? ''}`.slice(0, 20000)
    const parsed = parseRecipeText(text, view.entry.url)
    setPreview({
      recipe: parsed.draft,
      warnings: [
        'This page had no structured recipe data, so MealHelp read its visible text. Check the ingredients and steps.',
        ...parsed.warnings,
      ],
      adapterId: 'browser-text',
    })
  }

  const save = async (draft: RecipeDraft) => {
    const saved = await saveRecipe(draft)
    setPreview(undefined)
    toast(`Saved ${saved.title}.`, {
      tone: 'success',
      action: { label: 'View', run: () => navigate(`/recipes/${saved.id}`) },
    })
  }

  /**
   * The web's version of "surprise me".
   *
   * There is no list of every recipe on the internet to draw from, so instead
   * of picking a random recipe this asks a question you would not have thought
   * to ask — a real dinner, from a spread of cuisines and methods — and shows
   * what comes back. The picker remembers what it just offered, so rolling
   * twice does not land on the same dish.
   */
  const rolled = useRef<string[]>([])
  const surprise = useCallback(() => {
    const idea = pickSurprise(surpriseIdeaItems(), rolled.current)
    if (!idea) return
    rolled.current = rememberPick(rolled.current, idea.id)
    setTab('web')
    browser.search(idea.id)
  }, [browser, setTab])

  return (
    <div className={styles.screen}>
      <AddressBar
        display={display}
        loading={loading}
        canBack={browser.canBack}
        onSubmit={go}
        onBack={browser.back}
        onReload={() => browser.reload()}
        onStop={browser.stop}
        onSurprise={surprise}
        onMore={() => setMenuOpen(true)}
      />
      <div className={styles.progress} aria-hidden="true">
        {loading ? <div className={styles.progressBar} /> : null}
      </div>

      <div className={styles.tabRow}>
        <SegmentedTabs
          tabs={[
            { id: 'web', label: 'Web' },
            { id: 'databases', label: 'Recipe databases' },
          ]}
          value={tab}
          onChange={setTab}
          label="Where to look"
        />
      </div>

      <div className={styles.stage}>
        {tab === 'databases' ? (
          <div className={styles.scroller}>
            <DatabasesView />
          </div>
        ) : null}

        {tab === 'web' && view.kind === 'start' ? (
          <div className={styles.scroller}>
            <StartPage
              recent={recent}
              onOpen={browser.open}
              onSearch={browser.search}
              onSurprise={surprise}
              onClearRecent={() => {
                forgetRecentPages()
                setRecent([])
              }}
            />
          </div>
        ) : null}

        {tab === 'web' && view.kind === 'results' && view.entry.results ? (
          <div className={styles.scroller}>
            <SearchResults
              query={view.entry.query}
              page={view.entry.results}
              loadingMore={Boolean(view.entry.loadingMore)}
              savedUrls={savedUrls}
              onOpen={browser.open}
              onOpenExternal={(url) => openExternal(url, 'walled')}
              onMore={browser.more}
            />
          </div>
        ) : null}

        {tab === 'web' && view.kind === 'loading' ? (
          <LoadingPanel entry={view.entry} stopped={!loading} onReload={() => browser.reload()} />
        ) : null}

        {tab === 'web' && view.kind === 'error' ? (
          <ErrorPanel
            error={view.error}
            entry={view.entry}
            onOpenExternal={(url) => openExternal(url, view.error.kind === 'walled' ? 'walled' : 'choice')}
            onRetry={() => browser.reload({ force: view.error.kind === 'walled' })}
            onSearch={browser.search}
          />
        ) : null}

        {tab === 'web' && view.kind === 'page' ? (
          <>
            <PageFrame
              frameRef={frameRef}
              html={view.page.html}
              pageUrl={view.entry.url}
              title={view.page.title}
              onNavigate={browser.open}
            />
            <div className={styles.dock}>
              {savedRecipe ? (
                <Link to={`/recipes/${savedRecipe.id}`} className={`${styles.pill} ${styles.pillSaved}`}>
                  <Check size={17} aria-hidden="true" />
                  <span className={styles.pillText}>In your recipes · View</span>
                </Link>
              ) : view.page.recipe ? (
                <button type="button" className={`${styles.pill} ${styles.pillAdd}`} onClick={addFromPage}>
                  <Plus size={18} aria-hidden="true" />
                  <span className={styles.pillText}>Add “{view.page.recipe.draft.title}”</span>
                </button>
              ) : view.page.readsLikeRecipe ? (
                <button type="button" className={`${styles.pill} ${styles.pillGhost}`} onClick={readPageText}>
                  <FileText size={16} aria-hidden="true" />
                  <span className={styles.pillText}>No recipe data here · read the text instead</span>
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {preview ? (
          <div className={styles.overlay}>
            <ImportPreview
              result={preview}
              backLabel="Back to page"
              onBack={() => setPreview(undefined)}
              onSave={(draft) => void save(draft)}
              onEdit={(draft) => navigate('/recipes/new', { state: { draft } })}
            />
          </div>
        ) : null}
      </div>

      <Modal open={menuOpen} title="This page" onClose={() => setMenuOpen(false)}>
        <div className={styles.menu}>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              browser.forward()
              setMenuOpen(false)
            }}
            disabled={!browser.canForward}
          >
            <ArrowRight size={17} aria-hidden="true" />
            Forward
          </button>
          {current?.kind === 'page' ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  openExternal(current.url)
                  setMenuOpen(false)
                }}
              >
                <ExternalLink size={17} aria-hidden="true" />
                Open in your browser
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => void copyLink()}>
                <Copy size={17} aria-hidden="true" />
                Copy link
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              browser.home()
              setMenuOpen(false)
            }}
          >
            <Home size={17} aria-hidden="true" />
            Start page
          </button>
        </div>
      </Modal>
    </div>
  )
}

function LoadingPanel({
  entry,
  stopped,
  onReload,
}: {
  entry: HistoryEntry
  stopped: boolean
  onReload: () => void
}) {
  const label = entry.kind === 'page' ? prettyHost(entry.url) : `results for “${entry.query}”`
  return (
    <div className={styles.panel}>
      {stopped ? (
        <>
          <p className={styles.panelTitle}>Stopped</p>
          <button type="button" className="btn btn-secondary" onClick={onReload}>
            <RotateCw size={16} aria-hidden="true" />
            Load {label}
          </button>
        </>
      ) : (
        <>
          <Loader2 size={22} aria-hidden="true" className={styles.spinner} />
          <p className={styles.panelText}>Loading {label}…</p>
        </>
      )}
    </div>
  )
}

function ErrorPanel({
  error,
  entry,
  onOpenExternal,
  onRetry,
  onSearch,
}: {
  error: BrowserError
  entry: HistoryEntry
  onOpenExternal: (url: string) => void
  onRetry: () => void
  onSearch: (query: string) => void
}) {
  const url = error.url ?? (entry.kind === 'page' ? entry.url : undefined)
  return (
    <div className={styles.panel}>
      <ShieldAlert size={26} aria-hidden="true" className={styles.panelIcon} />
      <p className={styles.panelTitle}>{error.message}</p>
      {error.suggestion ? <p className={styles.panelText}>{error.suggestion}</p> : null}

      <div className={styles.panelActions}>
        {url ? (
          <button type="button" className="btn btn-primary" onClick={() => onOpenExternal(url)}>
            <ExternalLink size={17} aria-hidden="true" />
            Open in your browser
          </button>
        ) : null}
        {error.kind === 'search' && entry.kind === 'search' ? (
          <button type="button" className="btn btn-primary" onClick={() => onSearch(entry.query)}>
            <RotateCw size={16} aria-hidden="true" />
            Try again
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <RotateCw size={16} aria-hidden="true" />
            {error.kind === 'walled' ? 'Try loading it here anyway' : 'Try again'}
          </button>
        )}
        <Link to="/import" className="btn btn-ghost">
          Paste the recipe instead
        </Link>
      </div>

      {error.kind === 'walled' ? (
        <p className={styles.panelFoot}>
          Set up the <Link to="/import">MealHelp button</Link> once, and any page open in
          your browser is two taps from your recipes.
        </p>
      ) : null}
    </div>
  )
}

function stripHash(url: string): string {
  return url.replace(/#.*$/, '')
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

function prettyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
