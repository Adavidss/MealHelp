import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_VERSION, validateBackup } from './backup'

function backup(overrides: Record<string, unknown> = {}) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-08-10T12:00:00.000Z',
    data: {
      recipes: [{ id: 'rec_1', title: 'Chili' }],
      settings: [{ id: 'settings' }],
    },
    ...overrides,
  }
}

describe('validateBackup', () => {
  it('accepts a backup and counts what is in it', () => {
    const result = validateBackup(backup())
    expect(result.ok).toBe(true)
    expect(result.summary?.total).toBe(2)
    expect(result.summary?.counts.recipes).toBe(1)
  })

  it('rejects a file that is not a backup at all', () => {
    expect(validateBackup({ hello: 'world' }).ok).toBe(false)
    expect(validateBackup(null).ok).toBe(false)
    expect(validateBackup('nope').ok).toBe(false)
  })

  it('refuses a backup from a newer version rather than importing it badly', () => {
    const result = validateBackup(backup({ version: BACKUP_VERSION + 1 }))
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/newer version/i)
  })

  it('reports a damaged section instead of importing half of it', () => {
    const result = validateBackup(backup({ data: { recipes: 'not an array' } }))
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/damaged/i)
  })

  it('tolerates a backup that predates a table', () => {
    const result = validateBackup(backup({ data: { recipes: [] } }))
    expect(result.ok).toBe(true)
    expect(result.summary?.counts.collections).toBeUndefined()
  })
})
