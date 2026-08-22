import type { SyncSnapshot, Tombstone } from '@/models'
import { DEVICE_ONLY_SETTINGS, SYNCED_TABLES, SYNC_VERSION } from '@/models'

/**
 * Merging two phones' worth of a kitchen.
 *
 * Deliberately the dullest rule that works: the newest edit of a record wins,
 * a deletion beats anything older than it, and nothing is ever merged
 * field-by-field. Two people editing the same recipe in the same minute is
 * rare; a clever merge producing a recipe neither of them wrote is worse than
 * one of them having to redo an edit.
 *
 * Pure, so the whole thing can be tested without a network or a database.
 */

export interface Record_ {
  id?: string
  key?: string
  updatedAt?: string
  [field: string]: unknown
}

/** The id a record is stored under: most use `id`, the price book uses `key`. */
export function recordId(record: Record_): string | undefined {
  return (record.id as string) ?? (record.key as string)
}

function newer(a: Record_ | undefined, b: Record_ | undefined): Record_ | undefined {
  if (!a) return b
  if (!b) return a
  const left = (a.updatedAt as string) ?? ''
  const right = (b.updatedAt as string) ?? ''
  return right > left ? b : a
}

/**
 * Settings are one row, so "newest wins" would drag the other phone's theme
 * across with the household's meal slots. The shared half wins by date; the
 * personal half never leaves the device.
 */
export function mergeSettings(local: Record_ | undefined, remote: Record_ | undefined): Record_ | undefined {
  const winner = newer(local, remote)
  if (!winner) return undefined
  if (!local) {
    // Nothing local to protect, but do not import somebody else's theme.
    const fresh = { ...winner }
    for (const field of DEVICE_ONLY_SETTINGS) delete fresh[field]
    return fresh
  }
  // Unchanged is worth saying out loud: returning the same object is how the
  // merge reports "nothing to write", so an unchanged settings row does not
  // count as a change on every sync.
  if (winner === local) return local
  const merged = { ...winner }
  for (const field of DEVICE_ONLY_SETTINGS) {
    if (field in local) merged[field] = local[field]
    else delete merged[field]
  }
  return merged
}

export interface MergeResult {
  /** What each table should contain after merging. */
  tables: Record<string, Record_[]>
  /** Every tombstone either side knows about, deduplicated. */
  tombstones: Tombstone[]
  /** Ids to delete locally, by table, because the other phone deleted them. */
  deletions: Record<string, string[]>
  /** Records to write locally, by table. */
  writes: Record<string, Record_[]>
}

/**
 * One table's worth of merging.
 *
 * A tombstone removes a record unless the record has been edited *since* it
 * was deleted — which is how "I deleted it" and "no, I changed it, keep it"
 * are told apart without asking anybody.
 */
function mergeTable(
  local: Record_[],
  remote: Record_[],
  tombstones: Map<string, Tombstone>,
  table: string,
): { merged: Record_[]; writes: Record_[]; deletions: string[] } {
  const byId = new Map<string, Record_>()
  for (const record of local) {
    const id = recordId(record)
    if (id) byId.set(id, record)
  }

  const writes: Record_[] = []
  for (const record of remote) {
    const id = recordId(record)
    if (!id) continue
    const mine = byId.get(id)
    const winner = table === 'settings' ? mergeSettings(mine, record) : newer(mine, record)
    if (!winner) continue
    byId.set(id, winner)
    // Only worth writing if the remote copy is the one that won.
    if (winner !== mine) writes.push(winner)
  }

  const deletions: string[] = []
  for (const [id, record] of [...byId.entries()]) {
    const tombstone = tombstones.get(`${table}:${id}`)
    if (!tombstone) continue
    const updatedAt = (record.updatedAt as string) ?? ''
    // Edited after it was deleted: the edit is the later word.
    if (updatedAt > tombstone.deletedAt) continue
    byId.delete(id)
    deletions.push(id)
  }

  return { merged: [...byId.values()], writes, deletions }
}

export interface MergeInput {
  local: Record<string, Record_[]>
  localTombstones: Tombstone[]
  remote?: SyncSnapshot
}

export function mergeSnapshots({ local, localTombstones, remote }: MergeInput): MergeResult {
  const tombstones = new Map<string, Tombstone>()
  for (const stone of [...(remote?.tombstones ?? []), ...localTombstones]) {
    const existing = tombstones.get(stone.id)
    // The later deletion wins, so a record deleted, restored and deleted again
    // does not come back.
    if (!existing || stone.deletedAt > existing.deletedAt) tombstones.set(stone.id, stone)
  }

  const tables: Record<string, Record_[]> = {}
  const writes: Record<string, Record_[]> = {}
  const deletions: Record<string, string[]> = {}

  for (const table of SYNCED_TABLES) {
    const result = mergeTable(
      local[table] ?? [],
      remote?.tables?.[table] ?? [],
      tombstones,
      table,
    )
    tables[table] = result.merged
    if (result.writes.length) writes[table] = result.writes
    if (result.deletions.length) deletions[table] = result.deletions
  }

  return { tables, tombstones: [...tombstones.values()], deletions, writes }
}

/** What this device will upload, once it has merged what the other one sent. */
export function toSnapshot(result: MergeResult, writtenAt: string): SyncSnapshot {
  const tables: Record<string, Array<Record<string, unknown>>> = {}
  for (const [table, records] of Object.entries(result.tables)) {
    // The personal half of settings never leaves the phone it was set on.
    tables[table] =
      table === 'settings'
        ? records.map((record) => {
            const shared = { ...record }
            for (const field of DEVICE_ONLY_SETTINGS) delete shared[field]
            return shared
          })
        : records
  }
  return { version: SYNC_VERSION, tables, tombstones: result.tombstones, writtenAt }
}
