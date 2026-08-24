import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { App } from './App'
import { db } from '@/db/database'
import { starterRecipeDrafts } from '@/features/recipes/starterRecipes'
import { getOrCreatePlan, addPlannedMeal } from '@/db/plans'
import { generateGroceryList } from '@/db/grocery'
import { newId, nowISO } from '@/utils/id'
import type { Recipe } from '@/models'
import { todayISO, startOfWeek } from '@/utils/date'

/**
 * Every screen, rendered once, with a real library behind it.
 *
 * The engines have had tests from the start; the screens have not, and the
 * screens are where the bugs actually shipped — a CSS-module class collision
 * that flattened the day grid, a conditional hook that took the planner down,
 * a library that rendered nothing when a synced recipe arrived missing a
 * field. Each of those was a blank or broken page that any render at all would
 * have caught, and each was found by a person looking instead.
 *
 * So this asserts the two things that make a screen a screen: it reached its
 * own content, and the error boundary did not.
 *
 * Both halves have to be scoped to <main>, and the first has to be a heading.
 * The first version of this file matched plain text anywhere on the page and
 * passed happily against a screen that had thrown — every pattern it was
 * looking for was also the name of a tab in the navigation, which renders
 * whatever happens. A smoke test that cannot fail is worse than none.
 */

const WEEK = startOfWeek(todayISO(), 1)

async function seed() {
  const now = nowISO()
  const recipes = starterRecipeDrafts().map(
    (draft) => ({ ...draft, id: newId('rec'), createdAt: now, updatedAt: now }) as Recipe,
  )
  await db.recipes.bulkPut(recipes)

  // A planned week, so the planner, grocery list and nutrition screens all
  // have something real to draw rather than their empty states.
  const plan = await getOrCreatePlan(WEEK)
  await addPlannedMeal({
    planId: plan.id,
    date: todayISO(),
    mealType: 'dinner',
    kind: 'recipe',
    recipeId: recipes[0].id,
    servings: 4,
  })
  const meals = await db.plannedMeals.where('planId').equals(plan.id).toArray()
  await generateGroceryList(WEEK, meals, { planId: plan.id })
}

/**
 * A heading only that screen draws, so the navigation cannot satisfy it — and,
 * where a screen's whole job is to list something, a piece of that list. A
 * heading arrives before the database does, so on its own it would pass
 * against the empty state of a screen that should have been full.
 */
const SCREENS: Array<{ path: string; name: string; heading: RegExp; content?: RegExp }> = [
  { path: '#/', name: 'Home', heading: /today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i },
  { path: '#/recipes', name: 'Recipes', heading: /^recipes$/i, content: /slow cooker pulled pork/i },
  { path: '#/plan', name: 'Plan', heading: /^(this week|next week|[a-z]+ \d+.*)$/i, content: /monday/i },
  { path: '#/plan?tab=nutrition', name: 'Nutrition', heading: /nutrition/i },
  { path: '#/plan?tab=history', name: 'History', heading: /history|what you have cooked|cooked/i },
  { path: '#/grocery', name: 'Grocery', heading: /grocery list/i, content: /garlic/i },
  { path: '#/grocery?tab=pantry', name: 'Pantry', heading: /pantry/i },
  { path: '#/plan-week', name: 'Plan my week', heading: /plan my week/i },
  { path: '#/browser', name: 'Browser', heading: /browser|find a recipe|recipe databases/i },
  { path: '#/import', name: 'Import', heading: /import/i },
  { path: '#/more', name: 'More', heading: /more|everything else/i },
  { path: '#/settings', name: 'Settings', heading: /settings/i },
]

beforeAll(async () => {
  await seed()
})

afterEach(() => cleanup())

describe.each(SCREENS)('$name', ({ path, heading, content }) => {
  it('renders without falling over', async () => {
    window.location.hash = path
    render(<App />)
    const main = await screen.findByRole('main')

    // Lazily loaded screens arrive a tick later, so wait for the screen's own
    // heading rather than asserting against the loading state.
    await waitFor(
      () => {
        expect(within(main).getAllByRole('heading', { name: heading }).length).toBeGreaterThan(0)
      },
      { timeout: 5000 },
    )

    if (content) {
      await waitFor(
        () => {
          expect(within(main).getAllByText(content).length).toBeGreaterThan(0)
        },
        { timeout: 5000 },
      )
    }

    // The error boundary renders this, and nothing else does.
    expect(within(main).queryByText(/ran into a problem/i)).toBeNull()
  })
})

describe('a recipe', () => {
  it('opens its own page', async () => {
    const recipe = (await db.recipes.toArray())[0]
    window.location.hash = `#/recipes/${recipe.id}`
    render(<App />)
    const main = await screen.findByRole('main')

    await waitFor(() => {
      expect(within(main).getAllByRole('heading', { name: recipe.title }).length).toBeGreaterThan(0)
    })
    // The ingredients are the page: a title with nothing under it is the shape
    // the library bug took.
    expect(within(main).getAllByRole('heading', { name: /ingredients/i }).length).toBeGreaterThan(0)
    expect(within(main).queryByText(/ran into a problem/i)).toBeNull()
  })

  it('can be cooked', async () => {
    const recipe = (await db.recipes.toArray())[0]
    window.location.hash = `#/recipes/${recipe.id}/cook`
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: /ingredients/i }).length).toBeGreaterThan(0)
    })
    expect(screen.queryByText(/ran into a problem/i)).toBeNull()
  })
})
