/**
 * Asking the browser to keep the kitchen.
 *
 * Everything MealHelp has is in IndexedDB on one device, which browsers treat
 * as disposable: Safari clears the data of a site you have not visited for
 * about a week, and Chrome clears it under storage pressure. A library of
 * imported recipes, a planned month and a price book all go together, with no
 * warning and no way back.
 *
 * `navigator.storage.persist()` says "this is not a cache". Installed apps are
 * usually granted it without a prompt; a browser tab may be refused, which is
 * a fair answer to give a site somebody has visited once — so this asks at the
 * moment there is finally something worth keeping, and never nags.
 */

const ASKED_KEY = 'mealhelp.persistenceAsked'

export interface StorageStatus {
  /** Undefined when the browser does not implement the API at all. */
  persisted?: boolean
  /** Bytes in use, where the browser will say. */
  usage?: number
  quota?: number
}

export async function storageStatus(): Promise<StorageStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage) return {}
  const persisted = await navigator.storage.persisted?.().catch(() => undefined)
  const estimate = await navigator.storage.estimate?.().catch(() => undefined)
  return { persisted, usage: estimate?.usage, quota: estimate?.quota }
}

/**
 * Returns what the browser decided, or undefined if it has no opinion to give.
 * Safe to call more than once — a browser that already granted it says yes
 * immediately, without a prompt.
 */
export async function requestPersistence(): Promise<boolean | undefined> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return undefined
  try {
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return undefined
  }
}

/** Whether this device has been asked before, so it is only ever asked once. */
export function persistenceAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberPersistenceAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, '1')
  } catch {
    // Private mode, where none of this is being kept anyway.
  }
}
