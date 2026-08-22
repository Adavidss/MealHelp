import { db } from './database'
import { recordDeletion } from './deletions'
import type { Collection } from '@/models'
import { newId, nowISO } from '@/utils/id'

/** Collections overlap freely — a recipe can be both "Freezer" and "Cheap". */
export async function listCollections(): Promise<Collection[]> {
  const collections = await db.collections.toArray()
  return collections.sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCollection(
  name: string,
  options: { description?: string; emoji?: string; recipeIds?: string[] } = {},
): Promise<Collection> {
  const now = nowISO()
  const collection: Collection = {
    id: newId('col'),
    name: name.trim() || 'Untitled collection',
    description: options.description,
    emoji: options.emoji,
    recipeIds: options.recipeIds ?? [],
    createdAt: now,
    updatedAt: now,
  }
  await db.collections.put(collection)
  return collection
}

export async function updateCollection(
  id: string,
  patch: Partial<Collection>,
): Promise<void> {
  const existing = await db.collections.get(id)
  if (!existing) return
  await db.collections.put({ ...existing, ...patch, id, updatedAt: nowISO() })
}

export async function deleteCollection(id: string): Promise<void> {
  await db.collections.delete(id)
  await recordDeletion('collections', id)
}

export async function toggleRecipeInCollection(
  collectionId: string,
  recipeId: string,
): Promise<void> {
  const collection = await db.collections.get(collectionId)
  if (!collection) return
  const present = collection.recipeIds.includes(recipeId)
  await updateCollection(collectionId, {
    recipeIds: present
      ? collection.recipeIds.filter((id) => id !== recipeId)
      : [...collection.recipeIds, recipeId],
  })
}

/** Removes a deleted recipe from every collection that referenced it. */
export async function pruneRecipeFromCollections(recipeId: string): Promise<void> {
  const collections = await db.collections.toArray()
  const affected = collections.filter((c) => c.recipeIds.includes(recipeId))
  if (!affected.length) return
  await db.collections.bulkPut(
    affected.map((collection) => ({
      ...collection,
      recipeIds: collection.recipeIds.filter((id) => id !== recipeId),
      updatedAt: nowISO(),
    })),
  )
}
