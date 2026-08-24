import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backupWorthMentioning, daysSinceBackup, lastBackupAt, recordBackup } from './backupRecord'

/** The test environment's localStorage is not a real Storage; this one is. */
function memoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  }
}

const NOW = Date.parse('2026-08-24T12:00:00.000Z')

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('knowing whether there is a backup', () => {
  it('remembers when one was taken', () => {
    recordBackup('2026-08-20T09:00:00.000Z')
    expect(lastBackupAt()).toBe('2026-08-20T09:00:00.000Z')
    expect(daysSinceBackup(NOW)).toBe(4)
  })

  /** Never having taken one is the case worth mentioning most. */
  it('counts never as worth mentioning', () => {
    expect(daysSinceBackup(NOW)).toBeUndefined()
    expect(backupWorthMentioning(NOW)).toBe(true)
  })

  it('stays quiet about a recent one', () => {
    recordBackup('2026-08-22T09:00:00.000Z')
    expect(backupWorthMentioning(NOW)).toBe(false)
  })

  it('speaks up once a month has gone by', () => {
    recordBackup('2026-07-01T09:00:00.000Z')
    expect(backupWorthMentioning(NOW)).toBe(true)
  })

  it('is not upset by a value it cannot read', () => {
    recordBackup('not a date')
    expect(daysSinceBackup(NOW)).toBeUndefined()
  })
})
