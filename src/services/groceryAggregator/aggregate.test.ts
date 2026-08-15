import { describe, expect, it } from 'vitest'
import { aggregateGroceries, mergeGroceryLists } from './aggregate'
import { ingredientsFrom, makeRecipe } from '@/test/factories'
import type { GroceryItem, PantryItem } from '@/models'

function find(items: GroceryItem[], key: string) {
  const item = items.find((i) => i.key === key)
  if (!item) throw new Error(`no grocery item for ${key}`)
  return item
}

describe('aggregateGroceries', () => {
  it('adds the same ingredient across two recipes', () => {
    const items = aggregateGroceries({
      entries: [
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['1 yellow onion']) }) },
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['2 yellow onions']) }) },
      ],
    })

    const onions = find(items, 'yellow onion')
    expect(onions.quantities).toEqual([{ amount: 3 }])
    expect(onions.name).toBe('Yellow onions')
  })

  it('writes names the way the recipes wrote them', () => {
    const items = aggregateGroceries({
      entries: [
        {
          recipe: makeRecipe({
            ingredients: ingredientsFrom([
              '2 bay leaves',
              '1 cup breadcrumbs',
              '2 eggs',
            ]),
          }),
        },
      ],
    })

    expect(find(items, 'bay leaf').name).toBe('Bay leaves')
    expect(find(items, 'breadcrumb').name).toBe('Breadcrumbs')
    expect(find(items, 'egg').name).toBe('Eggs')
  })

  it('files cooking oil in the pantry, not with the olives', () => {
    const items = aggregateGroceries({
      entries: [
        {
          recipe: makeRecipe({
            ingredients: ingredientsFrom(['2 tbsp olive oil', '1 cup apple juice']),
          }),
        },
      ],
    })

    expect(find(items, 'olive oil').category).toBe('Pantry')
    expect(find(items, 'apple juice').category).toBe('Beverages')
  })

  it('adds compatible units', () => {
    const items = aggregateGroceries({
      entries: [
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['1 tbsp olive oil']) }) },
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['2 tbsp olive oil']) }) },
      ],
    })

    expect(find(items, 'olive oil').quantities).toEqual([{ amount: 3, unit: 'tbsp' }])
  })

  it('keeps incompatible quantities of one ingredient separate', () => {
    const items = aggregateGroceries({
      entries: [
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['1 bunch cilantro']) }) },
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['20 g cilantro']) }) },
      ],
    })

    const cilantro = find(items, 'cilantro')
    expect(cilantro.quantities).toHaveLength(2)
    expect(cilantro.quantities).toContainEqual({ amount: 1, unit: 'bunch' })
    expect(cilantro.quantities).toContainEqual({ amount: 20, unit: 'g' })
  })

  it('never merges different onions', () => {
    const items = aggregateGroceries({
      entries: [
        {
          recipe: makeRecipe({
            ingredients: ingredientsFrom([
              '1 yellow onion',
              '1 red onion',
              '2 green onions',
            ]),
          }),
        },
      ],
    })

    expect(items.filter((i) => i.key.includes('onion'))).toHaveLength(3)
  })

  it('scales quantities when cooking a different number of servings', () => {
    const recipe = makeRecipe({
      servings: 4,
      ingredients: ingredientsFrom(['2 cups rice']),
    })
    const items = aggregateGroceries({ entries: [{ recipe, servings: 8 }] })
    expect(find(items, 'rice').quantities).toEqual([{ amount: 4, unit: 'cup' }])
  })

  it('leaves out the ingredients an entry says the cook already has', () => {
    const recipe = makeRecipe({
      ingredients: ingredientsFrom(['2 cups rice', '1 tbsp olive oil', '1 lime']),
    })
    const items = aggregateGroceries({
      entries: [{ recipe, excludeIngredientIds: new Set([recipe.ingredients[1].id]) }],
    })
    expect(items.map((item) => item.key).sort()).toEqual(['lime', 'rice'])
  })

  it('records which recipes need an ingredient', () => {
    const items = aggregateGroceries({
      entries: [
        {
          recipe: makeRecipe({
            title: 'Chicken Potato Soup',
            ingredients: ingredientsFrom(['32 oz chicken broth']),
          }),
        },
        {
          recipe: makeRecipe({
            title: 'Chicken Pot Pie',
            ingredients: ingredientsFrom(['32 oz chicken broth']),
          }),
        },
      ],
    })

    const broth = find(items, 'chicken broth')
    expect(broth.sources.map((s) => s.recipeTitle)).toEqual([
      'Chicken Potato Soup',
      'Chicken Pot Pie',
    ])
    expect(broth.quantities).toEqual([{ amount: 64, unit: 'oz' }])
  })

  it('flags pantry staples instead of dropping them', () => {
    const pantry: PantryItem[] = [
      {
        id: 'p1',
        name: 'Olive oil',
        key: 'olive oil',
        category: 'Pantry',
        alwaysHave: true,
        createdAt: '',
        updatedAt: '',
      },
    ]
    const items = aggregateGroceries({
      entries: [
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['2 tbsp olive oil']) }) },
      ],
      pantry,
    })

    expect(find(items, 'olive oil').pantryStaple).toBe(true)
    expect(items).toHaveLength(1)
  })

  it('sorts items into aisles', () => {
    const items = aggregateGroceries({
      entries: [
        {
          recipe: makeRecipe({
            ingredients: ingredientsFrom(['1 tsp cumin', '1 onion', '1 lb chicken']),
          }),
        },
      ],
    })
    expect(items.map((i) => i.category)).toEqual([
      'Produce',
      'Meat & Seafood',
      'Spices & Seasonings',
    ])
  })
})

describe('mergeGroceryLists', () => {
  it('keeps checked items checked when the list is regenerated', () => {
    const previous = aggregateGroceries({
      entries: [{ recipe: makeRecipe({ ingredients: ingredientsFrom(['1 onion']) }) }],
    })
    previous[0].checked = true

    const next = aggregateGroceries({
      entries: [
        { recipe: makeRecipe({ ingredients: ingredientsFrom(['1 onion', '1 carrot']) }) },
      ],
    })

    const merged = mergeGroceryLists(previous, next)
    expect(find(merged, 'onion').checked).toBe(true)
    expect(find(merged, 'carrot').checked).toBe(false)
  })

  it('keeps hand-added items that no recipe produced', () => {
    const manual: GroceryItem = {
      id: 'm1',
      key: 'paper towel',
      name: 'Paper towels',
      quantities: [],
      category: 'Household',
      checked: false,
      manual: true,
      sources: [],
    }
    const merged = mergeGroceryLists([manual], [])
    expect(merged).toHaveLength(1)
    expect(merged[0].key).toBe('paper towel')
  })
})
