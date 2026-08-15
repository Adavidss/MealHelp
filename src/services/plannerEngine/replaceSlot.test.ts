import { describe, expect, it } from 'vitest'
import { replaceCookSlot, suggestAnother } from './replaceSlot'
import type { GeneratedSlot } from './generatePlan'
import { makeRecipe } from '@/test/factories'

const curry = makeRecipe({ id: 'curry', title: 'Curry', servings: 4, rating: 5 })
const chili = makeRecipe({ id: 'chili', title: 'Chili', servings: 8, rating: 4 })
const soup = makeRecipe({ id: 'soup', title: 'Soup', servings: 6, rating: 3 })
const tacos = makeRecipe({ id: 'tacos', title: 'Tacos', servings: 4, rating: 2 })

/** Monday cooks, Tuesday eats the leftovers, Wednesday cooks something else. */
function week(): GeneratedSlot[] {
  return [
    { date: '2026-08-10', mealType: 'dinner', kind: 'recipe', recipeId: 'curry', recipe: curry, servings: 8, reasons: ['Great leftovers'] },
    { date: '2026-08-11', mealType: 'dinner', kind: 'leftover', recipeId: 'curry', recipe: curry, sourceDate: '2026-08-10', servings: 4, reasons: [] },
    { date: '2026-08-12', mealType: 'dinner', kind: 'recipe', recipeId: 'tacos', recipe: tacos, servings: 4, reasons: [] },
  ]
}

describe('replaceCookSlot', () => {
  it('carries the new recipe through to the leftover nights that eat from it', () => {
    const slots = replaceCookSlot(week(), '2026-08-10', chili, 4, ['You picked this one'])
    expect(slots[0].recipeId).toBe('chili')
    expect(slots[1].recipeId).toBe('chili')
    expect(slots[1].kind).toBe('leftover')
    expect(slots[2].recipeId).toBe('tacos')
  })

  it('cooks a batch big enough for every night that leans on it, and says so', () => {
    // Curry only makes 4, but Monday has to feed Tuesday as well.
    const slots = replaceCookSlot(week(), '2026-08-12', curry, 4, [])
    expect(slots[2].servings).toBe(4)

    const monday = replaceCookSlot(week(), '2026-08-10', soup, 4, ['Rated well'])
    expect(monday[0].servings).toBe(8)
    expect(monday[0].reasons[0]).toMatch(/enough for 2 nights/)
    expect(monday[0].reasons).toContain('Rated well')
  })
})

describe('suggestAnother', () => {
  const library = [curry, chili, soup, tacos]

  it('offers the next best recipe, never the current one or anything else on the week', () => {
    const suggestion = suggestAnother({
      slots: week(),
      date: '2026-08-10',
      library,
      context: {},
      perMeal: 4,
    })
    // Curry is what is there now, tacos are Wednesday; chili outranks soup.
    expect(suggestion?.scored.recipe.id).toBe('chili')
    expect(suggestion?.slots[1].recipeId).toBe('chili')
  })

  it('does not bring back what was passed over, and runs dry honestly', () => {
    const second = suggestAnother({
      slots: week(),
      date: '2026-08-10',
      library,
      context: {},
      perMeal: 4,
      passedOver: new Set(['chili']),
    })
    expect(second?.scored.recipe.id).toBe('soup')

    const dry = suggestAnother({
      slots: week(),
      date: '2026-08-10',
      library,
      context: {},
      perMeal: 4,
      passedOver: new Set(['chili', 'soup']),
    })
    expect(dry).toBeUndefined()
  })

  it('prefers a batch that covers the leftover nights when there is one', () => {
    // Monday feeds two nights, so eight servings are wanted; chili makes 8, soup 6.
    const suggestion = suggestAnother({
      slots: week(),
      date: '2026-08-10',
      library: [soup, chili],
      context: {},
      perMeal: 4,
    })
    expect(suggestion?.scored.recipe.id).toBe('chili')
  })
})
