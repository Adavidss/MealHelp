import { describe, expect, it } from 'vitest'
import { findPrice } from './priceTable'
import { priceBreakdown, priceOfItem } from './estimate'
import type { GroceryItem } from '@/models'

function item(overrides: Partial<GroceryItem> & { key: string }): GroceryItem {
  return {
    id: overrides.key,
    name: overrides.key,
    quantities: [],
    category: 'Other',
    checked: false,
    sources: [],
    ...overrides,
  }
}

describe('findPrice', () => {
  it('matches the most specific name, so a sweet potato is not a potato', () => {
    expect(findPrice('sweet potato')?.price).not.toBe(findPrice('potato')?.price)
    expect(findPrice('boneless skinless chicken thighs')?.key).toBe('chicken thigh')
  })

  it('knows nothing about things it has never heard of', () => {
    expect(findPrice('dragon fruit compote')).toBeUndefined()
  })

  it('reads singular and plural as the same shopping decision', () => {
    expect(findPrice('diced tomato')?.key).toBe('diced tomatoes')
    expect(findPrice('breadcrumb')?.key).toBe('breadcrumbs')
    expect(findPrice('egg')?.key).toBe('eggs')
  })

  /**
   * Matching a word in the middle is how "garlic powder" gets priced as a
   * bulb of garlic and "apple juice" as an apple — a number that is wrong
   * quietly, which is worse than a blank the shopper can fill in.
   */
  it('matches the head noun, never a word in the middle', () => {
    expect(findPrice('garlic powder')?.key).toBe('garlic powder')
    expect(findPrice('apple juice')?.key).toBe('apple juice')
    expect(findPrice('boneless skinless chicken thighs')?.key).toBe('chicken thigh')
  })
})

describe('priceOfItem', () => {
  it('prices by the piece when that is how it is sold', () => {
    expect(priceOfItem(item({ key: 'onion', quantities: [{ amount: 3 }] })).amount).toBeCloseTo(2.7)
  })

  it('converts the recipe’s units into the unit it is priced in', () => {
    // Beef is priced per pound; the list asks for 24 ounces.
    const price = priceOfItem(item({ key: 'ground beef', quantities: [{ amount: 24, unit: 'oz' }] }))
    expect(price.amount).toBeCloseTo(8.25)
  })

  it('adds up quantities that could not be merged into one', () => {
    const price = priceOfItem(
      item({ key: 'olive oil', quantities: [{ amount: 2, unit: 'fl oz' }, { amount: 1, unit: 'fl oz' }] }),
    )
    expect(price.amount).toBeCloseTo(1.65)
  })

  /**
   * Rice is sold by the pound and cooked by the cup. Rather than invent a
   * density, this borrows the per-cup weight the nutrition estimator already
   * carries — so the conversion is a real number, not a guess.
   */
  it('prices a volume by weight when it knows what the food weighs', () => {
    const price = priceOfItem(item({ key: 'rice', quantities: [{ amount: 2, unit: 'cup' }] }))
    // ~370 g of rice, a little over three quarters of a pound at $1.60/lb.
    expect(price.amount).toBeGreaterThan(1)
    expect(price.amount).toBeLessThan(1.8)
  })

  /**
   * Some things are sold by the package and cooked by the piece. Four slices
   * of a sixteen-slice loaf is a quarter of a loaf — a real fact, not a guess.
   */
  it('prices a piece of something sold by the package', () => {
    const bread = priceOfItem(item({ key: 'bread', quantities: [{ amount: 4, unit: 'slice' }] }))
    expect(bread.amount).toBeCloseTo(0.88, 2)

    const tortillas = priceOfItem(item({ key: 'tortillas', quantities: [{ amount: 8 }] }))
    expect(tortillas.amount).toBeCloseTo(3.5 * 0.8, 2)
  })

  /**
   * Two pounds of baby potatoes against a price per potato needs to know what
   * a potato weighs — which the nutrition table does.
   */
  it('converts weight into pieces when it knows what one weighs', () => {
    const price = priceOfItem(item({ key: 'potatoes', quantities: [{ amount: 2, unit: 'lb' }] }))
    expect(price.amount).toBeGreaterThan(2)
    expect(price.amount).toBeLessThan(12)
  })

  /**
   * And where there is no honest conversion it still says so: a number that
   * is quietly wrong is worse than a dash the shopper can fill in.
   */
  it('refuses to price a quantity it cannot honestly convert', () => {
    const price = priceOfItem(item({ key: 'tortillas', quantities: [{ amount: 2, unit: 'cup' }] }))
    expect(price.amount).toBeUndefined()
    expect(price.reason).toBe('incompatible-unit')
  })

  it('treats a quantity-less staple as one of the thing', () => {
    expect(priceOfItem(item({ key: 'salt' })).amount).toBeCloseTo(1.5)
  })

  it('lets the shopper’s own price win over the built-in one', () => {
    const line = item({ key: 'ground beef', quantities: [{ amount: 1, unit: 'lb' }] })
    const own = priceOfItem(line, { own: { price: 9, unit: 'lb' } })
    expect(own.amount).toBeCloseTo(9)
    expect(own.origin).toBe('own')
    expect(priceOfItem(line).origin).toBe('table')
  })
})

describe('priceBreakdown', () => {
  const list = [
    item({ key: 'ground beef', category: 'Meat & Seafood', quantities: [{ amount: 2, unit: 'lb' }] }),
    item({ key: 'onion', category: 'Produce', quantities: [{ amount: 2 }] }),
    item({ key: 'dragon fruit compote', category: 'Other', quantities: [{ amount: 1 }] }),
  ]

  it('totals by aisle, biggest first, and says what it could not price', () => {
    const breakdown = priceBreakdown(list)
    expect(breakdown.byCategory[0].category).toBe('Meat & Seafood')
    expect(breakdown.total).toBeCloseTo(11 + 1.8)
    expect(breakdown.pricedCount).toBe(2)
    expect(breakdown.itemCount).toBe(3)
    expect(breakdown.unpriced.map((entry) => entry.key)).toEqual(['dragon fruit compote'])
  })

  /** The question is what the shop will cost, not what the kitchen contains. */
  it('leaves out what is already ticked off or already owned', () => {
    const breakdown = priceBreakdown([
      { ...list[0], checked: true },
      { ...list[1], haveIt: true },
    ])
    expect(breakdown.total).toBe(0)
    expect(breakdown.itemCount).toBe(0)
  })
})
