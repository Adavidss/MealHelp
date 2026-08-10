import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import {
  addManualGroceryItem,
  clearCheckedItems,
  generateGroceryList,
  getGroceryList,
  removeGroceryItem,
  setPantryDecision,
  toggleGroceryItem,
} from '@/db/grocery'
import { GROCERY_CATEGORIES, type GroceryItem } from '@/models'
import { categoryRank } from '@/services/groceryAggregator'
import { formatQuantity } from '@/services/unitConversion'
import { formatWeekRange, startOfWeek, todayISO } from '@/utils/date'
import { EmptyState } from '@/components/common/EmptyState'
import { useToast } from '@/components/common/Toast'
import { ShareGroceryDialog } from '@/features/sharing/ShareGroceryDialog'
import styles from './GroceryPage.module.css'

export function GroceryPage() {
  const { settings } = useSettings()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const weekStart =
    searchParams.get('week') ?? startOfWeek(todayISO(), settings.weekStartsOn)

  const list = useLiveQuery(() => getGroceryList(weekStart), [weekStart])
  const plan = useLiveQuery(
    () => db.mealPlans.where('weekStart').equals(weekStart).first(),
    [weekStart],
  )
  const meals = useLiveQuery(
    async () => (plan ? db.plannedMeals.where('planId').equals(plan.id).toArray() : []),
    [plan?.id],
    [],
  )

  const [newItem, setNewItem] = useState('')
  const [showCompleted, setShowCompleted] = useState(!settings.hideCompletedGrocery)
  const [shareOpen, setShareOpen] = useState(false)

  // Memoised so the grouping below only re-runs when the stored list changes,
  // not on every keystroke in the "add item" field.
  const items = useMemo(() => list?.items ?? [], [list])

  const { pantryChecks, toBuy, done } = useMemo(() => {
    const pantryChecks: GroceryItem[] = []
    const toBuy: GroceryItem[] = []
    const done: GroceryItem[] = []

    for (const item of items) {
      if (item.checked || item.haveIt) done.push(item)
      else if (item.pantryStaple) pantryChecks.push(item)
      else toBuy.push(item)
    }
    return { pantryChecks, toBuy, done }
  }, [items])

  const grouped = useMemo(() => {
    const order = list?.categoryOrder ?? [...GROCERY_CATEGORIES]
    const map = new Map<string, GroceryItem[]>()
    for (const item of toBuy) {
      const bucket = map.get(item.category) ?? []
      bucket.push(item)
      map.set(item.category, bucket)
    }
    return [...map.entries()].sort(
      (a, b) => categoryRank(a[0], order) - categoryRank(b[0], order),
    )
  }, [toBuy, list?.categoryOrder])

  const regenerate = async () => {
    if (!meals?.length) {
      toast('Plan some meals first, then MealHelp can build the list.')
      return
    }
    await generateGroceryList(weekStart, meals, { planId: plan?.id })
    toast('Grocery list updated from your plan.', { tone: 'success' })
  }

  const addItem = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newItem.trim()) return
    await addManualGroceryItem(weekStart, newItem)
    setNewItem('')
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Grocery list</h1>
          <p className="page-subtitle">
            {formatWeekRange(weekStart)} ·{' '}
            {toBuy.length + pantryChecks.length} to get
          </p>
        </div>
        <div className="row-tight">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => setShareOpen(true)}
            aria-label="Share list"
            disabled={items.length === 0}
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => void regenerate()}
            aria-label="Rebuild from this week's plan"
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <form className={styles.addRow} onSubmit={addItem}>
        <input
          className="input"
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          placeholder="Add anything — paper towels, milk…"
          aria-label="Add a grocery item"
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Add item">
          <Plus size={19} aria-hidden="true" />
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No list yet"
          description="Plan the week's meals and MealHelp will turn them into one list — or start adding items by hand above."
        >
          <Link to={`/plan/${weekStart}`} className="btn btn-primary">
            Open the planner
          </Link>
        </EmptyState>
      ) : null}

      {pantryChecks.length ? (
        <section className={styles.pantrySection}>
          <h2 className={styles.pantryTitle}>Check the pantry</h2>
          <p className={styles.pantryHint}>
            These are things you said you usually have. MealHelp is asking rather
            than assuming.
          </p>
          <ul className={styles.pantryList}>
            {pantryChecks.map((item) => (
              <li key={item.id} className={styles.pantryRow}>
                <span className={styles.pantryName}>
                  {quantityText(item)} {item.name}
                </span>
                <span className="row-tight">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void setPantryDecision(weekStart, item.id, true)}
                  >
                    Have it
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void setPantryDecision(weekStart, item.id, false)}
                  >
                    Need it
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {grouped.map(([category, categoryItems]) => (
        <section key={category} className="print-block">
          <h2 className={styles.categoryTitle}>{category}</h2>
          <ul className={styles.list}>
            {categoryItems.map((item) => (
              <GroceryRow
                key={item.id}
                item={item}
                onToggle={() => void toggleGroceryItem(weekStart, item.id)}
                onRemove={() => void removeGroceryItem(weekStart, item.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      {done.length ? (
        <section className={styles.completed}>
          <button
            type="button"
            className={styles.completedToggle}
            onClick={() => setShowCompleted((open) => !open)}
            aria-expanded={showCompleted}
          >
            Completed ({done.length})
          </button>
          {showCompleted ? (
            <>
              <ul className={styles.list}>
                {done.map((item) => (
                  <GroceryRow
                    key={item.id}
                    item={item}
                    onToggle={() => void toggleGroceryItem(weekStart, item.id)}
                    onRemove={() => void removeGroceryItem(weekStart, item.id)}
                  />
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void clearCheckedItems(weekStart)}
              >
                <Trash2 size={15} aria-hidden="true" />
                Clear completed
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {list ? (
        <ShareGroceryDialog
          open={shareOpen}
          list={list}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </div>
  )
}

function GroceryRow({
  item,
  onToggle,
  onRemove,
}: {
  item: GroceryItem
  onToggle: () => void
  onRemove: () => void
}) {
  const [showSources, setShowSources] = useState(false)
  const recipeNames = [
    ...new Set(item.sources.map((source) => source.recipeTitle)),
  ]

  return (
    <li className={styles.row}>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={item.checked}
          onChange={onToggle}
          className={styles.checkbox}
        />
        <span className={item.checked ? styles.struck : undefined}>
          <span className={styles.quantity}>{quantityText(item)}</span> {item.name}
          {item.optional ? <span className="faint"> (optional)</span> : null}
        </span>
      </label>

      <div className={styles.rowActions}>
        {recipeNames.length ? (
          <button
            type="button"
            className={styles.sourceToggle}
            onClick={() => setShowSources((open) => !open)}
            aria-expanded={showSources}
            aria-label={`Why is ${item.name} on the list?`}
          >
            {recipeNames.length}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      {showSources ? (
        <ul className={styles.sources}>
          {item.sources.map((source, index) => (
            <li key={`${source.recipeId ?? 'manual'}-${index}`}>
              <strong>{source.recipeTitle}</strong>
              <span className="faint"> · {source.originalText}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function quantityText(item: GroceryItem): string {
  return item.quantities.map(formatQuantity).filter(Boolean).join(' + ')
}
