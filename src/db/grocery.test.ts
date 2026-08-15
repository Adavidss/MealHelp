import { afterEach, describe, expect, it } from 'vitest'
import { db } from './database'
import {
  addManualGroceryItem,
  addRecipeToGroceryList,
  generateGroceryList,
  getGroceryList,
  removeRecipeFromGroceryList,
  toggleGroceryItem,
} from './grocery'
import { addPlannedMeal, getOrCreatePlan } from './plans'
import { ingredientsFrom, makeRecipe } from '@/test/factories'

const WEEK = '2026-08-17'

afterEach(async () => {
  await db.recipes.clear()
  await db.mealPlans.clear()
  await db.plannedMeals.clear()
  await db.groceryLists.clear()
  await db.pantryItems.clear()
})

function names(items: { name: string }[]): string[] {
  return items.map((item) => item.name).sort()
}

describe('adding a recipe to the grocery list', () => {
  it('puts its ingredients on the week with the recipe as the reason, with no plan at all', async () => {
    const soup = makeRecipe({
      title: 'Lentil soup',
      servings: 4,
      ingredients: ingredientsFrom(['1 cup red lentils', '1 yellow onion', '4 cups stock']),
    })
    await db.recipes.put(soup)

    const list = await addRecipeToGroceryList(WEEK, soup)

    expect(names(list.items)).toEqual(['Red lentils', 'Stock', 'Yellow onion'])
    expect(list.items.every((item) => item.sources[0].recipeTitle === 'Lentil soup')).toBe(true)
    expect(list.extras).toEqual([
      expect.objectContaining({ recipeId: soup.id, recipeTitle: 'Lentil soup' }),
    ])
  })

  it('scales to the servings asked for and leaves out what the cook already has', async () => {
    const soup = makeRecipe({
      servings: 4,
      ingredients: ingredientsFrom(['1 cup red lentils', '1 yellow onion', '4 cups stock']),
    })
    await db.recipes.put(soup)
    const stock = soup.ingredients[2]

    const list = await addRecipeToGroceryList(WEEK, soup, {
      servings: 8,
      excludedIngredientIds: [stock.id],
    })

    expect(names(list.items)).toEqual(['Red lentils', 'Yellow onions'])
    const lentils = list.items.find((item) => item.key === 'red lentils')
    expect(lentils?.quantities).toEqual([{ amount: 2, unit: 'cup' }])
  })

  it('merges with what the plan already needs instead of listing it twice', async () => {
    const stew = makeRecipe({
      title: 'Stew',
      servings: 4,
      ingredients: ingredientsFrom(['2 yellow onions']),
    })
    const soup = makeRecipe({
      title: 'Soup',
      servings: 4,
      ingredients: ingredientsFrom(['1 yellow onion']),
    })
    await db.recipes.bulkPut([stew, soup])
    const plan = await getOrCreatePlan(WEEK)
    const meal = await addPlannedMeal({
      planId: plan.id,
      date: '2026-08-19',
      mealType: 'dinner',
      kind: 'recipe',
      recipeId: stew.id,
      servings: 4,
    })
    await generateGroceryList(WEEK, [meal], { planId: plan.id })

    const list = await addRecipeToGroceryList(WEEK, soup)

    const onions = list.items.filter((item) => item.key === 'yellow onion')
    expect(onions).toHaveLength(1)
    expect(onions[0].quantities).toEqual([{ amount: 3 }])
    expect(onions[0].sources.map((source) => source.recipeTitle).sort()).toEqual(['Soup', 'Stew'])
  })

  it('survives the list being rebuilt from the plan, and keeps ticks and hand-added items too', async () => {
    const soup = makeRecipe({ title: 'Soup', ingredients: ingredientsFrom(['1 cup red lentils']) })
    await db.recipes.put(soup)
    await addRecipeToGroceryList(WEEK, soup)
    await addManualGroceryItem(WEEK, 'paper towels')
    const before = await getGroceryList(WEEK)
    const lentils = before?.items.find((item) => item.key === 'red lentils')
    await toggleGroceryItem(WEEK, lentils!.id)

    // What "Rebuild from this week's plan" does, with nothing planned.
    const rebuilt = await generateGroceryList(WEEK, [])

    expect(names(rebuilt.items)).toEqual(['Paper towels', 'Red lentils'])
    expect(rebuilt.items.find((item) => item.key === 'red lentils')?.checked).toBe(true)
    expect(rebuilt.extras).toHaveLength(1)
  })

  it('adding the same recipe again replaces its earlier entry rather than doubling it', async () => {
    const soup = makeRecipe({ servings: 4, ingredients: ingredientsFrom(['1 yellow onion']) })
    await db.recipes.put(soup)
    await addRecipeToGroceryList(WEEK, soup, { servings: 4 })

    const list = await addRecipeToGroceryList(WEEK, soup, { servings: 8 })

    expect(list.extras).toHaveLength(1)
    expect(list.items.find((item) => item.key === 'yellow onion')?.quantities).toEqual([{ amount: 2 }])
  })

  it('can be taken off again, which removes its ingredients and nothing else', async () => {
    const soup = makeRecipe({ title: 'Soup', ingredients: ingredientsFrom(['1 cup red lentils']) })
    await db.recipes.put(soup)
    await addRecipeToGroceryList(WEEK, soup)
    await addManualGroceryItem(WEEK, 'paper towels')

    const list = await removeRecipeFromGroceryList(WEEK, soup.id)

    expect(names(list?.items ?? [])).toEqual(['Paper towels'])
    expect(list?.extras).toBeUndefined()
  })

  it('quietly drops a recipe that has since been deleted', async () => {
    const soup = makeRecipe({ title: 'Soup', ingredients: ingredientsFrom(['1 cup red lentils']) })
    await db.recipes.put(soup)
    await addRecipeToGroceryList(WEEK, soup)
    await db.recipes.delete(soup.id)

    const rebuilt = await generateGroceryList(WEEK, [])

    expect(rebuilt.items).toEqual([])
  })
})
