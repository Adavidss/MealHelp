/**
 * Sharing a kitchen between phones.
 *
 * Two people planning the same week need the same data on two devices, and
 * MealHelp has no accounts and no server of its own. What it does have is the
 * Worker in `worker/`, which anybody running the app already deploys — so a
 * household is a shared key into that Worker's store, and everything else is
 * done on the phones.
 *
 * The rules that keep it honest:
 *
 *   - Every record already carries `updatedAt`, so the newest edit wins. No
 *     clever conflict resolution, no silent merging of two versions of a
 *     recipe into one nobody wrote.
 *   - Deleting has to travel too, or a recipe one person deleted comes back
 *     the next time the other syncs. That is what tombstones are for.
 *   - A device never uploads what it has not first merged, so nothing that
 *     arrived from the other phone is thrown away by the reply.
 */

/** A record that was deleted, so the deletion can travel to the other phone. */
export interface Tombstone {
  /** `${table}:${recordId}`, which is what makes it unique across tables. */
  id: string
  table: string
  recordId: string
  deletedAt: string
}

/** Everything a household shares, as it travels. */
export interface SyncSnapshot {
  /** Bumped only if the shape changes in a way older apps cannot read. */
  version: number
  /** Table name → records, exactly as they are stored. */
  tables: Record<string, Array<Record<string, unknown>>>
  tombstones: Tombstone[]
  /** When the sending device wrote this, for the "last synced" line. */
  writtenAt: string
}

export const SYNC_VERSION = 1

/** Tables that travel between phones, in the order they are merged. */
export const SYNCED_TABLES = [
  'recipes',
  'mealPlans',
  'plannedMeals',
  'cookEvents',
  'groceryLists',
  'pantryItems',
  'collections',
  'feedback',
  'priceBook',
  'settings',
] as const

export type SyncedTable = (typeof SYNCED_TABLES)[number]

/**
 * Settings that stay on the phone they were set on.
 *
 * A shared kitchen is not a shared screen: one person liking the dark theme
 * has nothing to do with what the other sees, and a phone's own page fetcher
 * is about that phone's network, not the household's food.
 */
export const DEVICE_ONLY_SETTINGS = ['theme', 'colorScheme', 'importSettings'] as const

export interface HouseholdLink {
  /** The shared secret. Anyone with it can read and write the household. */
  code: string
  /** Where the Worker lives, so a household can move. */
  endpoint: string
  /** What this device calls itself in the "last synced by" line. */
  deviceName: string
  lastSyncedAt?: string
  /**
   * How many syncs in a row have failed. One failure is a phone in a lift and
   * worth saying nothing about; ten in a row is two people planning against
   * copies that have quietly stopped agreeing.
   */
  consecutiveFailures?: number
}
