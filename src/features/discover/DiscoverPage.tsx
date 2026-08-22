import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Dices, Loader2, Plus, Search, Sparkles, UtensilsCrossed, X } from 'lucide-react'
import { SearchField } from '@/components/common/SearchField'
import { db } from '@/db/database'
import { saveRecipe } from '@/db/recipes'
import type { Recipe, RecipeDraft } from '@/models'
import {
  DiscoveryError,
  MAX_INGREDIENTS_PER_SEARCH,
  activeProviders,
  browseByCategory,
  browseByCuisine,
  discoverByIngredients,
  listCategories,
  listCuisines,
  markAlreadySaved,
  providerById,
  searchAllProviders,
  spoonacularByIngredients,
  suggestedSearchIngredients,
  theMealDbProvider,
  withSourceLabels,
  type RankedDiscovery,
} from '@/services/recipeDiscovery'
import { useSettings } from '@/app/SettingsContext'
import { EmptyState } from '@/components/common/EmptyState'
import { useToast } from '@/components/common/Toast'
import { ImportPreview } from '@/features/import/ImportPreview'
import styles from './DiscoverPage.module.css'

type Mode = 'pantry' | 'search' | 'browse' | 'surprise'

export function DatabasesView() {
  const { toast } = useToast()
  const { settings } = useSettings()

  const pantry = useLiveQuery(() => db.pantryItems.toArray(), [], [])
  const library = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])

  // Every source that needs nothing from the user, plus their own key if they
  // added one. Searching is done across all of them at once.
  const spoonacularKey = settings.spoonacularKey?.trim()
  const providerOptions = useMemo(() => ({ spoonacularKey }), [spoonacularKey])
  const providers = useMemo(() => activeProviders(providerOptions), [providerOptions])

  const [mode, setMode] = useState<Mode>('search')
  const [selected, setSelected] = useState<string[]>([])
  const [extra, setExtra] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RankedDiscovery[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{ message: string; suggestion?: string }>()
  const [preview, setPreview] = useState<RecipeDraft>()
  const [opening, setOpening] = useState<string>()

  const inFlight = useRef<AbortController>(null)

  // The browse lists are fixed; fetched once when that tab is first opened.
  const [catalogue, setCatalogue] = useState<{
    categories: string[]
    cuisines: string[]
  }>()

  useEffect(() => {
    if (mode !== 'browse' || catalogue) return
    let cancelled = false
    void listCategories()
      .then((categories) => {
        if (!cancelled) setCatalogue({ categories, cuisines: listCuisines() })
      })
      .catch(() => {
        if (!cancelled) setCatalogue({ categories: [], cuisines: listCuisines() })
      })
    return () => {
      cancelled = true
    }
  }, [mode, catalogue])

  // Whatever the user has told MealHelp they keep around, minus the staples
  // that would match half the database on their own.
  const pantrySuggestions = useMemo(
    () => suggestedSearchIngredients((pantry ?? []).map((item) => item.name)),
    [pantry],
  )

  useEffect(() => {
    return () => inFlight.current?.abort()
  }, [])

  const run = async (fn: (signal: AbortSignal) => Promise<RankedDiscovery[]>) => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller

    setBusy(true)
    setFailure(undefined)
    try {
      const found = await fn(controller.signal)
      setResults(
        withSourceLabels(markAlreadySaved(found, library ?? []), providerOptions),
      )
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof DiscoveryError) {
        setFailure({ message: error.message, suggestion: error.suggestion })
      } else {
        setFailure({
          message: "MealHelp couldn't search for recipes just now.",
          suggestion: 'You can still paste a recipe in from any website.',
        })
      }
      setResults(null)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const searchPantry = () =>
    run(async (signal) => {
      // Spoonacular can rank several ingredients in one request; the free
      // provider needs one request per ingredient and the overlap counted here.
      if (spoonacularKey) {
        return spoonacularByIngredients(spoonacularKey, selected, signal)
      }
      // Deliberately unfiltered: a recipe using one of your three ingredients
      // is still worth seeing, it just sorts below one that uses all three.
      // Requiring full coverage is how "what can I make" returns nothing.
      return discoverByIngredients(theMealDbProvider, selected, {
        signal,
        library: library ?? [],
      })
    })

  const searchText = () =>
    run(async (signal) => {
      const { results: found, failures } = await searchAllProviders(providers, (p) =>
        p.searchByText(query, signal),
      )
      // Only a total washout is worth an error; one source being down is not.
      if (!found.length && failures.length === providers.length) throw failures[0]
      return found.map((result) => ({ result, matched: [] }))
    })

  const browse = (kind: 'category' | 'cuisine', value: string) =>
    run(async (signal) => {
      const found =
        kind === 'category'
          ? await browseByCategory(value, signal)
          : await browseByCuisine(value, signal)
      return found.map((result) => ({ result, matched: [] }))
    })

  const surprise = () =>
    run(async (signal) => {
      const { results: found, failures } = await searchAllProviders(providers, (p) =>
        p.random(signal),
      )
      if (!found.length && failures.length === providers.length) throw failures[0]
      return found.slice(0, 8).map((result) => ({ result, matched: [] }))
    })

  const open = async (entry: RankedDiscovery) => {
    setOpening(entry.result.externalId)
    try {
      // Results come from several sources, so the one that produced this hit is
      // the one asked for the full recipe.
      const source =
        providerById(entry.result.providerId, providerOptions) ?? theMealDbProvider
      const draft = await source.fetchRecipe(entry.result.externalId)
      setPreview(draft)
    } catch (error) {
      toast(
        error instanceof DiscoveryError
          ? error.message
          : 'That recipe could not be opened.',
        { tone: 'error' },
      )
    } finally {
      setOpening(undefined)
    }
  }

  const save = async (draft: RecipeDraft) => {
    const saved = await saveRecipe(draft)
    setPreview(undefined)
    toast(`Saved ${saved.title} to your recipes.`, { tone: 'success' })
  }

  const toggleIngredient = (name: string) => {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : current.length >= MAX_INGREDIENTS_PER_SEARCH
          ? current
          : [...current, name],
    )
  }

  // Previewing reuses the import screen, so a discovered recipe is checked over
  // in exactly the same place as a pasted one before it is saved.
  if (preview) {
    return (
      <ImportPreview
        result={{ recipe: preview, warnings: [], adapterId: 'discover' }}
        onBack={() => setPreview(undefined)}
        onSave={(draft) => void save(draft)}
        onEdit={(draft) => void save(draft)}
      />
    )
  }

  return (
    <div className={styles.view}>
      {/* One row: what to look for, and how. The how is a select rather than
          a row of tabs, because four tabs do not fit a phone and a select
          always does. */}
      <div className={styles.searchRow}>
        <select
          className={`select ${styles.scope}`}
          value={mode}
          onChange={(event) => setMode(event.target.value as Mode)}
          aria-label="How to search"
        >
          <option value="search">By name</option>
          <option value="pantry">From my pantry</option>
          <option value="browse">Browse</option>
          <option value="surprise">Surprise me</option>
        </select>
        {mode === 'search' ? (
          <SearchField
            value={query}
            onChange={setQuery}
            onSubmit={(value) => {
              if (value) void searchText()
            }}
            placeholder="curry, pasta bake, tacos…"
            label="Search for recipes"
            trailing={
              <button
                type="button"
                className={styles.goButton}
                onClick={() => void searchText()}
                disabled={busy || !query.trim()}
                aria-label="Search"
              >
                {busy ? <Loader2 size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
              </button>
            }
          />
        ) : null}
        {mode === 'pantry' ? (
          <SearchField
            value={extra}
            onChange={setExtra}
            onSubmit={(value) => {
              if (value && !selected.includes(value)) toggleIngredient(value)
              setExtra('')
            }}
            placeholder="Add an ingredient: chicken, spinach…"
            label="Add an ingredient to search with"
            trailing={
              <button
                type="button"
                className={styles.goButton}
                onClick={() => {
                  const value = extra.trim()
                  if (value && !selected.includes(value)) toggleIngredient(value)
                  setExtra('')
                }}
                disabled={!extra.trim()}
                aria-label="Add ingredient"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            }
          />
        ) : null}
        {mode === 'surprise' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void surprise()}
            disabled={busy}
          >
            {busy ? <Loader2 size={17} aria-hidden="true" /> : <Dices size={17} aria-hidden="true" />}
            {busy ? 'Looking…' : 'Surprise me'}
          </button>
        ) : null}
      </div>
      <p className={styles.sourceLine}>
        {spoonacularKey
          ? 'Searching Spoonacular, TheMealDB and the Wikibooks Cookbook.'
          : 'TheMealDB and the Wikibooks Cookbook — free, no account.'}{' '}
        {!spoonacularKey ? <Link to="/settings">Add a Spoonacular key</Link> : null}
      </p>

      {mode === 'pantry' ? (
        <section className={styles.panel}>
          <p className="field-label">What do you have?</p>
          {pantrySuggestions.length ? (
            <div className="row-tight">
              {pantrySuggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip chip-button"
                  aria-pressed={selected.includes(name)}
                  onClick={() => toggleIngredient(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm muted">
              Nothing in your pantry yet — type what you have below, or{' '}
              <Link to="/grocery?tab=pantry">set up your pantry</Link> so it is remembered.
            </p>
          )}

          {selected.length ? (
            <div className={styles.selectedRow}>
              {selected.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="chip chip-accent"
                  onClick={() => toggleIngredient(name)}
                  aria-label={`Remove ${name}`}
                >
                  {name}
                  <X size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void searchPantry()}
            disabled={busy || selected.length === 0}
          >
            {busy ? (
              <Loader2 size={17} aria-hidden="true" />
            ) : (
              <Sparkles size={17} aria-hidden="true" />
            )}
            {busy ? 'Looking…' : 'Find recipes I can make'}
          </button>
          <p className="field-hint">
            Recipes that use more of what you have come first. Up to{' '}
            {MAX_INGREDIENTS_PER_SEARCH} ingredients.
          </p>
        </section>
      ) : null}

      {mode === 'search' ? (
        <section className={styles.panel}>
          <form
            className={styles.addRow}
            onSubmit={(event) => {
              event.preventDefault()
              if (query.trim()) void searchText()
            }}
          >
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="curry, pasta bake, tacos…"
              aria-label="Search for recipes"
            />
            <button
              type="submit"
              className="btn btn-primary btn-icon"
              aria-label="Search"
              disabled={busy || !query.trim()}
            >
              <Search size={19} aria-hidden="true" />
            </button>
          </form>
          <p className="field-hint">
            These sources are curated and free. For the whole web — blogs, magazines,
            everything —{' '}
            <Link to={query.trim() ? `/browser?q=${encodeURIComponent(query.trim())}` : '/browser'}>
              search in the Browser
            </Link>{' '}
            and add recipes from the pages themselves.
          </p>
        </section>
      ) : null}

      {mode === 'browse' ? (
        <section className={styles.panel}>
          <p className="field-label">By kind of dish</p>
          <div className="row-tight">
            {(catalogue?.categories ?? []).map((category) => (
              <button
                key={category}
                type="button"
                className="chip chip-button"
                onClick={() => void browse('category', category)}
              >
                {category}
              </button>
            ))}
          </div>

          <p className="field-label" style={{ marginTop: 'var(--space-4)' }}>
            By cuisine
          </p>
          <div className={styles.cuisineRow}>
            {(catalogue?.cuisines ?? []).map((cuisine) => (
              <button
                key={cuisine}
                type="button"
                className="chip chip-button"
                onClick={() => void browse('cuisine', cuisine)}
              >
                {cuisine}
              </button>
            ))}
          </div>
          {!catalogue ? <p className="text-sm muted">Loading the list…</p> : null}
        </section>
      ) : null}

      {failure ? (
        <div className={styles.failure} role="status">
          <p className={styles.failureMessage}>{failure.message}</p>
          {failure.suggestion ? <p className="text-sm">{failure.suggestion}</p> : null}
          <div className="row-tight" style={{ marginTop: 'var(--space-3)' }}>
            <Link to="/import" className="btn btn-secondary btn-sm">
              Paste a recipe instead
            </Link>
            <Link to="/recipes/new" className="btn btn-ghost btn-sm">
              Add one by hand
            </Link>
          </div>
        </div>
      ) : null}

      {results && !busy ? (
        results.length === 0 ? (
          <EmptyState
            title="Nothing came back"
            description={
              mode === 'pantry'
                ? 'Try fewer ingredients, or a different combination.'
                : 'Try another word.'
            }
          />
        ) : (
          <>
            <p className={styles.count}>
              {results.length} recipe{results.length === 1 ? '' : 's'}
            </p>
            <ul className={styles.results}>
              {results.map((entry) => (
                <li key={entry.result.externalId}>
                  <button
                    type="button"
                    className={styles.card}
                    onClick={() => void open(entry)}
                    disabled={opening === entry.result.externalId}
                  >
                    <span className={styles.media}>
                      {entry.result.image ? (
                        <img src={entry.result.image} alt="" loading="lazy" />
                      ) : (
                        <UtensilsCrossed size={30} aria-hidden="true" />
                      )}
                      {opening === entry.result.externalId ? (
                        <Loader2 size={17} aria-hidden="true" className={styles.spinner} />
                      ) : null}
                    </span>
                    <span className={styles.cardBody}>
                      <span className={styles.cardTitle}>{entry.result.title}</span>
                      <span className={styles.cardMeta}>
                        {entry.matched.length ? (
                          <span className={styles.match}>
                            Uses {entry.matched.length} of yours ·{' '}
                            {entry.matched.join(', ')}
                          </span>
                        ) : (
                          [entry.result.category, entry.result.cuisine]
                            .filter(Boolean)
                            .join(' · ')
                        )}
                      </span>
                      {entry.sourceLabel ? (
                        <span className={styles.source}>{entry.sourceLabel}</span>
                      ) : null}
                      {entry.alreadySaved ? (
                        <span className={styles.saved}>
                          <Check size={12} aria-hidden="true" />
                          Already in your recipes
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.attribution}>
              Searching{' '}
              {providers.map((source, index) => (
                <span key={source.id}>
                  {index > 0 ? ' · ' : ''}
                  <a href={source.attributionUrl} target="_blank" rel="noreferrer">
                    {source.label}
                  </a>
                </span>
              ))}
            </p>
          </>
        )
      ) : null}

      {!results && !failure && !busy && mode === 'search' ? (
        <p className={styles.hint}>
          Anything you save becomes an ordinary MealHelp recipe, source link and all.
        </p>
      ) : null}
    </div>
  )
}
