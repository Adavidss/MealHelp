import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, Dices, Globe, Loader2 } from 'lucide-react'
import { useQuickPlan } from '@/app/QuickPlanContext'
import { useSettings } from '@/app/SettingsContext'
import { saveRecipe } from '@/db/recipes'
import type { Recipe, RecipeDraft } from '@/models'
import {
  DiscoveryError,
  activeProviders,
  providerById,
  searchAllProviders,
  theMealDbProvider,
  type DiscoveryResult,
} from '@/services/recipeDiscovery'
import { pickSurprise, rememberPick } from '@/utils/surprise'
import { MealCard } from '@/components/meal/MealCard'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { ImportPreview } from '@/features/import/ImportPreview'
import styles from './SurpriseSheet.module.css'

interface SurpriseSheetProps {
  open: boolean
  /** What to pick from — usually whatever the mood chips have narrowed to. */
  pool: Recipe[]
  /** Named so the sheet can say what it drew from: "comforting", "your recipes". */
  poolLabel?: string
  onClose: () => void
}

/**
 * One recipe, at random, and three things to do with it.
 *
 * The mood chips are for when you have a vague idea; this is for when you have
 * none at all, which is the more common evening. It shows exactly one meal —
 * a list would just be the decision again — with the same tap that any card
 * has to put it on a day, and "Another" for when the answer is no.
 *
 * When your own shelf runs out of ideas it can roll the recipe databases
 * instead, which is the only part that touches the network and only when
 * asked.
 */
export function SurpriseSheet({ open, pool, poolLabel, onClose }: SurpriseSheetProps) {
  const { settings } = useSettings()
  const { planMeal } = useQuickPlan()
  const { toast } = useToast()

  /*
   * The memory lives in a ref, not in state: every pick has to go into it,
   * including the one made when the sheet opens. Recording only the ones from
   * "Another" let the opening pick come back two rolls later, which is
   * exactly the repeat this is meant to prevent.
   */
  const recent = useRef<string[]>([])
  const [pick, setPick] = useState<Recipe>()
  const [fromWeb, setFromWeb] = useState<DiscoveryResult>()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<RecipeDraft>()

  const providerOptions = useMemo(
    () => ({ spoonacularKey: settings.spoonacularKey?.trim() }),
    [settings.spoonacularKey],
  )

  const roll = useCallback(() => {
    const next = pickSurprise(pool, recent.current)
    if (!next) return
    recent.current = rememberPick(recent.current, next.id)
    setFromWeb(undefined)
    setPick(next)
  }, [pool])

  // A fresh pick each time the sheet opens: reopening it to see the same meal
  // would be the opposite of what the button promises. Deliberately not
  // re-rolling when the pool changes underneath, which would swap the meal
  // out while it is being looked at.
  useEffect(() => {
    if (open) roll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const rollTheWeb = async () => {
    setBusy(true)
    try {
      const providers = activeProviders(providerOptions)
      const { results } = await searchAllProviders(providers, (provider) => provider.random())
      const chosen = results.length
        ? results[Math.floor(Math.random() * results.length)]
        : undefined
      if (!chosen) throw new DiscoveryError('empty', 'Nothing came back just now.')
      setFromWeb(chosen)
    } catch (error) {
      toast(
        error instanceof DiscoveryError
          ? error.message
          : 'MealHelp could not reach the recipe databases just now.',
        { tone: 'error' },
      )
    } finally {
      setBusy(false)
    }
  }

  const openWebPick = async () => {
    if (!fromWeb) return
    setBusy(true)
    try {
      const source = providerById(fromWeb.providerId, providerOptions) ?? theMealDbProvider
      setPreview(await source.fetchRecipe(fromWeb.externalId))
    } catch {
      toast('That recipe could not be opened.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const save = async (draft: RecipeDraft) => {
    const saved = await saveRecipe(draft)
    setPreview(undefined)
    onClose()
    toast(`Saved ${saved.title} to your recipes.`, { tone: 'success' })
  }

  if (preview) {
    return (
      <ImportPreview
        result={{ recipe: preview, warnings: [], adapterId: 'surprise' }}
        onBack={() => setPreview(undefined)}
        onSave={(draft) => void save(draft)}
        onEdit={(draft) => void save(draft)}
      />
    )
  }

  return (
    <Modal open={open} title="Surprise me" onClose={onClose}>
      {fromWeb ? (
        <div className={styles.web}>
          <span className={styles.webArt}>
            {fromWeb.image ? (
              <img src={fromWeb.image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <Globe size={26} aria-hidden="true" />
            )}
          </span>
          <h3 className={styles.webTitle}>{fromWeb.title}</h3>
          <p className={styles.webMeta}>
            {[fromWeb.category, fromWeb.cuisine].filter(Boolean).join(' · ') || 'From the web'}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void openWebPick()}
              disabled={busy}
            >
              {busy ? <Loader2 size={16} aria-hidden="true" /> : null}
              Have a look
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void rollTheWeb()}
              disabled={busy}
            >
              <Dices size={16} aria-hidden="true" />
              Another
            </button>
            <button type="button" className="btn btn-ghost" onClick={roll}>
              Back to my recipes
            </button>
          </div>
        </div>
      ) : pick ? (
        <div className={styles.pick}>
          <MealCard recipe={pick} size="feed" to={`/recipes/${pick.id}`} />

          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                planMeal(pick)
                onClose()
              }}
            >
              Put it on a day
            </button>
            <button type="button" className="btn btn-secondary" onClick={roll}>
              <Dices size={16} aria-hidden="true" />
              Another
            </button>
            <Link
              to={`/recipes/${pick.id}/cook`}
              className="btn btn-ghost"
              onClick={onClose}
            >
              <ChefHat size={16} aria-hidden="true" />
              Cook it now
            </Link>
          </div>

          <p className={styles.note}>
            Picked at random from {poolLabel ?? 'your recipes'}.
          </p>

          <button
            type="button"
            className={styles.webLink}
            onClick={() => void rollTheWeb()}
            disabled={busy}
          >
            {busy ? <Loader2 size={14} aria-hidden="true" /> : <Globe size={14} aria-hidden="true" />}
            Or surprise me from the recipe databases
          </button>
        </div>
      ) : (
        <div className={styles.pick}>
          <p className="muted">
            There is nothing to pick from yet. Save a few recipes and this gets much
            more fun.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void rollTheWeb()}
            disabled={busy}
          >
            <Globe size={16} aria-hidden="true" />
            Surprise me from the web
          </button>
        </div>
      )}
    </Modal>
  )
}
