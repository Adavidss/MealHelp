import { db } from './database'
import { recordDeletion } from './deletions'
import type { GroceryCategory, PantryItem } from '@/models'
import { categorizeIngredient, normalizeIngredientKey } from '@/services/ingredientParser'
import { newId, nowISO } from '@/utils/id'

/**
 * The pantry is deliberately a list of things you usually have, not an
 * inventory. Claiming to know how much cumin is in the cupboard would be a lie,
 * and acting on that lie would leave someone at the stove without any.
 */
export async function listPantryItems(): Promise<PantryItem[]> {
  const items = await db.pantryItems.toArray()
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

export async function addPantryItem(
  name: string,
  options: { alwaysHave?: boolean; category?: GroceryCategory; note?: string } = {},
): Promise<PantryItem | undefined> {
  const trimmed = name.trim()
  if (!trimmed) return undefined

  const key = normalizeIngredientKey(trimmed)
  const existing = await db.pantryItems.where('key').equals(key).first()
  if (existing) return existing

  const now = nowISO()
  const item: PantryItem = {
    id: newId('pi'),
    name: capitalize(trimmed),
    key,
    category: options.category ?? (categorizeIngredient(trimmed) as GroceryCategory),
    alwaysHave: options.alwaysHave ?? true,
    note: options.note,
    createdAt: now,
    updatedAt: now,
  }
  await db.pantryItems.put(item)
  return item
}

export async function addPantryItems(names: string[]): Promise<number> {
  let added = 0
  for (const name of names) {
    const item = await addPantryItem(name)
    if (item) added++
  }
  return added
}

export async function updatePantryItem(
  id: string,
  patch: Partial<PantryItem>,
): Promise<void> {
  const existing = await db.pantryItems.get(id)
  if (!existing) return
  await db.pantryItems.put({ ...existing, ...patch, id, updatedAt: nowISO() })
}

export async function togglePantryStaple(id: string): Promise<void> {
  const existing = await db.pantryItems.get(id)
  if (!existing) return
  await updatePantryItem(id, { alwaysHave: !existing.alwaysHave })
}

export async function deletePantryItem(id: string): Promise<void> {
  await db.pantryItems.delete(id)
  await recordDeletion('pantryItems', id)
}

export async function pantryKeySet(): Promise<Set<string>> {
  const items = await db.pantryItems.toArray()
  return new Set(items.filter((item) => item.alwaysHave).map((item) => item.key))
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
