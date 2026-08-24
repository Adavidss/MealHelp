import { describe, expect, it } from 'vitest'
import {
  combineQuantities,
  formatAmount,
  formatQuantity,
  formatShoppingQuantity,
  scaleAmount,
} from './quantities'
import { convert, normalizeUnit, unitsCompatible } from './units'

describe('normalizeUnit', () => {
  it('folds aliases onto one canonical unit', () => {
    expect(normalizeUnit('tbsp')).toBe('tbsp')
    expect(normalizeUnit('Tablespoon')).toBe('tbsp')
    expect(normalizeUnit('tablespoons')).toBe('tbsp')
    expect(normalizeUnit('tsp')).toBe('tsp')
    expect(normalizeUnit('teaspoons')).toBe('tsp')
    expect(normalizeUnit('lbs')).toBe('lb')
    expect(normalizeUnit('pounds')).toBe('lb')
  })

  it('keeps an unrecognised unit rather than dropping it', () => {
    expect(normalizeUnit('glug')).toBe('glug')
  })
})

describe('unitsCompatible', () => {
  it('allows conversion inside a dimension', () => {
    expect(unitsCompatible('tsp', 'tbsp')).toBe(true)
    expect(unitsCompatible('oz', 'lb')).toBe(true)
    expect(unitsCompatible('ml', 'l')).toBe(true)
  })

  it('refuses volume-to-mass, which needs a density MealHelp does not have', () => {
    expect(unitsCompatible('cup', 'g')).toBe(false)
    expect(convert(1, 'cup', 'g')).toBeUndefined()
  })

  it('keeps a countless quantity apart from a measured one', () => {
    expect(unitsCompatible(undefined, 'g')).toBe(false)
    expect(unitsCompatible(undefined, undefined)).toBe(true)
  })

  it('keeps discrete units to themselves', () => {
    expect(unitsCompatible('bunch', 'clove')).toBe(false)
    expect(unitsCompatible('bunch', 'bunch')).toBe(true)
  })
})

describe('convert', () => {
  it('converts within volume and mass', () => {
    expect(convert(3, 'tsp', 'tbsp')).toBeCloseTo(1, 5)
    expect(convert(1, 'cup', 'tbsp')).toBeCloseTo(16, 1)
    expect(convert(16, 'oz', 'lb')).toBeCloseTo(1, 2)
    expect(convert(1, 'kg', 'g')).toBeCloseTo(1000, 5)
  })
})

describe('combineQuantities', () => {
  it('adds identical units', () => {
    const result = combineQuantities([
      { amount: 1, unit: 'tbsp' },
      { amount: 2, unit: 'tbsp' },
    ])
    expect(result).toEqual([{ amount: 3, unit: 'tbsp' }])
  })

  it('adds countless items', () => {
    const result = combineQuantities([{ amount: 1 }, { amount: 2 }])
    expect(result).toEqual([{ amount: 3 }])
  })

  it('reports a mixed volume in the largest unit used', () => {
    const result = combineQuantities([
      { amount: 1, unit: 'tbsp' },
      { amount: 3, unit: 'tsp' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].unit).toBe('tbsp')
    expect(result[0].amount).toBeCloseTo(2, 2)
  })

  it('never invents a conversion between a bunch and a weight', () => {
    const result = combineQuantities([
      { amount: 1, unit: 'bunch' },
      { amount: 20, unit: 'g' },
    ])
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ amount: 1, unit: 'bunch' })
    expect(result).toContainEqual({ amount: 20, unit: 'g' })
  })

  it('keeps unmeasured text as its own line', () => {
    const result = combineQuantities([
      { amount: 2, unit: 'clove' },
      { freeform: 'to taste' },
    ])
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ freeform: 'to taste' })
  })
})

describe('formatAmount', () => {
  it('prefers fractions a kitchen recognises', () => {
    expect(formatAmount(0.5)).toBe('1/2')
    expect(formatAmount(1.5)).toBe('1 1/2')
    expect(formatAmount(0.333)).toBe('1/3')
    expect(formatAmount(2.667)).toBe('2 2/3')
    expect(formatAmount(3)).toBe('3')
  })

  it('falls back to a short decimal', () => {
    expect(formatAmount(1.15)).toBe('1.15')
  })
})

describe('formatQuantity', () => {
  it('pluralises the unit with the amount', () => {
    expect(formatQuantity({ amount: 1, unit: 'clove' })).toBe('1 clove')
    expect(formatQuantity({ amount: 3, unit: 'clove' })).toBe('3 cloves')
    expect(formatQuantity({ amount: 3, unit: 'tbsp' })).toBe('3 tbsp')
    expect(formatQuantity({ amount: 3 })).toBe('3')
  })
})

describe('scaleAmount', () => {
  it('scales a known quantity', () => {
    expect(scaleAmount(2, 2)).toBe(4)
    expect(scaleAmount(1.5, 0.5)).toBe(0.75)
  })

  it('leaves an unknown quantity unknown', () => {
    expect(scaleAmount(undefined, 2)).toBeUndefined()
  })
})

describe('shopping quantities', () => {
  /** Nobody buys 2.7 onions, and a list that says so is a list you stop trusting. */
  it('rounds counted things up, because a spare onion beats a missing one', () => {
    expect(formatShoppingQuantity({ amount: 2.7 })).toBe('3')
    expect(formatShoppingQuantity({ amount: 1.2 })).toBe('2')
    expect(formatShoppingQuantity({ amount: 3 })).toBe('3')
  })

  it('leaves measured things exactly as they are', () => {
    // 2.7 lbs is a real thing to ask for at a counter.
    expect(formatShoppingQuantity({ amount: 2.7, unit: 'lb' })).toBe('2.7 lbs')
    expect(formatShoppingQuantity({ freeform: 'a pinch' })).toBe('a pinch')
  })
})
