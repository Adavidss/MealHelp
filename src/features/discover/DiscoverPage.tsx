import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Dices, Loader2, Plus, Search, Sparkles, UtensilsCrossed, X } from 'lucide-react'
import { db } from '@/db/database'
import { saveRecipe } from '@/db/recipes'
import type { Recipe, RecipeDraft } from '@/models'
import {
  DiscoveryError,
  MAX_INGREDIENTS_PER_SEARCH,
  discoverByIngredients,
  markAlreadySaved,
  suggestedSearchIngredients,
  theMealDbProvider,
  type RankedDiscovery,
} from '@/services/recipeDiscovery'
import { EmptyState } from '@/components/common/EmptyState'
import { useToast } from '@/components/common/Toast'
import { ImportPreview } from '@/features/import/ImportPreview'
import styles from './DiscoverPage.module.css'

type Mode = 'pantry' | 'search' | 'surprise'

const provider = theMealDbProvider

export function DiscoverPage() {
  const { toast } = useToast()

  const pantry = useLiveQuery(() => db.pantryItems.toArray(), [], [])
  const library = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])

  const [mode, setMode] = useState<Mode>('pantry')
  const [selected, setSelected] = useState<string[]>([])
  const [extra, setExtra] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RankedDiscovery[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{ message: string; suggestion?: string }>()
  const [preview, setPreview] = useState<RecipeDraft>()
  const [opening, setOpening] = useState<string>()

  const inFlight = useRef<AbortController>(null)

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
      setResults(markAlreadySaved(found, library ?? []))
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
    run((signal) =>
      // Deliberately unfiltered: a recipe using one of your three ingredients
      // is still worth seeing, it just sorts below one that uses all three.
      // Requiring full coverage is how "what can I make" returns nothing.
      discoverByIngredients(provider, selected, { signal, library: library ?? [] }),
    )

  const searchText = () =>
    run(async (signal) => {
      const found = await provider.searchByText(query, signal)
      return found.map((result) => ({ result, matched: [] }))
    })

  const surprise = () =>
    run(async (signal) => {
      // One request per card, because the API hands out a single random meal.
      const picks = await Promise.all(
        Array.from({ length: 5 }, () => provider.random(signal)),
      )
      const seen = new Set<string>()
      return picks
        .flat()
        .filter((result) => !seen.has(result.externalId) && seen.add(result.externalId))
        .map((result) => ({ result, matched: [] }))
    })

  const open = async (entry: RankedDiscovery) => {
    setOpening(entry.result.externalId)
    try {
      const draft = await provider.fetchRecipe(entry.result.externalId)
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

  const addExtra = (event: React.FormEvent) => {
    event.preventDefault()
    const value = extra.trim()
    if (!value) return
    if (!selected.includes(value)) toggleIngredient(value)
    setExtra('')
  }

  // Previewing reuses the import screen, so a discovered recipe is checked over
  // in exactly the same place as a pasted one before it is saved.
  if (preview) {
    return (
      <ImportPreview
        result={{ recipe: preview, warnings: [], adapterId: provider.id }}
        onBack={() => setPreview(undefined)}
        onSave={(draft) => void save(draft)}
        onEdit={(draft) => void save(draft)}
      />
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Discover</h1>
          <p className="page-subtitle">
            Find something new and add it to your library
          </p>
        </div>
      </header>

      <div className={styles.modes} role="tablist" aria-label="How to search">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'pantry'}
          className="chip chip-button"
          onClick={() => setMode('pantry')}
        >
          From my pantry
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'search'}
          className="chip chip-button"
          onClick={() => setMode('search')}
        >
          Search
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'surprise'}
          className="chip chip-button"
          onClick={() => setMode('surprise')}
        >
          Surprise me
        </button>
      </div>

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
              <Link to="/pantry">set up your pantry</Link> so it is remembered.
            </p>
          )}

          <form className={styles.addRow} onSubmit={addExtra}>
            <input
              className="input"
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              placeholder="chicken, spinach, black beans…"
              aria-label="Add an ingredient to search with"
            />
            <button type="submit" className="btn btn-primary btn-icon" aria-label="Add ingredient">
              <Plus size={19} aria-hidden="true" />
            </button>
          </form>

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
        </section>
      ) : null}

      {mode === 'surprise' ? (
        <section className={styles.panel}>
          <p className="text-sm muted">
            Five recipes at random, for when nothing sounds good.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void surprise()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={17} aria-hidden="true" />
            ) : (
              <Dices size={17} aria-hidden="true" />
            )}
            {busy ? 'Looking…' : 'Surprise me'}
          </button>
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
                        <UtensilsCrossed size={20} aria-hidden="true" />
                      )}
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
                      {entry.alreadySaved ? (
                        <span className={styles.saved}>
                          <Check size={12} aria-hidden="true" />
                          Already in your recipes
                        </span>
                      ) : null}
                    </span>
                    {opening === entry.result.externalId ? (
                      <Loader2 size={17} aria-hidden="true" className={styles.spinner} />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.attribution}>
              {provider.attribution} ·{' '}
              <a href={provider.attributionUrl} target="_blank" rel="noreferrer">
                themealdb.com
              </a>
            </p>
          </>
        )
      ) : null}

      {!results && !failure && !busy ? (
        <p className={styles.hint}>
          Anything you save becomes an ordinary MealHelp recipe — it keeps its
          source link, and it can be planned, shopped for and cooked like the
          rest.
        </p>
      ) : null}
    </div>
  )
}
