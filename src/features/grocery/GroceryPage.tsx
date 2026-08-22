import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, RefreshCw, Share2, Trash2, X } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import {
  addManualGroceryItem,
  clearCheckedItems,
  generateGroceryList,
  getGroceryList,
  removeGroceryItem,
  removeRecipeFromGroceryList,
  setPantryDecision,
  toggleGroceryItem,
} from '@/db/grocery'
import { GROCERY_CATEGORIES, type GroceryItem, type Recipe } from '@/models'
import { categoryRank } from '@/services/groceryAggregator'
import { formatQuantity } from '@/services/unitConversion'
import { formatWeekRange, startOfWeek, todayISO } from '@/utils/date'
import { EmptyState } from '@/components/common/EmptyState'
import { mealArt } from '@/components/meal/mealArtwork'
import { SearchField } from '@/components/common/SearchField'
import { SegmentedTabs } from '@/components/common/SegmentedTabs'
import { useToast } from '@/components/common/Toast'
import { useSectionTab } from '@/app/useSectionTab'
import { PantryView } from '@/features/pantry/PantryPage'
import { ShareGroceryDialog } from '@/features/sharing/ShareGroceryDialog'
import { CostPanel } from './CostPanel'
import styles from './GroceryPage.module.css'

export function GroceryPage() {
  const { settings } = useSettings()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const weekStart =
    searchParams.get('week') ?? startOfWeek(todayISO(), settings.weekStartsOn)
  const [tab, setTab] = useSectionTab<'list' | 'pantry'>(['list', 'pantry'], 'list')

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

  // Only for the thumbnails on each line: which meals wanted this ingredient.
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const recipesById = useMemo(
    () => new Map((recipes ?? []).map((recipe) => [recipe.id, recipe])),
    [recipes],
  )

  const [newItem, setNewItem] = useState('')
  const [showCompleted, setShowCompleted] = useState(!settings.hideCompletedGrocery)
  const [shareOpen, setShareOpen] = useState(false)

  // One field does both jobs: typing narrows the list to what matches, and
  // Enter adds what you typed. On a phone there is no room for two.
  const needle = newItem.trim().toLowerCase()
  const items = useMemo(() => {
    const all = list?.items ?? []
    if (!needle) return all
    return all.filter((item) => item.name.toLowerCase().includes(needle))
  }, [list, needle])

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

  const extras = list?.extras ?? []

  const regenerate = async () => {
    if (!meals?.length && !extras.length) {
      toast('Plan some meals first, then MealHelp can build the list.')
      return
    }
    await generateGroceryList(weekStart, meals ?? [], { planId: plan?.id })
    toast(
      extras.length
        ? 'Grocery list updated from your plan and the recipes you added.'
        : 'Grocery list updated from your plan.',
      { tone: 'success' },
    )
  }

  const addItem = async () => {
    if (!newItem.trim()) return
    await addManualGroceryItem(weekStart, newItem)
    setNewItem('')
  }

  const tabs = (
    <SegmentedTabs
      tabs={[
        { id: 'list', label: 'List', count: toBuy.length + pantryChecks.length || undefined },
        { id: 'pantry', label: 'Pantry' },
      ]}
      value={tab}
      onChange={setTab}
      label="Grocery views"
    />
  )

  if (tab === 'pantry') {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Pantry</h1>
          </div>
          {tabs}
        </header>
        <PantryView />
      </div>
    )
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

      <div className={styles.tabRow}>{tabs}</div>

      <div className={styles.addRow}>
        <SearchField
          value={newItem}
          onChange={setNewItem}
          onSubmit={() => void addItem()}
          placeholder="Find or add — milk, paper towels…"
          label="Find or add a grocery item"
          trailing={
            newItem.trim() ? (
              <button type="button" className={styles.addButton} onClick={() => void addItem()}>
                <Plus size={15} aria-hidden="true" />
                Add
              </button>
            ) : null
          }
        />
      </div>

      {extras.length ? (
        <section className={styles.extras} aria-label="Recipes added to this list">
          <span className={styles.extrasLabel}>Also shopping for</span>
          <ul className={styles.extrasList}>
            {extras.map((extra) => (
              <li key={extra.recipeId} className={styles.extraChip}>
                <Link to={`/recipes/${extra.recipeId}`} className={styles.extraName}>
                  {extra.recipeTitle}
                  {extra.servings ? (
                    <span className="faint"> · {extra.servings} servings</span>
                  ) : null}
                </Link>
                <button
                  type="button"
                  className={styles.extraRemove}
                  onClick={() => void removeRecipeFromGroceryList(weekStart, extra.recipeId)}
                  aria-label={`Take ${extra.recipeTitle} off the list`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length === 0 && needle ? (
        <p className="text-sm muted">
          Nothing on the list matches “{newItem.trim()}” — press Add to put it on.
        </p>
      ) : null}

      {(list?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No list yet"
          description="Plan the week's meals and MealHelp will turn them into one list. Any recipe's page can add its ingredients here too, and anything else goes in by hand above."
        >
          <Link to={`/plan/${weekStart}`} className="btn btn-primary">
            Open the planner
          </Link>
        </EmptyState>
      ) : null}

      {items.length ? <CostPanel items={items} currency={settings.currency} /> : null}

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
                recipesById={recipesById}
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
                    recipesById={recipesById}
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

/**
 * One line of the shop, and what it is for.
 *
 * The thumbnails are the point: "Onions ×3" beside the chili and the tacos
 * says why the onions are on the list in the time it takes to look, where a
 * number in a circle only promises an explanation if you tap it. Tapping is
 * still there — it opens the exact lines the recipes wrote — but the common
 * question is answered without it.
 */
function GroceryRow({
  item,
  recipesById,
  onToggle,
  onRemove,
}: {
  item: GroceryItem
  recipesById: Map<string, Recipe>
  onToggle: () => void
  onRemove: () => void
}) {
  const [showSources, setShowSources] = useState(false)
  const recipeNames = [
    ...new Set(item.sources.map((source) => source.recipeTitle)),
  ]

  // One thumbnail per recipe, in the order they were added, three at most:
  // beyond that they stop being recognisable and start being noise.
  const thumbs = [
    ...new Map(
      item.sources
        .filter((source) => source.recipeId)
        .map((source) => [source.recipeId as string, source]),
    ).values(),
  ].slice(0, 3)

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
            className={`${styles.sourceToggle} tap-target`}
            onClick={() => setShowSources((open) => !open)}
            aria-expanded={showSources}
            aria-label={`Why is ${item.name} on the list? ${recipeNames.join(', ')}`}
          >
            {thumbs.length ? (
              <span className={styles.thumbs}>
                {thumbs.map((source) => {
                  const recipe = recipesById.get(source.recipeId as string)
                  const art = recipe ? mealArt(recipe) : undefined
                  return (
                    <span
                      key={source.recipeId}
                      className={`${styles.thumb} ${
                        art && art.kind === 'generated' ? styles[`palette${art.palette}`] : ''
                      }`}
                      title={source.recipeTitle}
                    >
                      {art?.kind === 'photo' ? (
                        <img src={art.src} alt="" loading="lazy" />
                      ) : (
                        // No photograph to shrink, so the initial stands in:
                        // at 22px an icon is mush, and a bare colour says
                        // "three recipes" without saying which three.
                        <span aria-hidden="true">{source.recipeTitle.trim().charAt(0)}</span>
                      )}
                    </span>
                  )
                })}
                {recipeNames.length > thumbs.length ? (
                  <span className={styles.moreCount}>+{recipeNames.length - thumbs.length}</span>
                ) : null}
              </span>
            ) : (
              recipeNames.length
            )}
          </button>
        ) : null}
        <button
          type="button"
          className={`${styles.remove} tap-target`}
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
