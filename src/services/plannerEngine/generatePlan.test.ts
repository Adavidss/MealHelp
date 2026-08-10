import { describe, expect, it } from 'vitest'
import { generatePlan } from './generatePlan'
import { makePlannedMeal, makeRecipe } from '@/test/factories'
import type { PlanningRequest, Recipe } from '@/models'

const WEEK = [
  '2026-08-10',
  '2026-08-11',
  '2026-08-12',
  '2026-08-13',
  '2026-08-14',
  '2026-08-15',
  '2026-08-16',
]

function library(): Recipe[] {
  return [
    makeRecipe({
      id: 'curry',
      title: 'Slow Cooker Chicken Curry',
      servings: 6,
      prepTimeMinutes: 20,
      cookTimeMinutes: 360,
      activeTimeMinutes: 20,
      cookingMethods: ['slow-cooker'],
      leftoverScore: 5,
      rating: 5,
    }),
    makeRecipe({
      id: 'chili',
      title: 'Instant Pot Beef Chili',
      servings: 6,
      activeTimeMinutes: 20,
      cookingMethods: ['instant-pot'],
      leftoverScore: 5,
      rating: 4,
    }),
    makeRecipe({
      id: 'sheetpan',
      title: 'Sheet Pan Chicken',
      servings: 6,
      activeTimeMinutes: 15,
      cookingMethods: ['sheet-pan', 'oven'],
      leftoverScore: 4,
    }),
    makeRecipe({
      id: 'grilled-cheese',
      title: 'Grilled Cheese and Tomato Soup',
      servings: 4,
      activeTimeMinutes: 20,
      cookingMethods: ['stovetop'],
      leftoverScore: 2,
    }),
    makeRecipe({
      id: 'roast',
      title: 'Sunday Roast',
      servings: 8,
      activeTimeMinutes: 90,
      cookingMethods: ['oven'],
      leftoverScore: 4,
    }),
    makeRecipe({
      id: 'stirfry',
      title: 'Quick Beef Stir Fry',
      servings: 4,
      activeTimeMinutes: 25,
      cookingMethods: ['stovetop', 'one-pot'],
      leftoverScore: 3,
    }),
  ]
}

function request(overrides: Partial<PlanningRequest> = {}): PlanningRequest {
  return {
    startDate: WEEK[0],
    dates: WEEK.slice(0, 5),
    mealType: 'dinner',
    mealsNeeded: 5,
    targetCookSessions: 3,
    preferLeftovers: true,
    servingsPerMeal: 2,
    ...overrides,
  }
}

describe('generatePlan', () => {
  it('fills five dinners with only three cooking sessions', () => {
    const plan = generatePlan({ request: request(), library: library() })

    expect(plan.slots).toHaveLength(5)
    expect(plan.cookSessions).toBe(3)
    expect(plan.leftoverMeals).toBe(2)
    expect(plan.slots.every((slot) => !slot.unfilled)).toBe(true)
  })

  it('spreads the cooking nights out instead of front-loading them', () => {
    const plan = generatePlan({ request: request(), library: library() })
    const cookDays = plan.slots
      .filter((slot) => slot.kind === 'recipe')
      .map((slot) => WEEK.indexOf(slot.date))

    // Three cook nights across five days fit as Mon/Wed/Fri; cooking three
    // nights in a row and then eating four-day-old leftovers does not count.
    for (let i = 1; i < cookDays.length; i++) {
      expect(cookDays[i] - cookDays[i - 1]).toBeGreaterThan(1)
    }
  })

  it('still cooks on the days that have time when the week is uneven', () => {
    const plan = generatePlan({
      request: request({
        targetCookSessions: 2,
        dayLoads: {
          [WEEK[0]]: 'minimal',
          [WEEK[1]]: 'free',
          [WEEK[2]]: 'busy',
          [WEEK[3]]: 'free',
          [WEEK[4]]: 'minimal',
        },
      }),
      library: library(),
    })

    const cookDates = plan.slots
      .filter((slot) => slot.kind === 'recipe')
      .map((slot) => slot.date)

    expect(cookDates).toContain(WEEK[1])
  })

  it('never schedules a leftover night before anything has been cooked', () => {
    const plan = generatePlan({ request: request(), library: library() })
    expect(plan.slots[0].kind).toBe('recipe')
  })

  it('points each leftover night at a real cooking session', () => {
    const plan = generatePlan({ request: request(), library: library() })
    const cookDates = new Set(
      plan.slots.filter((slot) => slot.kind === 'recipe').map((slot) => slot.date),
    )
    for (const slot of plan.slots.filter((s) => s.kind === 'leftover')) {
      expect(slot.sourceDate).toBeDefined()
      expect(cookDates.has(slot.sourceDate as string)).toBe(true)
      expect(slot.sourceDate! < slot.date).toBe(true)
    }
  })

  it('cooks enough servings to cover the leftover nights that follow', () => {
    const plan = generatePlan({ request: request(), library: library() })
    for (const slot of plan.slots.filter((s) => s.kind === 'recipe')) {
      const dependents = plan.slots.filter((s) => s.sourceDate === slot.date).length
      if (dependents > 0) {
        expect(slot.servings ?? 0).toBeGreaterThanOrEqual((dependents + 1) * 2)
      }
    }
  })

  it('keeps a heavy recipe off a minimal-effort night', () => {
    const plan = generatePlan({
      request: request({
        dates: WEEK.slice(0, 5),
        targetCookSessions: 5,
        preferLeftovers: false,
        dayLoads: { [WEEK[4]]: 'minimal' },
      }),
      library: library(),
    })

    const friday = plan.slots.find((slot) => slot.date === WEEK[4])
    expect(friday?.recipeId).not.toBe('roast')
  })

  it('honours a request for at least one slow cooker and one Instant Pot meal', () => {
    const plan = generatePlan({
      request: request({ requiredMethods: ['slow-cooker', 'instant-pot'] }),
      library: library(),
    })

    const methods = plan.slots
      .filter((slot) => slot.kind === 'recipe')
      .flatMap((slot) => slot.recipe?.cookingMethods ?? [])

    expect(methods).toContain('slow-cooker')
    expect(methods).toContain('instant-pot')
  })

  it('leaves locked meals exactly where they were', () => {
    const locked = makePlannedMeal({
      date: WEEK[0],
      recipeId: 'grilled-cheese',
      kind: 'recipe',
      locked: true,
    })
    const plan = generatePlan({
      request: request({ lockedMeals: [locked] }),
      library: library(),
    })

    expect(plan.slots[0].recipeId).toBe('grilled-cheese')
    expect(plan.slots[0].locked).toBe(true)
  })

  it('never repeats a recipe within one week', () => {
    const plan = generatePlan({
      request: request({ targetCookSessions: 5, preferLeftovers: false }),
      library: library(),
    })
    const ids = plan.slots.map((slot) => slot.recipeId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('explains its choices', () => {
    const plan = generatePlan({ request: request(), library: library() })
    expect(plan.slots[0].reasons.length).toBeGreaterThan(0)
  })

  it('says so plainly when there is nothing to plan with', () => {
    const plan = generatePlan({ request: request(), library: [] })
    expect(plan.warnings[0]).toMatch(/empty/i)
    expect(plan.slots.every((slot) => slot.unfilled)).toBe(true)
  })

  it('cooks every night when leftovers are turned off', () => {
    const plan = generatePlan({
      request: request({ preferLeftovers: false }),
      library: library(),
    })
    expect(plan.leftoverMeals).toBe(0)
    expect(plan.cookSessions).toBe(5)
  })
})
