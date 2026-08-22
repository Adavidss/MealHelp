import { describe, expect, it } from 'vitest'
import { mergeSettings, mergeSnapshots, toSnapshot } from './merge'
import type { SyncSnapshot } from '@/models'

const EARLY = '2026-08-01T10:00:00.000Z'
const LATE = '2026-08-02T10:00:00.000Z'

function snapshot(tables: Record<string, unknown[]>, tombstones: unknown[] = []): SyncSnapshot {
  return {
    version: 1,
    tables: tables as SyncSnapshot['tables'],
    tombstones: tombstones as SyncSnapshot['tombstones'],
    writtenAt: LATE,
  }
}

describe('mergeSnapshots', () => {
  it('keeps the newest edit of a record, whichever phone made it', () => {
    const result = mergeSnapshots({
      local: { recipes: [{ id: 'r1', title: 'Chili', updatedAt: EARLY }] },
      localTombstones: [],
      remote: snapshot({ recipes: [{ id: 'r1', title: 'Chili, improved', updatedAt: LATE }] }),
    })

    expect(result.tables.recipes[0].title).toBe('Chili, improved')
    // And the local database is told to write it.
    expect(result.writes.recipes).toHaveLength(1)
  })

  it('leaves a local edit alone when it is the newer one', () => {
    const result = mergeSnapshots({
      local: { recipes: [{ id: 'r1', title: 'Mine', updatedAt: LATE }] },
      localTombstones: [],
      remote: snapshot({ recipes: [{ id: 'r1', title: 'Theirs', updatedAt: EARLY }] }),
    })

    expect(result.tables.recipes[0].title).toBe('Mine')
    // Nothing to write: the local copy already won.
    expect(result.writes.recipes).toBeUndefined()
  })

  it('brings across records the other phone has and this one does not', () => {
    const result = mergeSnapshots({
      local: { recipes: [] },
      localTombstones: [],
      remote: snapshot({ recipes: [{ id: 'new', title: 'Theirs', updatedAt: LATE }] }),
    })
    expect(result.tables.recipes).toHaveLength(1)
    expect(result.writes.recipes).toHaveLength(1)
  })

  /**
   * Without this a recipe one person deletes reappears the next time the other
   * syncs, for ever — the classic sync bug that makes people stop trusting it.
   */
  it('carries a deletion across, rather than letting the record come back', () => {
    const result = mergeSnapshots({
      local: { recipes: [{ id: 'r1', title: 'Chili', updatedAt: EARLY }] },
      localTombstones: [],
      remote: snapshot({ recipes: [] }, [
        { id: 'recipes:r1', table: 'recipes', recordId: 'r1', deletedAt: LATE },
      ]),
    })

    expect(result.tables.recipes).toHaveLength(0)
    expect(result.deletions.recipes).toEqual(['r1'])
  })

  /** "I deleted it" and "no, I changed it" are told apart by the clock. */
  it('keeps a record that was edited after it was deleted elsewhere', () => {
    const result = mergeSnapshots({
      local: { recipes: [{ id: 'r1', title: 'Rescued', updatedAt: LATE }] },
      localTombstones: [],
      remote: snapshot({ recipes: [] }, [
        { id: 'recipes:r1', table: 'recipes', recordId: 'r1', deletedAt: EARLY },
      ]),
    })

    expect(result.tables.recipes).toHaveLength(1)
    expect(result.deletions.recipes).toBeUndefined()
  })

  it("never loses the other phone's tombstones when it uploads", () => {
    const result = mergeSnapshots({
      local: { recipes: [] },
      localTombstones: [{ id: 'recipes:mine', table: 'recipes', recordId: 'mine', deletedAt: EARLY }],
      remote: snapshot({}, [
        { id: 'recipes:theirs', table: 'recipes', recordId: 'theirs', deletedAt: LATE },
      ]),
    })

    const uploaded = toSnapshot(result, LATE)
    expect(uploaded.tombstones.map((stone) => stone.id).sort()).toEqual([
      'recipes:mine',
      'recipes:theirs',
    ])
  })

  it('survives a household that has never been synced to', () => {
    const result = mergeSnapshots({
      local: { recipes: [{ id: 'r1', updatedAt: EARLY }] },
      localTombstones: [],
      remote: undefined,
    })
    expect(result.tables.recipes).toHaveLength(1)
    expect(result.writes).toEqual({})
  })
})

describe('settings', () => {
  /** A shared kitchen is not a shared screen. */
  it('shares the kitchen but leaves the theme on the phone it was set on', () => {
    const merged = mergeSettings(
      { id: 'settings', theme: 'midnight', defaultServings: 2, updatedAt: EARLY },
      { id: 'settings', theme: 'citrus', defaultServings: 6, updatedAt: LATE },
    )

    expect(merged?.defaultServings).toBe(6)
    expect(merged?.theme).toBe('midnight')
  })

  it('does not import a theme onto a phone that had none', () => {
    const merged = mergeSettings(undefined, {
      id: 'settings',
      theme: 'citrus',
      defaultServings: 6,
      updatedAt: LATE,
    })
    expect(merged?.defaultServings).toBe(6)
    expect(merged?.theme).toBeUndefined()
  })

  it('never uploads the personal half', () => {
    const result = mergeSnapshots({
      local: { settings: [{ id: 'settings', theme: 'midnight', weekStartsOn: 0, updatedAt: LATE }] },
      localTombstones: [],
    })
    const uploaded = toSnapshot(result, LATE)
    expect(uploaded.tables.settings[0]).not.toHaveProperty('theme')
    expect(uploaded.tables.settings[0]).toHaveProperty('weekStartsOn', 0)
  })
})

describe('quiet syncs', () => {
  /**
   * Two phones that agree should stay quiet. Reporting "1 change" every time
   * the app opens would make the count meaningless on the day it matters.
   */
  it('reports nothing to write when both sides already match', () => {
    const settings = { id: 'settings', theme: 'midnight', defaultServings: 4, updatedAt: LATE }
    const result = mergeSnapshots({
      local: { settings: [settings] },
      localTombstones: [],
      remote: snapshot({ settings: [{ id: 'settings', defaultServings: 4, updatedAt: LATE }] }),
    })
    expect(result.writes).toEqual({})
  })
})
