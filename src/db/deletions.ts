import { db } from './database'
import type { Tombstone } from '@/models'
import { nowISO } from '@/utils/id'

/**
 * Remembering what was deleted.
 *
 * A household syncs by merging what both phones hold, which means an empty
 * space says nothing: the other phone cannot tell "I never had that recipe"
 * from "I deleted it". A tombstone is the difference.
 *
 * They are small and few, and pruning them would risk resurrecting a record
 * from a phone that had not synced for a while, so they are kept.
 */
export async function recordDeletion(table: string, recordId: string): Promise<void> {
  const tombstone: Tombstone = {
    id: `${table}:${recordId}`,
    table,
    recordId,
    deletedAt: nowISO(),
  }
  await db.deletions.put(tombstone)
}

export async function recordDeletions(table: string, recordIds: string[]): Promise<void> {
  if (!recordIds.length) return
  const now = nowISO()
  await db.deletions.bulkPut(
    recordIds.map((recordId) => ({ id: `${table}:${recordId}`, table, recordId, deletedAt: now })),
  )
}

export async function listTombstones(): Promise<Tombstone[]> {
  return db.deletions.toArray()
}

/**
 * A record that comes back from the other phone after being deleted here has
 * been deliberately restored, so its tombstone has to go — otherwise the next
 * sync would delete it again.
 */
export async function forgetDeletion(table: string, recordId: string): Promise<void> {
  await db.deletions.delete(`${table}:${recordId}`)
}
