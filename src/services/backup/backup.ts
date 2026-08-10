import { ALL_TABLE_NAMES, db, type TableName } from '@/db/database'
import { nowISO } from '@/utils/id'

/**
 * Everything lives on the device, so an export is the only copy that survives a
 * lost phone or a cleared browser. The format is plain JSON on purpose: it can
 * be read, diffed and salvaged by hand if MealHelp itself ever fails.
 */

export const BACKUP_FORMAT = 'mealhelp-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  data: Record<TableName, unknown[]>
}

export async function createBackup(): Promise<BackupFile> {
  const data = {} as Record<TableName, unknown[]>
  for (const table of ALL_TABLE_NAMES) {
    data[table] = await db.table(table).toArray()
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowISO(),
    data,
  }
}

export function backupFilename(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10)
  return `mealhelp-backup-${stamp}.json`
}

export async function downloadBackup(): Promise<void> {
  const backup = await createBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = backupFilename()
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export interface BackupSummary {
  exportedAt?: string
  counts: Partial<Record<TableName, number>>
  total: number
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  backup?: BackupFile
  summary?: BackupSummary
}

/** Checks a file before anything is written, so a bad import cannot destroy data. */
export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = []

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ["That file isn't a MealHelp backup."] }
  }

  const candidate = raw as Partial<BackupFile>

  if (candidate.format !== BACKUP_FORMAT) {
    errors.push("That file isn't a MealHelp backup.")
  }
  if (typeof candidate.version !== 'number') {
    errors.push('The backup is missing its version number.')
  } else if (candidate.version > BACKUP_VERSION) {
    errors.push(
      'That backup was made by a newer version of MealHelp. Update the app and try again.',
    )
  }
  if (!candidate.data || typeof candidate.data !== 'object') {
    errors.push('The backup has no data in it.')
  }

  if (errors.length) return { ok: false, errors }

  const data = candidate.data as Record<string, unknown>
  const counts: Partial<Record<TableName, number>> = {}
  let total = 0

  for (const table of ALL_TABLE_NAMES) {
    const rows = data[table]
    if (rows == null) continue
    if (!Array.isArray(rows)) {
      errors.push(`The "${table}" section of the backup is damaged.`)
      continue
    }
    counts[table] = rows.length
    total += rows.length
  }

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    errors: [],
    backup: candidate as BackupFile,
    summary: { exportedAt: candidate.exportedAt, counts, total },
  }
}

export type RestoreMode = 'merge' | 'replace'

export interface RestoreResult {
  added: number
  updated: number
  mode: RestoreMode
}

/**
 * Restores a validated backup.
 *
 * `merge` keeps whatever is already here and overwrites only rows with the same
 * id. `replace` empties every table first, which is why the caller has to
 * confirm it explicitly — it is the one operation in MealHelp that can lose
 * data the user did not choose to delete.
 */
export async function restoreBackup(
  backup: BackupFile,
  mode: RestoreMode,
): Promise<RestoreResult> {
  let added = 0
  let updated = 0

  await db.transaction('rw', ALL_TABLE_NAMES.map((name) => db.table(name)), async () => {
    for (const name of ALL_TABLE_NAMES) {
      const table = db.table(name)
      const rows = (backup.data[name] ?? []) as Array<{ id?: string }>

      if (mode === 'replace') {
        await table.clear()
        if (rows.length) await table.bulkPut(rows)
        added += rows.length
        continue
      }

      for (const row of rows) {
        if (!row?.id) continue
        const existing = await table.get(row.id)
        await table.put(row)
        if (existing) updated++
        else added++
      }
    }
  })

  return { added, updated, mode }
}

export async function readBackupFile(file: File): Promise<ValidationResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return {
      ok: false,
      errors: ["That file couldn't be read as JSON. Pick a MealHelp backup file."],
    }
  }
  return validateBackup(parsed)
}

/** Wipes everything. Used only behind an explicit, typed confirmation. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', ALL_TABLE_NAMES.map((name) => db.table(name)), async () => {
    for (const name of ALL_TABLE_NAMES) {
      await db.table(name).clear()
    }
  })
}
