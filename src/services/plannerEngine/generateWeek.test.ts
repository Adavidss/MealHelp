import { describe, expect, it } from 'vitest'
import { generateWeek } from './generateWeek'
import type { MealSlotConfig, PlanningRequest } from '@/models'
import { makeRecipe } from '@/test/factories'

const WEEK = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21']

const REQUEST: Omit<PlanningRequest, 'mealType' | 'mealsNeeded' | 'targetCookSessions' | 'dates'> = {
  startDate: WEEK[0],
  preferLeftovers: true,
}

function library() {
  return [
    makeRecipe({ id: 'chili', title: 'Chili', servings: 8, leftoverScore: 5, rating: 5, activeTimeMinutes: 20 }),
    makeRecipe({ id: 'stew', title: 'Stew', servings: 8, leftoverScore: 5, rating: 4, activeTimeMinutes: 20 }),
    makeRecipe({ id: 'tacos', title: 'Tacos', servings: 4, rating: 3, activeTimeMinutes: 20 }),
    makeRecipe({ id: 'oats', title: 'Baked Oats', servings: 4, mealTypes: ['breakfast'], rating: 4 }),
  ]
}

const dinner: MealSlotConfig = { id: 'dinner', label: 'Dinner', type: 'dinner', fill: 'cook', cookSessions: 2 }

describe('generateWeek', () => {
  it('plans each slot on its own rhythm rather than one meal a day', () => {
    const breakfast: MealSlotConfig = {
      id: 'breakfast',
      label: 'Breakfast',
      type: 'breakfast',
      fill: 'routine',
      routine: { name: 'Bowl of Special K', groceryLines: ['1 box Special K'] },
    }

    const week = generateWeek({
      slots: [breakfast, dinner],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })

    expect(week.plans.map((plan) => plan.slot.id)).toEqual(['breakfast', 'dinner'])
    // Every morning is the same thing, and it needed no recipe to say so.
    const mornings = week.plans[0].meals
    expect(mornings).toHaveLength(5)
    expect(mornings.every((meal) => meal.kind === 'custom')).toBe(true)
    expect(mornings[0].customName).toBe('Bowl of Special K')
    // Dinner still gets the engine: two cooking nights, the rest leftovers.
    expect(week.plans[1].meals.filter((meal) => meal.kind === 'recipe')).toHaveLength(2)
  })

  it('keeps slots in the order they are eaten, whatever order it planned them in', () => {
    const lunch: MealSlotConfig = { id: 'lunch', label: 'Lunch', type: 'lunch', fill: 'leftovers' }
    const week = generateWeek({
      slots: [lunch, dinner],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })
    expect(week.plans.map((plan) => plan.slot.id)).toEqual(['lunch', 'dinner'])
  })

  /** Yesterday's dinner is today's lunch — the reason slots exist at all. */
  it('feeds a leftovers slot from a cooking slot earlier in the week', () => {
    const lunch: MealSlotConfig = { id: 'lunch', label: 'Lunch', type: 'lunch', fill: 'leftovers' }
    const week = generateWeek({
      slots: [dinner, lunch],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })

    const lunches = week.plans.find((plan) => plan.slot.id === 'lunch')!.meals
    const fed = lunches.filter((meal) => meal.kind === 'leftover')
    expect(fed.length).toBeGreaterThan(0)
    for (const meal of fed) {
      expect(meal.sourceDate).toBeDefined()
      // Never eats from a night that has not happened yet.
      expect(meal.sourceDate! <= meal.date).toBe(true)
    }
  })

  /**
   * Monday's lunch cannot eat Monday's dinner: that food does not exist yet.
   * The first version of this read perfectly plausibly on screen — "Lunch:
   * leftovers from Mon" — which is exactly why it is pinned here.
   */
  it('never eats leftovers of a meal that has not been cooked yet', () => {
    const lunch: MealSlotConfig = { id: 'lunch', label: 'Lunch', type: 'lunch', fill: 'leftovers' }
    const week = generateWeek({
      // Lunch comes before dinner in the day, which is what makes it a trap.
      slots: [lunch, dinner],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })

    const lunches = week.plans.find((plan) => plan.slot.id === 'lunch')!.meals
    for (const meal of lunches.filter((entry) => entry.kind === 'leftover')) {
      expect(meal.sourceDate! < meal.date, `${meal.date} ate same-day dinner`).toBe(true)
    }
    // The first day has nothing behind it, so it stays honestly empty.
    expect(lunches[0].unfilled).toBe(true)
  })

  it('never serves the same portion twice', () => {
    const lunch: MealSlotConfig = { id: 'lunch', label: 'Lunch', type: 'lunch', fill: 'leftovers' }
    const week = generateWeek({
      slots: [dinner, lunch],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })
    const lunches = week.plans.find((plan) => plan.slot.id === 'lunch')!.meals
    const dinners = week.plans.find((plan) => plan.slot.id === 'dinner')!.meals

    // Portions claimed by lunches cannot exceed what the cooking left over.
    const cooked = dinners
      .filter((meal) => meal.kind === 'recipe')
      .reduce((sum, meal) => sum + Math.floor((meal.servings ?? 0) / 4) - 1, 0)
    const dinnerLeftovers = dinners.filter((meal) => meal.kind === 'leftover').length
    const lunchLeftovers = lunches.filter((meal) => meal.kind === 'leftover').length
    expect(dinnerLeftovers + lunchLeftovers).toBeLessThanOrEqual(cooked)
  })

  it('only plans a slot on the days it happens', () => {
    const weekendBrunch: MealSlotConfig = {
      id: 'brunch',
      label: 'Brunch',
      type: 'breakfast',
      fill: 'routine',
      routine: { name: 'Pancakes', groceryLines: [] },
      // 2026-08-17 is a Monday, so only the 22nd/23rd would qualify — neither
      // is in this week's dates, and the slot must simply not appear.
      daysOfWeek: [0, 6],
    }
    const week = generateWeek({
      slots: [weekendBrunch, dinner],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })
    expect(week.plans.map((plan) => plan.slot.id)).toEqual(['dinner'])
  })

  it('says so when a routine slot has nothing set, rather than filling it silently', () => {
    const breakfast: MealSlotConfig = { id: 'b', label: 'Breakfast', type: 'breakfast', fill: 'routine' }
    const week = generateWeek({
      slots: [breakfast],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })
    expect(week.plans[0].meals.every((meal) => meal.unfilled)).toBe(true)
    expect(week.warnings.join(' ')).toMatch(/no usual meal/i)
  })

  it('leaves an "up to you" slot alone', () => {
    const snack: MealSlotConfig = { id: 'snack', label: 'Snack', type: 'snack', fill: 'open' }
    const week = generateWeek({
      slots: [snack],
      dates: WEEK,
      request: REQUEST,
      library: library(),
      defaultServings: 4,
    })
    expect(week.plans[0].meals).toEqual([])
  })
})
