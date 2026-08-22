import { describe, expect, it } from 'vitest'
import { SURPRISE_MEMORY, pickSurprise, rememberPick } from './surprise'

const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))

describe('pickSurprise', () => {
  it('has nothing to offer from an empty library', () => {
    expect(pickSurprise([])).toBeUndefined()
  })

  it('offers the only recipe there is, however often it is asked', () => {
    expect(pickSurprise([{ id: 'only' }], ['only'])?.id).toBe('only')
  })

  /**
   * The whole point of the button: pressing it twice must not show the same
   * meal twice. On a library of a dozen, true randomness does that far too
   * often to read as anything but broken.
   */
  it('never offers back something picked recently', () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const picked = pickSurprise(items, ['a', 'b'])
      expect(['a', 'b']).not.toContain(picked?.id)
    }
  })

  it('starts over rather than giving up when everything has been seen', () => {
    const everything = items.map((item) => item.id)
    const picked = pickSurprise(items, everything)
    expect(picked).toBeDefined()
    // Still not the one just shown, which is the repeat anyone would notice.
    expect(picked?.id).not.toBe(everything[everything.length - 1])
  })

  it('can reach every recipe, not just the first few', () => {
    const seen = new Set<string>()
    for (let attempt = 0; attempt < 200; attempt++) {
      seen.add(pickSurprise(items)!.id)
    }
    expect(seen.size).toBe(items.length)
  })

  it('picks from the pool it was given, using the randomness it was given', () => {
    expect(pickSurprise(items, [], () => 0)?.id).toBe('a')
    expect(pickSurprise(items, [], () => 0.99)?.id).toBe('f')
  })
})

describe('rememberPick', () => {
  it('remembers the last few and forgets the rest', () => {
    let memory: string[] = []
    for (const item of items) memory = rememberPick(memory, item.id)
    expect(memory).toHaveLength(SURPRISE_MEMORY)
    expect(memory[memory.length - 1]).toBe('f')
    expect(memory).not.toContain('a')
  })
})
