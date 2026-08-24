import { describe, expect, it } from 'vitest'
import { SCALE_OPTIONS, displayIngredientSections, scaleLabel } from './ingredientDisplay'
import { ingredientsFrom } from '@/test/factories'

function lines(input: string[], scale: number) {
  return displayIngredientSections(ingredientsFrom(input), scale)
    .flatMap((section) => section.items)
    .map((item) => `${item.quantityText} ${item.name}`.trim())
}

describe('scaling what is on screen', () => {
  it('doubles and triples the amounts', () => {
    expect(lines(['2 lbs ground beef'], 2)).toEqual(['4 lbs ground beef'])
    expect(lines(['1 tbsp olive oil'], 3)).toEqual(['3 tbsp olive oil'])
  })

  /**
   * A recipe scaled to an awkward number of servings used to ask for "3.17
   * onions", which is not something a kitchen can do.
   */
  it('rounds the things you count to something you can buy', () => {
    expect(lines(['1 large yellow onion'], 3.1666)).toEqual(['3 large yellow onions'])
    expect(lines(['2 eggs'], 1.2)).toEqual(['2 1/2 eggs'])
    // Weights keep their precision: two thirds of a pound is a real amount.
    expect(lines(['2 lbs ground beef'], 3.1666)).toEqual(['6 1/3 lbs ground beef'])
  })

  /** "3 large yellow onion" reads as a bug even though the arithmetic is right. */
  it('says three onions rather than three onion', () => {
    expect(lines(['1 large yellow onion'], 3)).toEqual(['3 large yellow onions'])
    expect(lines(['1 egg'], 2)).toEqual(['2 eggs'])
    // Measured things were already right, and the word must not change.
    expect(lines(['2 lbs ground beef'], 2)).toEqual(['4 lbs ground beef'])
    // A name that is already plural stays as it is.
    expect(lines(['2 cans kidney beans'], 2)).toEqual(['4 cans kidney beans'])
  })

  it('offers the multipliers people actually cook at', () => {
    expect([...SCALE_OPTIONS]).toEqual([0.5, 1, 1.5, 2, 3, 4])
    expect(scaleLabel(0.5)).toBe('½×')
    expect(scaleLabel(3)).toBe('3×')
  })
})
