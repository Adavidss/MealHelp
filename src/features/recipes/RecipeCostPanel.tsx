import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { clearOwnPrice, loadPriceBook, setOwnPrice } from '@/db/prices'
import { pantryKeySet } from '@/db/pantry'
import type { Recipe } from '@/models'
import { formatMoney, recipeCost } from '@/services/pricing'
import styles from './RecipeCostPanel.module.css'

interface RecipeCostPanelProps {
  recipe: Recipe
  /** The page's own ½×–2× scaling, so the cost follows what you would cook. */
  scale: number
}

/**
 * What this costs to make.
 *
 * Deliberately the cost of *cooking it*, not of shopping for it from an empty
 * kitchen: two tablespoons of oil are two tablespoons of a bottle, not a
 * bottle. That is the same rule the week's grocery estimate uses, so a recipe
 * and the list it lands on can never tell different stories.
 *
 * The cupboard is counted separately for the same reason. If you have said you
 * always have salt and olive oil, they are not part of what this will cost
 * you — but they are still part of the recipe, so they are shown, just under
 * their own line.
 */
export function RecipeCostPanel({ recipe, scale }: RecipeCostPanelProps) {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string>()
  const [draft, setDraft] = useState('')

  const ownPrices = useLiveQuery(() => loadPriceBook(), [], new Map())
  const pantryKeys = useLiveQuery(() => pantryKeySet(), [], new Set<string>())

  const cost = useMemo(
    () => recipeCost(recipe, { scale, ownPrices, pantryKeys }),
    [recipe, scale, ownPrices, pantryKeys],
  )

  const currency = settings.currency ?? '$'

  // Nothing recognised means nothing worth claiming.
  if (!cost.pricedCount) return null

  const save = async (line: { name: string; unit?: string }) => {
    const key = line.name.toLowerCase()
    const value = Number(draft)
    if (Number.isFinite(value) && value > 0) await setOwnPrice(key, value, line.unit ?? 'each')
    else await clearOwnPrice(key)
    setEditing(undefined)
    setDraft('')
  }

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.headText}>
          <Wallet size={17} aria-hidden="true" />
          <span>
            <strong>
              About {formatMoney(cost.total, currency)}
              {cost.perServing != null ? (
                <span className={styles.perServing}>
                  {' '}
                  · {formatMoney(cost.perServing, currency)} a serving
                </span>
              ) : null}
            </strong>
            <small>
              {cost.servings ? `${cost.servings} servings · ` : ''}
              {cost.unpriced.length
                ? `${cost.pricedCount} of ${cost.lines.length} ingredients priced`
                : 'every ingredient priced'}
              {' · an estimate'}
            </small>
          </span>
        </span>
        {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>

      {open ? (
        <div className={styles.body}>
          <ul className={styles.lines}>
            {cost.lines.map((line) => (
              <li key={line.id} className={`${styles.line} ${line.pantry ? styles.pantryLine : ''}`}>
                <span className={styles.lineName}>
                  {line.originalText}
                  {line.pantry ? <span className={styles.tag}>you always have</span> : null}
                </span>

                {editing === line.id ? (
                  <span className={styles.editor}>
                    <span className={styles.currency}>{currency}</span>
                    <input
                      className={`input ${styles.priceInput}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft}
                      autoFocus
                      onChange={(event) => setDraft(event.target.value)}
                      aria-label={`Your price for ${line.name}`}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void save({ name: line.name })}
                    >
                      Save
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`${styles.price} ${line.price.origin === 'own' ? styles.ownPrice : ''}`}
                    onClick={() => {
                      setEditing(line.id)
                      setDraft('')
                    }}
                    title={
                      line.price.origin === 'own'
                        ? 'Your price — tap to change'
                        : 'A typical price — tap to set your own'
                    }
                  >
                    {line.price.amount != null ? formatMoney(line.price.amount, currency) : '—'}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {cost.pantryTotal > 0 ? (
            <p className={styles.note}>
              Plus about {formatMoney(cost.pantryTotal, currency)} of things you said you
              always have, which are not counted above.
            </p>
          ) : null}

          <p className={styles.caveat}>
            Costed as the amount this recipe uses — two tablespoons of oil are two
            tablespoons of a bottle, not a bottle — so it is what cooking this takes
            out of the cupboard, not what a shop from nothing would cost. Typical
            prices; tap any line to use yours instead.
          </p>
        </div>
      ) : null}
    </section>
  )
}
