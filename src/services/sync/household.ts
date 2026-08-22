import { db } from '@/db/database'
import { listTombstones } from '@/db/deletions'
import type { HouseholdLink, SyncSnapshot, Tombstone } from '@/models'
import { SYNCED_TABLES } from '@/models'
import { nowISO } from '@/utils/id'
import { householdId, isPlausibleCode, newHouseholdCode, normalizeCode, openSnapshot, sealSnapshot, type SealedSnapshot } from './crypto'
import { mergeSnapshots, toSnapshot, type Record_ } from './merge'
import { repairIncoming } from './shape'

/**
 * Linking two phones.
 *
 * The Worker is a shelf, not a service: it holds one sealed blob per household
 * and knows nothing about what is in it. All the thinking — merging, deciding
 * what wins — happens here, on the phone, against the local database.
 *
 * One sync is always pull → merge → push, in that order, so a device never
 * overwrites something it has not already taken account of.
 */

const STORAGE_KEY = 'mealhelp.household'
export const DEFAULT_SYNC_ENDPOINT = 'https://mealhelp-fetch.kidsdc.workers.dev'

/** Never so long that a shopping trip stalls behind it. */
const TIMEOUT_MS = 20_000

export function loadHousehold(): HouseholdLink | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const link = JSON.parse(raw) as HouseholdLink
    return link.code ? link : undefined
  } catch {
    return undefined
  }
}

/**
 * The link is kept in localStorage rather than in settings, because settings
 * are one of the things that sync — a household would otherwise be able to
 * drag another phone into itself.
 */
export function saveHousehold(link: HouseholdLink): HouseholdLink {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(link))
  return link
}

export function clearHousehold(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function defaultDeviceName(): string {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/iPhone/.test(agent)) return 'iPhone'
  if (/iPad/.test(agent)) return 'iPad'
  if (/Android/.test(agent)) return 'Android phone'
  if (/Mac/.test(agent)) return 'Mac'
  if (/Windows/.test(agent)) return 'PC'
  return 'This device'
}

export function createHousehold(deviceName = defaultDeviceName()): HouseholdLink {
  return saveHousehold({ code: newHouseholdCode(), endpoint: DEFAULT_SYNC_ENDPOINT, deviceName })
}

export function joinHousehold(code: string, deviceName = defaultDeviceName()): HouseholdLink {
  if (!isPlausibleCode(code)) throw new Error('That code is too short to be a household code')
  const existing = loadHousehold()
  return saveHousehold({
    code: normalizeCode(code),
    endpoint: existing?.endpoint ?? DEFAULT_SYNC_ENDPOINT,
    deviceName,
  })
}

/**
 * A link that joins the household when opened, with the code in the fragment
 * so it is never sent to a web server — not even the one hosting MealHelp.
 */
export function householdInviteLink(link: HouseholdLink): string {
  const base = typeof window === 'undefined' ? 'https://kidsdc.org/MealHelp/' : `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base}#/settings?join=${normalizeCode(link.code)}`
}

/** The code out of an invite link, if this page was opened from one. */
export function inviteCodeFromHash(hash: string): string | undefined {
  const query = hash.split('?')[1]
  if (!query) return undefined
  const code = new URLSearchParams(query).get('join')
  return code && isPlausibleCode(code) ? normalizeCode(code) : undefined
}

function syncUrl(link: HouseholdLink, id: string): string {
  const endpoint = (link.endpoint || DEFAULT_SYNC_ENDPOINT).replace(/\/+$/, '')
  return `${endpoint}/household/${id}`
}

interface Stored {
  sealed: SealedSnapshot
  writtenAt: string
}

/**
 * An older Worker, or one deployed without a household store, answers the
 * sync path with a flat refusal. Saying which is far more use than the number.
 */
const NOT_SET_UP =
  'This MealHelp Worker cannot store households yet. Deploy the latest worker/ and add its HOUSEHOLDS namespace — worker/README.md has the two commands.'

function serverError(status: number): Error {
  if (status === 501 || status === 400 || status === 405) return new Error(NOT_SET_UP)
  return new Error(`The sync server said ${status}`)
}

async function pull(link: HouseholdLink, id: string): Promise<Stored | undefined> {
  const response = await fetch(syncUrl(link, id), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  // Nobody has pushed to this household yet; that is a normal first sync.
  if (response.status === 404) return undefined
  if (!response.ok) throw serverError(response.status)
  return (await response.json()) as Stored
}

async function push(
  link: HouseholdLink,
  id: string,
  sealed: SealedSnapshot,
  ifWrittenAt?: string,
): Promise<{ conflict: boolean }> {
  const url = new URL(syncUrl(link, id))
  // Guards against the other phone having pushed while this one was merging.
  if (ifWrittenAt) url.searchParams.set('ifWrittenAt', ifWrittenAt)
  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sealed),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (response.status === 409) return { conflict: true }
  if (!response.ok) throw serverError(response.status)
  return { conflict: false }
}

