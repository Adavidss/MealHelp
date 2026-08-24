/**
 * When the last backup was taken.
 *
 * Export and restore have both worked for months, and neither has ever been
 * mentioned unless somebody went looking for them in Settings — so the moment
 * you need a backup is the first time you think about one. Recording the date
 * costs nothing and lets the app answer "am I covered?" honestly.
 *
 * Device-local on purpose: a backup taken on one phone says nothing about
 * whether the other one is covered.
 */

const KEY = 'mealhelp.lastBackup'

/**
 * Announced rather than merely stored, because the thing that shows "no backup
 * taken" is not the thing that takes one — and a status line that still says
 * "no backup" straight after you took one is worse than no status line.
 */
export const BACKUP_EVENT = 'mealhelp:backup'

/** Long enough not to nag, short enough to matter if a phone is lost. */
export const BACKUP_STALE_DAYS = 30

export function lastBackupAt(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function recordBackup(when = new Date().toISOString()): void {
  try {
    localStorage.setItem(KEY, when)
  } catch {
    // Private mode: nothing here would survive the session anyway.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BACKUP_EVENT))
}

export function daysSinceBackup(now = Date.now()): number | undefined {
  const at = lastBackupAt()
  if (!at) return undefined
  const then = Date.parse(at)
  if (Number.isNaN(then)) return undefined
  return Math.floor((now - then) / 86_400_000)
}

/**
 * True when it is worth mentioning: either never taken, or old enough that a
 * lost phone would cost real work. Says nothing about how much has changed —
 * a month of cooking is a month of history either way.
 */
export function backupWorthMentioning(now = Date.now()): boolean {
  const days = daysSinceBackup(now)
  return days == null || days >= BACKUP_STALE_DAYS
}
