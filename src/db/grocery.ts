import { db } from './database'
import type { GroceryCategory, GroceryItem, GroceryList, PlannedMeal } from '@/models'
import {
  aggregateGroceries,
  mergeGroceryLists,
  sortGroceryItems,
  type GroceryEntry,
} from '@/services/groceryAggregator'
import {
  categorizeIngredient,
  normalizeIngredientKey,
  parseIngredient,
} from '@/services/ingredientParser'
import { formatQuantity } from '@/services/unitConversion'
import { newId, nowISO } from '@/utils/id'

export async function getGroceryList(
  weekStart: string,
): Promise<GroceryList | undefined> {
  return db.groceryLists.where('weekStart').equals(weekStart).first()
}

export async function getOrCreateGroceryList(weekStart: string): Promise<GroceryList> {
  const existing = await getGroceryList(weekStart)
  if (existing) return existing
  const now = nowISO()
  const list: GroceryList = {
    id: newId('gl'),
    weekStart,
    items: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.groceryLists.put(list)
  return list
}

/**
 * Builds the week's list from the meals that actually involve cooking.
 *
 * Leftover slots are filtered out here rather than in the aggregator, so the
 * rule that leftovers are never shopped for twice lives next to the planner
 * data it depends on.
 */
export async function generateGroceryList(
  weekStart: string,
  meals: PlannedMeal[],
  options: { planId?: string; keepChecked?: boolean } = {},
): Promise<GroceryList> {
  const cookingMeals = meals.filter(
    (meal) => meal.kind === 'recipe' && Boolean(meal.recipeId),
  )

  const recipes = await db.recipes.bulkGet(
    cookingMeals.map((meal) => meal.recipeId as string),
  )

  const entries: GroceryEntry[] = []
  cookingMeals.forEach((meal, index) => {
    const recipe = recipes[index]
    if (!recipe) return
    entries.push({ recipe, servings: meal.servings, date: meal.date })
  })

  const pantry = await db.pantryItems.toArray()
  const existing = await getGroceryList(weekStart)

  const generated = aggregateGroceries({ entries, pantry })
  const items =
    existing && options.keepChecked !== false
      ? mergeGroceryLists(existing.items, generated)
      : generated

  const now = nowISO()
  const list: GroceryList = {
    id: existing?.id ?? newId('gl'),
    planId: options.planId ?? existing?.planId,
    weekStart,
    items,
    categoryOrder: existing?.categoryOrder,
    generatedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await db.groceryLists.put(list)
  return list
}

async function mutate(
  weekStart: string,
  change: (items: GroceryItem[]) => GroceryItem[],
): Promise<GroceryList> {
  const list = await getOrCreateGroceryList(weekStart)
  const next: GroceryList = {
    ...list,
    items: change(list.items),
    updatedAt: nowISO(),
  }
  await db.groceryLists.put(next)
  return next
}

export async function toggleGroceryItem(
  weekStart: string,
  itemId: string,
): Promise<void> {
  await mutate(weekStart, (items) =>
    items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item,
    ),
  )
}

export async function setPantryDecision(
  weekStart: string,
  itemId: string,
  haveIt: boolean,
): Promise<void> {
  await mutate(weekStart, (items) =>
    items.map((item) =>
      item.id === itemId
        ? // "I have it" also ticks it off; there is nothing left to buy.
          { ...item, haveIt, checked: haveIt ? true : item.checked }
        : item,
    ),
  )
}

/** Adds anything at all — the list is the user's actual shopping list. */
export async function addManualGroceryItem(
  weekStart: string,
  text: string,
  category?: GroceryCategory,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const parsed = parseIngredient(trimmed)
  const key = normalizeIngredientKey(parsed.ingredientName || trimmed)

  await mutate(weekStart, (items) => {
    const existing = items.find((item) => item.key === key)
    if (existing) {
      // Already on the list from a recipe: note it rather than duplicating.
      return items.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              sources: [
                ...item.sources,
                { recipeTitle: 'Added by you', originalText: trimmed },
              ],
            }
          : item,
      )
    }

    const item: GroceryItem = {
      id: newId('gi'),
      key,
      name: capitalize(parsed.ingredientName || trimmed),
      quantities:
        parsed.quantity != null
          ? [{ amount: parsed.quantity, unit: parsed.unit }]
          : [],
      category:
        category ?? (categorizeIngredient(parsed.ingredientName || trimmed) as GroceryCategory),
      checked: false,
      manual: true,
      sources: [{ recipeTitle: 'Added by you', originalText: trimmed }],
    }
    return sortGroceryItems([...items, item])
  })
}

export async function removeGroceryItem(
  weekStart: string,
  itemId: string,
): Promise<void> {
  await mutate(weekStart, (items) => items.filter((item) => item.id !== itemId))
}

export async function clearCheckedItems(weekStart: string): Promise<void> {
  await mutate(weekStart, (items) => items.filter((item) => !item.checked))
}

export async function uncheckAll(weekStart: string): Promise<void> {
  await mutate(weekStart, (items) =>
    items.map((item) => ({ ...item, checked: false, haveIt: undefined })),
  )
}

export async function setGroceryCategoryOrder(
  weekStart: string,
  order: string[],
): Promise<void> {
  const list = await getOrCreateGroceryList(weekStart)
  await db.groceryLists.put({
    ...list,
    categoryOrder: order,
    items: sortGroceryItems(list.items, order),
    updatedAt: nowISO(),
  })
}

/** Plain-text list, for sharing into a message or a notes app. */
export function groceryListToText(list: GroceryList): string {
  const byCategory = new Map<string, GroceryItem[]>()
  for (const item of list.items) {
    if (item.checked || item.haveIt) continue
    const bucket = byCategory.get(item.category) ?? []
    bucket.push(item)
    byCategory.set(item.category, bucket)
  }

  const lines: string[] = []
  for (const [category, items] of byCategory) {
    lines.push(category)
    for (const item of items) {
      const quantity = item.quantities.map(formatQuantity).filter(Boolean).join(' + ')
      lines.push(`  - ${quantity ? `${quantity} ` : ''}${item.name}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
