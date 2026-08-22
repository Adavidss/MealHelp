import { describe, expect, it } from 'vitest'
import { weekFit } from './weekFit'
import type { GeneratedSlot } from './generatePlan'
import { ingredientsFrom, makeRecipe } from '@/test/factories'

const chili = makeRecipe({
  id: 'chili',
  title: 'Chili',
  servings: 4,
  activeTimeMinutes: 25,
  nutrition: { calories: 500, protein: 35 },
  ingredients: ingredientsFrom(['2 lbs ground beef', '2 yellow onions']),
})

const salad = makeRecipe({
  id: 'salad',
  title: 'Salad',
  servings: 4,
  activeTimeMinutes: 10,
  nutrition: { calories: 300, protein: 10 },
  ingredients: ingredientsFrom(['1 lettuce', '2 tomatoes']),
})

function week(): GeneratedSlot[] {
  return [
    { date: '2026-08-17', mealType: 'dinner', kind: 'recipe', recipeId: 'chili', recipe: chili, servings: 8, reasons: [] },
    { date: '2026-08-18', mealType: 'dinner', kind: 'leftover', recipeId: 'chili', recipe: chili, sourceDate: '2026-08-17', servings: 4, reasons: [] },
    { date: '2026-08-19', mealType: 'dinner', kind: 'recipe', recipeId: 'salad', recipe: salad, servings: 4, reasons: [] },
  ]
}

describe('weekFit', () => {
  it('prices the week the way the grocery list would', () => {
    const fit = weekFit({ slots: week(), dayCount: 3 })
    // Beef and onions for a double batch, plus a salad: tens, not hundreds.
    expect(fit.cost.value).toBeGreaterThan(10)
    expect(fit.cost.value).toBeLessThan(60)
  })

  it('answers the question a budget asks', () => {
    expect(weekFit({ slots: week(), dayCount: 3, targets: { budget: 200 } }).cost.status).toBe('good')
    expect(weekFit({ slots: week(), dayCount: 3, targets: { budget: 5 } }).cost.status).toBe('over')
  })

  /** The night that decides whether a week is workable is the longest one. */
  it('measures the longest night, not the average', () => {
    const fit = weekFit({ slots: week(), dayCount: 3, targets: { maxMinutesPerMeal: 20 } })
    expect(fit.longestMeal.value).toBe(25)
    expect(fit.longestMeal.status).toBe('over')
  })

  it('counts every meal eaten towards nutrition, leftovers included', () => {
    const fit = weekFit({ slots: week(), dayCount: 3 })
    // (500 + 500 + 300) / 3 days
    expect(fit.calories.value).toBeCloseTo(433.3, 0)
    expect(fit.protein.value).toBeCloseTo(26.7, 0)
  })

  it('treats a protein goal as a floor, not a ceiling', () => {
    expect(weekFit({ slots: week(), dayCount: 3, targets: { proteinPerDay: 20 } }).protein.status).toBe('good')
    expect(weekFit({ slots: week(), dayCount: 3, targets: { proteinPerDay: 90 } }).protein.status).toBe('under')
  })

  it('says which nights are dearest and slowest, for something to act on', () => {
    const fit = weekFit({ slots: week(), dayCount: 3 })
    expect(fit.dearest[0].slot.recipeId).toBe('chili')
    expect(fit.slowest[0].slot.recipeId).toBe('chili')
  })

  it('counts what it could not count rather than pretending it was zero', () => {
    const mystery = makeRecipe({ id: 'mystery', title: 'Mystery', ingredients: ingredientsFrom(['1 lb beef']) })
    const fit = weekFit({
      slots: [{ date: '2026-08-17', mealType: 'dinner', kind: 'recipe', recipeId: 'mystery', recipe: mystery, reasons: [] }],
      dayCount: 1,
    })
    expect(fit.uncountedMeals).toBe(1)
    expect(fit.protein.value).toBeUndefined()
  })

  /**
   * Telling someone they missed a protein goal when a third of their meals
   * were never counted is worse than saying nothing at all.
   */
  it('will not judge a goal on figures it knows are incomplete', () => {
    const mystery = makeRecipe({ id: 'mystery', title: 'Mystery', ingredients: ingredientsFrom(['1 lb beef']) })
    const slots: GeneratedSlot[] = [
      ...week(),
      { date: '2026-08-20', mealType: 'dinner', kind: 'recipe', recipeId: 'mystery', recipe: mystery, reasons: [] },
    ]
    const fit = weekFit({ slots, dayCount: 4, targets: { proteinPerDay: 90 } })

    expect(fit.protein.partial).toBe(true)
    expect(fit.protein.status).toBe('unknown')
    // The number it does have is still worth showing, as a floor.
    expect(fit.protein.value).toBeGreaterThan(0)
  })

  /**
   * The nutrition page counts the cereal every morning; a week that did not
   * would quietly disagree with it about the same days.
   */
  it('counts standing meals that have numbers but no recipe', () => {
    const fit = weekFit({
      slots: week(),
      dayCount: 3,
      standingMeals: [{ nutrition: { calories: 250, protein: 12 }, count: 3 }],
    })
    // (500 + 500 + 300 + 3 × 250) / 3 days
    expect(fit.calories.value).toBeCloseTo(683.3, 0)
    expect(fit.protein.value).toBeCloseTo(38.7, 0)
  })

  it('has no opinion when no target was set', () => {
    expect(weekFit({ slots: week(), dayCount: 3 }).cost.status).toBe('unknown')
  })
})
