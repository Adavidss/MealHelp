import { describe, expect, it } from 'vitest'
import {
  CHARACTERISTICS,
  TILE_PALETTES,
  badgesFor,
  characteristicById,
  countCharacteristics,
  filterByCharacteristics,
  tilePalette,
} from './characteristics'
import { makeRecipe } from '@/test/factories'

const CROCK_POT = makeRecipe({
  id: 'curry',
  title: 'Slow Cooker Chicken Curry',
  cookingMethods: ['slow-cooker'],
  servings: 6,
  activeTimeMinutes: 20,
  cookTimeMinutes: 360,
  leftoverScore: 5,
  freezerFriendly: true,
  costTier: '$$',
})

const FIDDLY = makeRecipe({
  id: 'roast',
  title: 'Sunday Roast',
  cookingMethods: ['oven'],
  servings: 8,
  activeTimeMinutes: 90,
  cookTimeMinutes: 120,
  cleanupScore: 1,
  leftoverScore: 2,
})

describe('characteristics', () => {
  it('calls a slow cooker recipe a Crock-Pot meal', () => {
    expect(characteristicById('slow-cooker')?.matches(CROCK_POT)).toBe(true)
    expect(characteristicById('slow-cooker')?.matches(FIDDLY)).toBe(false)
  })

  it('calls twenty minutes of work simple, and ninety minutes not', () => {
    expect(characteristicById('simple')?.matches(CROCK_POT)).toBe(true)
    expect(characteristicById('simple')?.matches(FIDDLY)).toBe(false)
  })

  /**
   * The slow cooker case: six hours on the clock, twenty minutes of attention.
   * Both "quick" and "takes all day" are true, and the labels say so.
   */
  it('separates hours on the clock from hours of your attention', () => {
    expect(characteristicById('quick')?.matches(CROCK_POT)).toBe(true)
    expect(characteristicById('hands-off')?.matches(CROCK_POT)).toBe(true)

    const fastAndBriefly = makeRecipe({ activeTimeMinutes: 15, cookTimeMinutes: 15 })
    expect(characteristicById('quick')?.matches(fastAndBriefly)).toBe(true)
    expect(characteristicById('hands-off')?.matches(fastAndBriefly)).toBe(false)
  })

  it('recognises the ones worth cooking a lot of', () => {
    expect(characteristicById('big-batch')?.matches(CROCK_POT)).toBe(true)
    expect(characteristicById('leftovers')?.matches(CROCK_POT)).toBe(true)
    expect(characteristicById('leftovers')?.matches(FIDDLY)).toBe(false)
  })
})

describe('badgesFor', () => {
  it('puts the most telling thing first', () => {
    // What it is cooked in beats how it turns out.
    expect(badgesFor(CROCK_POT)[0]).toBe('Crock-Pot')
  })

  it('shows a few, not everything true about a recipe', () => {
    expect(badgesFor(CROCK_POT).length).toBeLessThanOrEqual(3)
  })

  it('claims only what is true of a long, fiddly recipe', () => {
    // A roast for eight really is a big batch; it is not simple or quick.
    const badges = badgesFor(FIDDLY)
    expect(badges).toContain('Big batch')
    expect(badges).not.toContain('Simple')
    expect(badges).not.toContain('Quick')
    expect(badges).not.toContain('Great leftovers')
  })
})

describe('countCharacteristics', () => {
  it('counts what each filter would leave', () => {
    const counts = countCharacteristics([CROCK_POT, FIDDLY])
    expect(counts.get('slow-cooker')).toBe(1)
    expect(counts.get('simple')).toBe(1)
    expect(counts.get('air-fryer')).toBe(0)
  })
})

describe('filterByCharacteristics', () => {
  const library = [CROCK_POT, FIDDLY]

  it('leaves everything alone when nothing is selected', () => {
    expect(filterByCharacteristics(library, [])).toHaveLength(2)
  })

  it('narrows to recipes matching every choice, not any of them', () => {
    expect(filterByCharacteristics(library, ['slow-cooker', 'simple'])).toEqual([
      CROCK_POT,
    ])
    expect(filterByCharacteristics(library, ['slow-cooker', 'air-fryer'])).toEqual([])
  })

  it('ignores a filter id it does not recognise', () => {
    expect(filterByCharacteristics(library, ['nonsense'])).toHaveLength(2)
  })
})

describe('tilePalette', () => {
  it('gives a recipe the same colour every time', () => {
    expect(tilePalette({ title: 'Overnight Oats' })).toBe(
      tilePalette({ title: 'Overnight Oats' }),
    )
  })

  it('stays inside the palettes that exist', () => {
    for (const title of ['a', 'Something Much Longer', '🍲 Stew', '']) {
      const palette = tilePalette({ title })
      expect(palette).toBeGreaterThanOrEqual(0)
      expect(palette).toBeLessThan(TILE_PALETTES)
    }
  })

  /**
   * The point of the colours is that a shelf of recipes looks like a shelf.
   * The previous hash put five of these twelve on the same one.
   */
  it('spreads a real library across the palettes', () => {
    const titles = [
      'Overnight Oats',
      'Big Batch Turkey Meatballs',
      'Roast Chicken with Potatoes',
      'Black Bean Quesadillas',
      'Instant Pot Lentil Soup',
      'Weeknight Fried Rice',
      'Slow Cooker Pulled Pork',
      'One Pot Creamy Sausage Pasta',
      'Grilled Cheese and Tomato Soup',
      'Sheet Pan Chicken and Vegetables',
      'Instant Pot Beef Chili',
      'Slow Cooker Chicken Curry',
    ]

    const counts = new Map<number, number>()
    for (const title of titles) {
      const palette = tilePalette({ title })
      counts.set(palette, (counts.get(palette) ?? 0) + 1)
    }

    // Not every palette every time — twelve items in six buckets leaves one
    // empty by chance quite often. What matters is that no colour dominates.
    expect(counts.size).toBeGreaterThanOrEqual(TILE_PALETTES - 1)
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(4)
  })
})

describe('the filter list as a whole', () => {
  it('has no duplicate ids, since selection is keyed on them', () => {
    const ids = CHARACTERISTICS.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('survives a recipe with almost nothing filled in', () => {
    const bare = makeRecipe({
      servings: undefined,
      prepTimeMinutes: undefined,
      cookTimeMinutes: undefined,
      activeTimeMinutes: undefined,
      cookingMethods: [],
    })
    expect(() => CHARACTERISTICS.map((entry) => entry.matches(bare))).not.toThrow()
  })
})
