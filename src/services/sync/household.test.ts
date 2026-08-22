import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { deleteRecipe } from '@/db/recipes'
import { openSnapshot, sealSnapshot, type SealedSnapshot } from './crypto'
import { joinHousehold, clearHousehold, householdInviteLink, inviteCodeFromHash, syncNow } from './household'
import type { SyncSnapshot } from '@/models'
import { makeRecipe } from '@/test/factories'

const CODE = 'abcd-efgh-jkmn-pqrs'

/**
 * The Worker, in twenty lines: one sealed blob, kept under whatever id the
 * client asks for. Standing it up in the test is what makes it possible to
 * check the thing that actually matters — that two phones end up agreeing.
 */
let shelf: Map<string, { sealed: SealedSnapshot; writtenAt: string }>

function fakeWorker() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const id = url.pathname.split('/').pop() as string

    if (!init || (init.method ?? 'GET') === 'GET') {
      const stored = shelf.get(id)
      return new Response(stored ? JSON.stringify(stored) : '{}', { status: stored ? 200 : 404 })
    }

    const guard = url.searchParams.get('ifWrittenAt')
    if (guard && shelf.get(id)?.writtenAt !== guard) {
      return new Response('{}', { status: 409 })
    }
    const writtenAt = new Date().toISOString()
    shelf.set(id, { sealed: JSON.parse(String(init.body)) as SealedSnapshot, writtenAt })
    return new Response(JSON.stringify({ writtenAt }), { status: 200 })
  })
}

/** What the other phone would see, decrypted the way it would decrypt it. */
async function whatTheHouseholdHolds(): Promise<SyncSnapshot> {
  const stored = [...shelf.values()][0]
  return openSnapshot(CODE, stored.sealed)
}

/** Pretends the other phone pushed this. */
async function otherPhonePushes(snapshot: SyncSnapshot): Promise<void> {
  const [id] = [...shelf.keys()]
  shelf.set(id, { sealed: await sealSnapshot(CODE, snapshot), writtenAt: new Date().toISOString() })
}

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

beforeEach(() => {
  shelf = new Map()
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('fetch', fakeWorker())
  clearHousehold()
  joinHousehold(CODE, 'Test phone')
})

afterEach(async () => {
  clearHousehold()
  vi.unstubAllGlobals()
  await db.recipes.clear()
  await db.deletions.clear()
})

describe('syncNow', () => {
  it('does nothing at all without a household', async () => {
    clearHousehold()
    expect((await syncNow()).status).toBe('no-link')
  })

  it("puts this phone's kitchen into the household, sealed", async () => {
    await db.recipes.put(makeRecipe({ id: 'r1', title: 'Weeknight chili' }))

    expect((await syncNow()).status).toBe('ok')

    // The Worker holds bytes; only the code turns them back into dinner.
    expect(JSON.stringify([...shelf.values()])).not.toContain('chili')
    const held = await whatTheHouseholdHolds()
    expect(held.tables.recipes).toHaveLength(1)
  })

  it('brings across what the other phone added', async () => {
    await syncNow()
    const held = await whatTheHouseholdHolds()
    held.tables.recipes = [makeRecipe({ id: 'theirs', title: 'Their soup' }) as unknown as Record<string, unknown>]
    await otherPhonePushes(held)

    const outcome = await syncNow()

    expect(outcome.written).toBe(1)
    expect((await db.recipes.get('theirs'))?.title).toBe('Their soup')
  })

  it('carries a deletion across instead of resurrecting the recipe', async () => {
    await db.recipes.put(makeRecipe({ id: 'r1', title: 'Chili' }))
    await syncNow()

    // The other phone deletes it and pushes the deletion.
    const held = await whatTheHouseholdHolds()
    held.tables.recipes = []
    held.tombstones = [
      { id: 'recipes:r1', table: 'recipes', recordId: 'r1', deletedAt: new Date().toISOString() },
    ]
    await otherPhonePushes(held)

    const outcome = await syncNow()

    expect(outcome.deleted).toBe(1)
    expect(await db.recipes.get('r1')).toBeUndefined()
    // And it stays gone on the next sync, rather than coming back round.
    await syncNow()
    expect(await db.recipes.get('r1')).toBeUndefined()
  })

  it('tells the household about a recipe deleted here', async () => {
    await db.recipes.put(makeRecipe({ id: 'r1', title: 'Chili' }))
    await syncNow()
    await deleteRecipe('r1')
    await syncNow()

    const held = await whatTheHouseholdHolds()
    expect(held.tables.recipes).toHaveLength(0)
    expect(held.tombstones.map((stone) => stone.recordId)).toContain('r1')
  })

  it('does not rewrite the household when nothing has changed', async () => {
    await db.recipes.put(makeRecipe({ id: 'r1' }))
    await syncNow()
    const first = [...shelf.values()][0].writtenAt

    await syncNow()

    expect([...shelf.values()][0].writtenAt).toBe(first)
  })

  it('says so plainly when the code does not open the data', async () => {
    await syncNow()
    clearHousehold()
    joinHousehold('zzzz-zzzz-zzzz-zzzz', 'Wrong phone')
    // A wrong code is a different household, so point it at the same blob.
    const sealed = [...shelf.values()][0]
    shelf.clear()
    const { householdId } = await import('./crypto')
    shelf.set(await householdId('zzzz-zzzz-zzzz-zzzz'), sealed)

    const outcome = await syncNow()

    expect(outcome.status).toBe('error')
    expect(outcome.message).toMatch(/code/i)
  })

  it('reports a phone with no connection as offline, not broken', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Failed to fetch') }))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const outcome = await syncNow()

    expect(outcome.status).toBe('offline')
  })
})

describe('invite links', () => {
  it('keeps the code in the fragment, where no web server sees it', () => {
    const url = householdInviteLink({ code: 'abcdefghjkmnpqrs', endpoint: '', deviceName: 'iPhone' })
    expect(url).toContain('#/settings?join=abcdefghjkmnpqrs')
    expect(url.split('#')[0]).not.toContain('abcdefgh')
  })

  it('reads a code back out of one', () => {
    expect(inviteCodeFromHash('#/settings?join=abcd-efgh-jkmn-pqrs')).toBe('abcdefghjkmnpqrs')
    expect(inviteCodeFromHash('#/settings')).toBeUndefined()
    expect(inviteCodeFromHash('#/settings?join=abc')).toBeUndefined()
  })
})

describe('records from an older phone', () => {
  /**
   * The library search does `recipe.equipment.join(' ')`. One recipe written
   * by a phone that predates that field would otherwise take down the whole
   * screen — on the other person's device, for reasons they cannot see.
   */
  it('fills in lists the other phone did not have, rather than dropping the recipe', async () => {
    await syncNow()
    const held = await whatTheHouseholdHolds()
    held.tables.recipes = [
      { id: 'old', title: 'From an older phone', servings: 4, updatedAt: new Date().toISOString() },
    ]
    await otherPhonePushes(held)

    await syncNow()

    const stored = await db.recipes.get('old')
    expect(stored?.title).toBe('From an older phone')
    expect(stored?.equipment).toEqual([])
    expect(stored?.ingredients).toEqual([])
    expect(stored?.mealTypes).toEqual([])
  })
})