async function readLocalTables(): Promise<Record<string, Record_[]>> {
  const tables: Record<string, Record_[]> = {}
  for (const table of SYNCED_TABLES) {
    tables[table] = (await db.table(table).toArray()) as Record_[]
  }
  return tables
}

/**
 * Writes the merged result back.
 *
 * Deletions are applied straight to the tables rather than through
 * `recordDeletion`, because the tombstone already exists — restamping it with
 * this moment would push its `deletedAt` past edits that ought to beat it.
 */
async function applyLocally(
  writes: Record<string, Record_[]>,
  deletions: Record<string, string[]>,
  tombstones: Tombstone[],
): Promise<{ written: number; deleted: number }> {
  let written = 0
  let deleted = 0
  for (const table of SYNCED_TABLES) {
    const rows = writes[table] ?? []
    const gone = deletions[table] ?? []
    if (rows.length) {
      await db.table(table).bulkPut(rows.map((row) => repairIncoming(table, row)))
      written += rows.length
    }
    if (gone.length) {
      await db.table(table).bulkDelete(gone)
      deleted += gone.length
    }
  }
  if (tombstones.length) await db.deletions.bulkPut(tombstones)
  return { written, deleted }
}

/**
 * A cheap way to ask "has anything actually changed?".
 *
 * Every record carries `updatedAt`, so the set of ids and their timestamps is
 * enough to tell two snapshots apart. Sorting makes it independent of the
 * order the tables came back in. Worth the few lines: without it two phones
 * left open would rewrite the household on every glance.
 */
function fingerprint(snapshot: SyncSnapshot): string {
  const parts: string[] = []
  for (const table of SYNCED_TABLES) {
    const rows = (snapshot.tables[table] ?? [])
      .map((row) => `${(row as Record_).id ?? (row as Record_).key}@${(row as Record_).updatedAt ?? ''}`)
      .sort()
    parts.push(`${table}:${rows.join(',')}`)
  }
  const stones = snapshot.tombstones.map((stone) => `${stone.id}@${stone.deletedAt}`).sort()
  return `${parts.join('|')}|tombstones:${stones.join(',')}`
}

export type SyncStatus = 'ok' | 'no-link' | 'offline' | 'error'

export interface SyncOutcome {
  status: SyncStatus
  /** Records this phone took from the household. */
  written: number
  /** Records this phone dropped because the other one deleted them. */
  deleted: number
  at?: string
  message?: string
}

/**
 * Pull, merge, push — the whole of a sync.
 *
 * A conflict means the other phone pushed while this one was merging, so the
 * answer is simply to do it again with what they wrote. Once is enough: two
 * phones do not race for ever, and a sync that never gives up is a sync that
 * hangs on the shopping list.
 */
export async function syncNow(): Promise<SyncOutcome> {
  const link = loadHousehold()
  if (!link) return { status: 'no-link', written: 0, deleted: 0 }

  const id = await householdId(link.code)

  try {
    let attempt = 0
    for (;;) {
      const stored = await pull(link, id)
      let remote: SyncSnapshot | undefined
      if (stored) {
        try {
          remote = await openSnapshot(link.code, stored.sealed)
        } catch {
          return {
            status: 'error',
            written: 0,
            deleted: 0,
            message: 'That household code does not open this data. Check the code on the other phone.',
          }
        }
      }

      const result = mergeSnapshots({
        local: await readLocalTables(),
        localTombstones: await listTombstones(),
        remote,
      })

      const at = nowISO()
      const outgoing = toSnapshot(result, at)

      // Nothing to say: this phone agrees with what is already up there.
      if (remote && fingerprint(outgoing) === fingerprint(remote)) {
        const applied = await applyLocally(result.writes, result.deletions, result.tombstones)
        saveHousehold({ ...link, lastSyncedAt: at })
        return { status: 'ok', written: applied.written, deleted: applied.deleted, at }
      }

      const sealed = await sealSnapshot(link.code, outgoing)
      const { conflict } = await push(link, id, sealed, stored?.writtenAt)

      if (conflict && attempt < 1) {
        attempt += 1
        continue
      }

      const applied = await applyLocally(result.writes, result.deletions, result.tombstones)
      saveHousehold({ ...link, lastSyncedAt: at })
      return { status: 'ok', written: applied.written, deleted: applied.deleted, at }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return {
      status: offline ? 'offline' : 'error',
      written: 0,
      deleted: 0,
      message: offline ? 'No connection. This will sync when you are back online.' : message,
    }
  }
}
