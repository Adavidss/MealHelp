import { describe, expect, it } from 'vitest'
import {
  QR_MAX_CHARS,
  decodeShare,
  encodeShare,
  groceryPayload,
  readGroceryPayload,
  readRecipePayload,
  recipePayload,
  shareSize,
  type SharePayload,
} from './shareCodec'
import { ingredientsFrom, makeRecipe } from '@/test/factories'
import type { GroceryItem } from '@/models'

function item(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return {
    id: 'gi1',
    key: 'yellow onion',
    name: 'Yellow onions',
    quantities: [{ amount: 3 }],
    category: 'Produce',
    checked: false,
    sources: [],
    ...overrides,
  }
}

describe('shareCodec', () => {
  it('round-trips a grocery list', () => {
    const payload = groceryPayload(
      [item(), item({ id: 'gi2', key: 'olive oil', name: 'Olive oil', quantities: [{ amount: 3, unit: 'tbsp' }] })],
      '2026-08-10',
    )
    const decoded = decodeShare(encodeShare(payload))
    const read = readGroceryPayload(decoded)

    expect(read.weekStart).toBe('2026-08-10')
    expect(read.items).toEqual([
      { name: 'Yellow onions', quantity: '3', category: 'Produce', checked: false },
      { name: 'Olive oil', quantity: '3 tbsp', category: 'Produce', checked: false },
    ])
  })

  it('round-trips a recipe, keeping the lines as written', () => {
    const recipe = makeRecipe({
      title: 'Slow Cooker Chicken Curry',
      ingredients: ingredientsFrom(['2 large yellow onions, finely diced']),
    })
    const read = readRecipePayload(decodeShare(encodeShare(recipePayload(recipe))))

    expect(read.title).toBe('Slow Cooker Chicken Curry')
    expect(read.ingredients).toEqual(['2 large yellow onions, finely diced'])
  })

  it('refuses a payload from a future version rather than guessing', () => {
    const future = { version: 2, type: 'grocery', data: {} } as unknown as SharePayload
    expect(() => decodeShare(encodeShare(future))).toThrow(/different version/i)
  })

  it('compresses enough that a normal week fits in a QR code', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      item({ id: `gi${i}`, key: `ingredient ${i}`, name: `Ingredient ${i}` }),
    )
    const encoded = encodeShare(groceryPayload(items, '2026-08-10'))
    expect(encoded.length).toBeLessThan(QR_MAX_CHARS)
    expect(shareSize(encoded.length)).not.toBe('too-large')
  })

  it('flags a list too big to make a scannable code', () => {
    expect(shareSize(50)).toBe('ok')
    expect(shareSize(1500)).toBe('large')
    expect(shareSize(9000)).toBe('too-large')
  })
})
