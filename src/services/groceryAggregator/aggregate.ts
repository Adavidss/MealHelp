import type {
  GroceryCategory,
  GroceryItem,
  GroceryQuantity,
  GrocerySource,
  PantryItem,
  Recipe,
} from '@/models'
import { GROCERY_CATEGORIES } from '@/models'
import {
  categorizeIngredient,
  displayIngredientName,
  normalizeIngredientKey,
} from '@/services/ingredientParser'
import { combineQuantities, scaleAmount } from '@/services/unitConversion'
import { newId } from '@/utils/id'

/** One cooking session's worth of a recipe. */
export interface GroceryEntry {
  recipe: Recipe
  /** Servings to actually cook; scales the recipe when it differs. */
  servings?: number
  date?: string
}

export interface AggregateOptions {
  entries: GroceryEntry[]
  pantry?: PantryItem[]
  /** Items typed in by hand; carried through untouched. */
  manualItems?: GroceryItem[]
}

interface Accumulator {
  key: string
  quantities: GroceryQuantity[]
  categories: GroceryCategory[]
  sources: GrocerySource[]
  optionalFlags: boolean[]
  /** The most descriptive spelling seen, used for display. */
  bestName: string
}

/**
 * Turns the week's cooking into one shopping list.
 *
 * Only entries handed in here contribute ingredients — the planner passes
 * cooking sessions, never leftover slots, so a bulk meal is bought for once
 * however many nights it feeds.
 */
export function aggregateGroceries(options: AggregateOptions): GroceryItem[] {
  const { entries, pantry = [], manualItems = [] } = options

  const pantryKeys = new Map(pantry.filter((p) => p.alwaysHave).map((p) => [p.key, p]))
  const accumulators = new Map<string, Accumulator>()

  for (const entry of entries) {
    const { recipe } = entry
    const factor = servingFactor(recipe, entry.servings)

    for (const ingredient of recipe.ingredients) {
      const name = ingredient.ingredientName?.trim()
      if (!name) continue

      const key = normalizeIngredientKey(name)
      if (!key) continue

      const accumulator = accumulators.get(key) ?? {
        key,
        quantities: [],
        categories: [],
        sources: [],
        optionalFlags: [],
        bestName: name,
      }

      accumulator.quantities.push(toQuantity(ingredient.quantity, ingredient.unit, factor))
      // The aisle is worked out fresh here rather than trusted from the recipe,
      // so recipes saved before a dictionary improvement get the benefit of it.
      // A stored aisle only wins when the current guess is "Other".
      const guessed = categorizeIngredient(name)
      accumulator.categories.push(
        guessed === 'Other'
          ? ((ingredient.groceryCategory as GroceryCategory) ?? guessed)
          : guessed,
      )
      accumulator.sources.push({
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        originalText: ingredient.originalText,
        date: entry.date,
      })
      accumulator.optionalFlags.push(Boolean(ingredient.optional))
      // Prefer the shortest spelling: "onion" over "large yellow onion, diced".
      if (name.length < accumulator.bestName.length) accumulator.bestName = name
      // …but never one so short it loses what distinguishes the item.
      if (normalizeIngredientKey(accumulator.bestName) !== key) accumulator.bestName = name

      accumulators.set(key, accumulator)
    }
  }

  const items: GroceryItem[] = []

  for (const accumulator of accumulators.values()) {
    const quantities = combineQuantities(accumulator.quantities)
    const pantryMatch = pantryKeys.get(accumulator.key)
    const countable = quantities.length === 1 && !quantities[0].unit
    const plural = countable && (quantities[0].amount ?? 1) > 1

    items.push({
      id: newId('gi'),
      key: accumulator.key,
      name: displayIngredientName(accumulator.bestName, { plural }),
      quantities,
      category: pickCategory(accumulator.categories),
      checked: false,
      pantryStaple: Boolean(pantryMatch),
      optional: accumulator.optionalFlags.every(Boolean) || undefined,
      sources: accumulator.sources,
    })
  }

  items.push(...manualItems)
  return sortGroceryItems(items)
}

function servingFactor(recipe: Recipe, servings?: number): number {
  if (!servings || !recipe.servings || recipe.servings <= 0) return 1
  return servings / recipe.servings
}

function toQuantity(
  amount: number | undefined,
  unit: string | undefined,
  factor: number,
): GroceryQuantity {
  if (amount == null) {
    // No number to scale, so nothing is invented — the line survives as text.
    return unit ? { freeform: unit } : { freeform: '' }
  }
  const scaled = scaleAmount(amount, factor) ?? amount
  return unit ? { amount: scaled, unit } : { amount: scaled }
}

/** The aisle most of the sources agreed on, ignoring "Other" where possible. */
function pickCategory(categories: GroceryCategory[]): GroceryCategory {
  const counts = new Map<GroceryCategory, number>()
  for (const category of categories) {
    if (category === 'Other') continue
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  let best: GroceryCategory = 'Other'
  let bestCount = 0
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }
  return best
}

export function categoryRank(
  category: string,
  order: string[] = [...GROCERY_CATEGORIES],
): number {
  const index = order.indexOf(category)
  return index === -1 ? order.length : index
}

export function sortGroceryItems(
  items: GroceryItem[],
  order?: string[],
): GroceryItem[] {
  return [...items].sort((a, b) => {
    const rank = categoryRank(a.category, order) - categoryRank(b.category, order)
    if (rank !== 0) return rank
    return a.name.localeCompare(b.name)
  })
}

/**
 * Regenerating a list must not undo an hour of shopping, so anything already
 * ticked off stays ticked, and hand-added items are never dropped.
 */
export function mergeGroceryLists(
  previous: GroceryItem[],
  next: GroceryItem[],
): GroceryItem[] {
  const previousByKey = new Map(previous.map((item) => [item.key, item]))
  const merged = next.map((item) => {
    const old = previousByKey.get(item.key)
    if (!old) return item
    return {
      ...item,
      id: old.id,
      checked: old.checked,
      haveIt: old.haveIt,
      note: old.note ?? item.note,
    }
  })

  const nextKeys = new Set(next.map((item) => item.key))
  for (const item of previous) {
    if (item.manual && !nextKeys.has(item.key)) merged.push(item)
  }

  return sortGroceryItems(merged)
}
