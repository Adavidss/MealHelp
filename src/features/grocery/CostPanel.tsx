import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { clearOwnPrice, loadPriceBook, setOwnPrice } from '@/db/prices'
import type { GroceryItem } from '@/models'
import { formatMoney, priceBreakdown } from '@/services/pricing'
import { formatQuantity } from '@/services/unitConversion'
import styles from './CostPanel.module.css'

interface CostPanelProps {
  items: GroceryItem[]
  currency?: string
}

/**
 * What this shop is going to cost, roughly.
 *
 * Deliberately an estimate with its workings on show. The number is only as
 * good as a typical price and a recipe quantity — "2 tbsp olive oil" is a
 * splash from a bottle you own, not a purchase — so the panel says how much of
 * the list it could price, lists what it could not, and lets any line be
 * corrected. A corrected price is remembered for every week after this one.
 */
export function CostPanel({ items, currency = '$' }: CostPanelProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GroceryItem>()
  const [draft, setDraft] = useState('')

  const ownPrices = useLiveQuery(() => loadPriceBook(), [], new Map())
  const breakdown = useMemo(() => priceBreakdown(items, ownPrices), [items, ownPrices])

  // Nothing to say about an empty list.
  if (!breakdown.itemCount) return null

  const coverage =
    breakdown.pricedCount === breakdown.itemCount
      ? 'every item priced'
      : `${breakdown.pricedCount} of ${breakdown.itemCount} items priced`

  const startEditing = (item: GroceryItem) => {
    setEditing(item)
    setDraft(String(ownPrices?.get(item.key)?.price ?? ''))
  }

  const saveEdit = async (unit: string) => {
    if (!editing) return
    const value = Number(draft)
    if (Number.isFinite(value) && value > 0) {
      await setOwnPrice(editing.key, value, unit)
    } else {
      await clearOwnPrice(editing.key)
    }
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
            <strong>About {formatMoney(breakdown.total, currency)}</strong>
            <small>{coverage} · an estimate</small>
          </span>
        </span>
        {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>

      {open ? (
        <div className={styles.body}>
          <ul className={styles.categories}>
            {breakdown.byCategory.map((group) => (
              <li key={group.category}>
                <div className={styles.categoryHead}>
                  <span>{group.category}</span>
                  <strong>{formatMoney(group.total, currency)}</strong>
                </div>
                {/* A bar rather than a percentage: the useful fact is which
                    aisle is eating the budget, not by exactly how much. */}
                <div className={styles.bar} aria-hidden="true">
                  <span
                    style={{
                      width: `${breakdown.total ? (group.total / breakdown.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <ul className={styles.lines}>
                  {group.items.map(({ item, price }) => (
                    <li key={item.id} className={styles.line}>
                      <span className={styles.lineName}>
                        {item.quantities.map(formatQuantity).filter(Boolean).join(' + ')} {item.name}
                      </span>
                      {editing?.id === item.id ? (
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
                            aria-label={`Your price for ${item.name}`}
                          />
                          <span className={styles.perUnit}>
                            per {item.quantities[0]?.unit ?? 'each'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => void saveEdit(item.quantities[0]?.unit ?? 'each')}
                          >
                            Save
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.price} ${
                            price.origin === 'own' ? styles.ownPrice : ''
                          }`}
                          onClick={() => startEditing(item)}
                          title={
                            price.origin === 'own'
                              ? 'Your price — tap to change'
                              : 'A typical price — tap to set your own'
                          }
                        >
                          {price.amount != null ? formatMoney(price.amount, currency) : '—'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {breakdown.unpriced.length ? (
            <p className={styles.unpriced}>
              No price for {breakdown.unpriced.map((item) => item.name).join(', ')} — tap the
              dash on a line to set one, and MealHelp will remember it.
            </p>
          ) : null}

          <p className={styles.caveat}>
            Typical supermarket prices, and recipe amounts rather than package
            sizes — a tablespoon of oil is costed as a tablespoon, not a bottle.
            Treat it as a ballpark, and correct any line to make it yours.
          </p>
        </div>
      ) : null}
    </section>
  )
}
