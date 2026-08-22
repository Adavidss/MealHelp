import { describe, expect, it } from 'vitest'
import {
  formatCode,
  householdId,
  isPlausibleCode,
  newHouseholdCode,
  normalizeCode,
  openSnapshot,
  sealSnapshot,
} from './crypto'
import type { SyncSnapshot } from '@/models'

const snapshot: SyncSnapshot = {
  version: 1,
  tables: { recipes: [{ id: 'r1', title: 'Chili' }] },
  tombstones: [],
  writtenAt: '2026-08-22T10:00:00.000Z',
}

describe('household codes', () => {
  it('reads back as four short groups', () => {
    expect(newHouseholdCode()).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/)
  })

  it('does not use characters people confuse when reading one out', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(newHouseholdCode()).not.toMatch(/[ilo01]/)
    }
  })

  it('is generous about how it is typed back in', () => {
    expect(normalizeCode(' ABCD efgh-JKMN ')).toBe('abcdefghjkmn')
    expect(formatCode('abcdefghjkmnpqrs')).toBe('abcd-efgh-jkmn-pqrs')
    expect(isPlausibleCode('abc')).toBe(false)
  })

  it('gives two households different addresses', async () => {
    expect(await householdId('abcd-efgh')).not.toBe(await householdId('abcd-efgi'))
  })

  /** The id is what the Worker sees. It must not be the code itself. */
  it('never hands the code to the Worker', async () => {
    const id = await householdId('abcd-efgh-jkmn-pqrs')
    expect(id).toHaveLength(64)
    expect(id).not.toContain('abcd')
  })
})

describe('sealed snapshots', () => {
  it('comes back out the way it went in', async () => {
    const code = newHouseholdCode()
    const opened = await openSnapshot(code, await sealSnapshot(code, snapshot))
    expect(opened).toEqual(snapshot)
  })

  it('is unreadable to anyone who does not have the code', async () => {
    const sealed = await sealSnapshot('abcd-efgh-jkmn-pqrs', snapshot)
    expect(JSON.stringify(sealed)).not.toContain('Chili')
    await expect(openSnapshot('abcd-efgh-jkmn-pqrt', sealed)).rejects.toThrow()
  })

  it('does not care how the code was typed', async () => {
    const sealed = await sealSnapshot('abcd-efgh-jkmn-pqrs', snapshot)
    expect(await openSnapshot('ABCD EFGH JKMN PQRS', sealed)).toEqual(snapshot)
  })
})
