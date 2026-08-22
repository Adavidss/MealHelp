import { describe, expect, it } from 'vitest'
import { recipeCost } from './recipeCost'
import { ingredientsFrom, makeRecipe } from '@/test/factories'

const chili = makeRecipe({
  servings: 4,
  ingredients: ingredientsFrom([
    '2 lbs ground beef',
    '2 yellow onions',
    '2 tbsp olive oil',
    '1 tsp salt',
  ]),
})

describe('recipeCost', () => {
  it('costs the amount the recipe uses, not a shop', () => {
    const cost = recipeCost(chili)
    // 2 lb beef at $5.50 is the bulk of it; two tablespoons of oil are cents.
    const oil = cost.lines.find((line) => /olive oil/i.test(line.name))
    expect(oil?.price.amount).toBeLessThan(1)
    expect(cost.total).toBeGreaterThan(11)
    expect(cost.total).toBeLessThan(20)
  })

  it('scales with the quantity being cooked', () => {
    const single = recipeCost(chili).total
    const double = recipeCost(chili, { scale: 2 }).total
    const half = recipeCost(chili, { scale: 0.5 }).total
    expect(double).toBeCloseTo(single * 2, 1)
    expect(half).toBeCloseTo(single / 2, 1)
  })

  it('gives a per-serving figure at the scale asked for', () => {
    const cost = recipeCost(chili, { scale: 2 })
    expect(cost.servings).toBe(8)
    expect(cost.perServing).toBeCloseTo(cost.total / 8, 2)
  })

  /**
   * "What will this cost me" is a different question from "what does this
   * contain": the salt and oil you always have are not part of the shop.
   */
  it('counts the cupboard separately rather than in the total', () => {
    const withPantry = recipeCost(chili, { pantryKeys: new Set(['salt', 'olive oil']) })
    const without = recipeCost(chili)

    expect(withPantry.pantryTotal).toBeGreaterThan(0)
    expect(withPantry.total).toBeLessThan(without.total)
    expect(withPantry.total + withPantry.pantryTotal).toBeCloseTo(without.total, 2)
    expect(withPantry.lines.filter((line) => line.pantry)).toHaveLength(2)
  })

  it('lets the shopper’s own price win, as everywhere else', () => {
    const own = new Map([['ground beef', { price: 12, unit: 'lb' }]])
    expect(recipeCost(chili, { ownPrices: own }).total).toBeGreaterThan(recipeCost(chili).total)
  })

  it('names what it could not price rather than quietly dropping it', () => {
    const odd = makeRecipe({ ingredients: ingredientsFrom(['1 cup dragon fruit compote']) })
    const cost = recipeCost(odd)
    expect(cost.total).toBe(0)
    expect(cost.unpriced).toHaveLength(1)
    expect(cost.pricedCount).toBe(0)
  })

  it('keeps a line for every ingredient, priced or not', () => {
    expect(recipeCost(chili).lines).toHaveLength(chili.ingredients.length)
  })
})
