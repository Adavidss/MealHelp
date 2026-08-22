import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, RefreshCw, Sparkles, UtensilsCrossed } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { saveRecipe } from '@/db/recipes'
import type { Recipe, RecipeDraft } from '@/models'
import {
  DiscoveryError,
  activeProviders,
  markAlreadySaved,
  providerById,
  searchAllProviders,
  theMealDbProvider,
  type RankedDiscovery,
} from '@/services/recipeDiscovery'
import { useToast } from '@/components/common/Toast'
import { ImportPreview } from '@/features/import/ImportPreview'
import styles from './OnlineIdeas.module.css'

interface OnlineIdeasProps {
  title: string
  blurb?: string
  /** What to ask for. Changing it clears what was found. */
  query: string
  /** Called for another go at the same idea — a different query each time. */
  onAnother?: (attempt: number) => void
  /** Titles already in the library, so it can stop offering you your own food. */
  excludeTitles?: string[]
  max?: number
}

/**
 * Ideas from the recipe databases, next to what you were already looking at.
 *
 * Discovery normally means going somewhere and asking for something, which is
 * exactly the effort nobody has at six o'clock. This puts the asking where the
 * looking already is — under a recipe you like, or under the mood you just
 * tapped — and does nothing at all until you press it, because a page that
 * quietly searches the internet on your behalf is not what this app is.
 */
export function OnlineIdeas({
  title,
  blurb,
  query,
  onAnother,
  excludeTitles = [],
  max = 8,
}: OnlineIdeasProps) {
  const { settings } = useSettings()
  const { toast } = useToast()
  const library = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])

  const [results, setResults] = useState<RankedDiscovery[]>()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string>()
  const [preview, setPreview] = useState<RecipeDraft>()
  const [opening, setOpening] = useState<string>()
  const inFlight = useRef<AbortController>(null)

  const providerOptions = useMemo(
    () => ({ spoonacularKey: settings.spoonacularKey?.trim() }),
    [settings.spoonacularKey],
  )
  const providers = useMemo(() => activeProviders(providerOptions), [providerOptions])

  // A new question deserves a blank slate rather than the last answer.
  useEffect(() => {
    setResults(undefined)
    setFailed(undefined)
  }, [query])

  useEffect(() => () => inFlight.current?.abort(), [])

  const look = async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setBusy(true)
    setFailed(undefined)
    try {
      const { results: found, failures } = await searchAllProviders(providers, (provider) =>
        provider.searchByText(query, controller.signal),
      )
      if (controller.signal.aborted) return
      if (!found.length && failures.length === providers.length) throw failures[0]

      const known = new Set(excludeTitles.map((entry) => entry.toLowerCase()))
      const fresh = found
        .filter((result) => !known.has(result.title.toLowerCase()))
        // A shelf meant to tempt you leads with the ones that have a
        // photograph. The rest still show — some sources publish none — but
        // they sit behind the food you can actually look at.
        .sort((a, b) => Number(!a.image) - Number(!b.image))

      setResults(
        markAlreadySaved(
          fresh.slice(0, max).map((result) => ({ result, matched: [] })),
          library ?? [],
        ),
      )
    } catch (error) {
      if (controller.signal.aborted) return
      setFailed(
        error instanceof DiscoveryError
          ? error.message
          : 'MealHelp could not reach the recipe databases just now.',
      )
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const open = async (entry: RankedDiscovery) => {
    setOpening(entry.result.externalId)
    try {
      const source =
        providerById(entry.result.providerId, providerOptions) ?? theMealDbProvider
      setPreview(await source.fetchRecipe(entry.result.externalId))
    } catch {
      toast('That recipe could not be opened.', { tone: 'error' })
    } finally {
      setOpening(undefined)
    }
  }

  const save = async (draft: RecipeDraft) => {
    const saved = await saveRecipe(draft)
    setPreview(undefined)
    toast(`Saved ${saved.title} to your recipes.`, { tone: 'success' })
  }

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
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {blurb ? <p className={styles.blurb}>{blurb}</p> : null}
        </div>
        {results && onAnother ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onAnother(Date.now())}
            disabled={busy}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Other ideas
          </button>
        ) : null}
      </div>

      {!results && !busy && !failed ? (
        <button type="button" className={styles.invite} onClick={() => void look()}>
          <Sparkles size={16} aria-hidden="true" />
          Show me some
          <small>Searches {providers.map((provider) => provider.label).join(' and ')}</small>
        </button>
      ) : null}

      {busy ? (
        <p className={styles.state}>
          <Loader2 size={15} aria-hidden="true" />
          Looking…
        </p>
      ) : null}

      {failed ? (
        <p className={styles.state}>
          {failed}{' '}
          <button type="button" className={styles.retry} onClick={() => void look()}>
            Try again
          </button>
        </p>
      ) : null}

      {results?.length === 0 ? (
        <p className={styles.state}>Nothing came back for that. Try another idea.</p>
      ) : null}

      {results?.length ? (
        <ul className={styles.row}>
          {results.map((entry) => (
            <li key={`${entry.result.providerId}:${entry.result.externalId}`}>
              <button
                type="button"
                className={styles.card}
                onClick={() => void open(entry)}
                disabled={opening === entry.result.externalId}
              >
                <span className={styles.art}>
                  {entry.result.image ? (
                    <img src={entry.result.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <UtensilsCrossed size={22} aria-hidden="true" />
                  )}
                  {opening === entry.result.externalId ? (
                    <span className={styles.opening}>
                      <Loader2 size={18} aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
                <span className={styles.cardTitle}>{entry.result.title}</span>
                <span className={styles.cardMeta}>
                  {[entry.result.category, entry.result.cuisine].filter(Boolean).join(' · ') ||
                    entry.sourceLabel}
                </span>
                {entry.alreadySaved ? (
                  <span className={styles.saved}>Already yours</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
