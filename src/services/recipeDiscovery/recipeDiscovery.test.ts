import { describe, expect, it } from 'vitest'
import {
  composeIngredientLine,
  ingredientLinesFrom,
  mealToDraft,
  toIngredientQuery,
} from './theMealDb'
import {
  discoverByIngredients,
  isUsefulSearchIngredient,
  markAlreadySaved,
  rankByIngredientOverlap,
  suggestedSearchIngredients,
} from './discover'
import { DiscoveryError, type DiscoveryProvider, type DiscoveryResult } from './types'
import { makeRecipe } from '@/test/factories'

/** A record shaped like TheMealDB's, which is what the parser must survive. */
const MEAL = {
  idMeal: '52940',
  strMeal: 'Brown Stew Chicken',
  strCategory: 'Chicken',
  strArea: 'Jamaican',
  strMealThumb: 'https://example.com/stew.jpg',
  strTags: 'Stew,Spicy',
  strSource: 'https://example.com/brown-stew-chicken',
  strInstructions:
    'Squeeze lime over chicken.\nHeat oil in a Dutch oven.\nSimmer for 30 minutes.',
  strIngredient1: 'Chicken',
  strMeasure1: '1 whole',
  strIngredient2: 'Tomato',
  strMeasure2: '1 chopped',
  strIngredient3: 'Thyme',
  strMeasure3: '2 sprigs',
  strIngredient4: '',
  strMeasure4: '',
}

describe('ingredientLinesFrom', () => {
  it('joins the measure and the ingredient into one readable line', () => {
    expect(ingredientLinesFrom(MEAL)).toEqual([
      '1 whole Chicken',
      // "1 chopped" is a measure with a method stuck to it; the method moves.
      '1 Tomato, chopped',
      '2 sprigs Thyme',
    ])
  })

  it('stops at the first empty slot rather than emitting blanks', () => {
    expect(ingredientLinesFrom(MEAL)).toHaveLength(3)
  })

  it('keeps an ingredient that has no measure', () => {
    expect(ingredientLinesFrom({ ...MEAL, strMeasure2: '  ' })).toContain('Tomato')
  })

  it('moves a preparation word out of the measure and behind the name', () => {
    // This source writes "2 chopped" as the measure, which would otherwise make
    // "chopped garlic clove" a different grocery item from "garlic clove".
    expect(composeIngredientLine('2 chopped', 'Garlic Clove')).toBe(
      '2 Garlic Clove, chopped',
    )
    expect(composeIngredientLine('finely chopped', 'Parsley')).toBe(
      'Parsley, finely chopped',
    )
  })

  it('leaves a real unit where it is', () => {
    expect(composeIngredientLine('2 sprigs', 'Thyme')).toBe('2 sprigs Thyme')
    expect(composeIngredientLine('1 whole', 'Chicken')).toBe('1 whole Chicken')
  })

  it('parses a prep-in-measure line into the right grocery item', () => {
    const parsed = mealToDraft({
      ...MEAL,
      strIngredient2: 'Garlic Clove',
      strMeasure2: '2 chopped',
    }).ingredients[1]

    expect(parsed.ingredientName).toBe('Garlic Clove')
    expect(parsed.preparation).toBe('chopped')
  })
})

describe('mealToDraft', () => {
  it('produces a recipe MealHelp can plan and shop for', () => {
    const draft = mealToDraft(MEAL)

    expect(draft.title).toBe('Brown Stew Chicken')
    expect(draft.image).toBe('https://example.com/stew.jpg')
    expect(draft.instructions).toHaveLength(3)
    expect(draft.tags).toEqual(['stew', 'spicy'])
    expect(draft.categories).toEqual(['Chicken', 'Jamaican'])
  })

  it('parses quantities so the grocery list can add them up', () => {
    const chicken = mealToDraft(MEAL).ingredients[0]
    expect(chicken.quantity).toBe(1)
    expect(chicken.originalText).toBe('1 whole Chicken')
  })

  it('credits the original publisher rather than the API', () => {
    const draft = mealToDraft(MEAL)
    expect(draft.sourceUrl).toBe('https://example.com/brown-stew-chicken')
    expect(draft.sourceName).toBe('example.com')
  })

  it('falls back to a working link when there is no original source', () => {
    const draft = mealToDraft({ ...MEAL, strSource: '' })
    expect(draft.sourceUrl).toContain('themealdb.com')
  })

  it('detects a timer in the directions', () => {
    const simmer = mealToDraft(MEAL).instructions[2]
    expect(simmer.timerMinutes).toBe(30)
  })
})

describe('toIngredientQuery', () => {
  it('matches the format the search expects', () => {
    expect(toIngredientQuery('Chicken Breast')).toBe('chicken_breast')
    expect(toIngredientQuery('  Spinach ')).toBe('spinach')
  })
})

describe('rankByIngredientOverlap', () => {
  const hit = (id: string, title: string): DiscoveryResult => ({
    providerId: 'test',
    externalId: id,
    title,
  })

  it('puts recipes using more of your ingredients first', () => {
    const ranked = rankByIngredientOverlap([
      { ingredient: 'chicken', results: [hit('1', 'Curry'), hit('2', 'Soup')] },
      { ingredient: 'spinach', results: [hit('1', 'Curry')] },
      { ingredient: 'rice', results: [hit('1', 'Curry'), hit('3', 'Pilaf')] },
    ])

    expect(ranked[0].result.externalId).toBe('1')
    expect(ranked[0].matched).toEqual(['chicken', 'spinach', 'rice'])
    expect(ranked.map((entry) => entry.matched.length)).toEqual([3, 1, 1])
  })

  it('counts each ingredient once even if the search repeats a recipe', () => {
    const ranked = rankByIngredientOverlap([
      { ingredient: 'chicken', results: [hit('1', 'Curry'), hit('1', 'Curry')] },
    ])
    expect(ranked[0].matched).toEqual(['chicken'])
  })
})

describe('markAlreadySaved', () => {
  it('flags recipes that are already in the library', () => {
    const ranked = markAlreadySaved(
      [
        { result: { providerId: 't', externalId: '1', title: 'Brown Stew Chicken' }, matched: [] },
        { result: { providerId: 't', externalId: '2', title: 'Something New' }, matched: [] },
      ],
      [makeRecipe({ title: 'brown stew chicken' })],
    )

    expect(ranked[0].alreadySaved).toBe(true)
    expect(ranked[1].alreadySaved).toBe(false)
  })
})

describe('pantry ingredients worth searching with', () => {
  it('skips staples that would match half the database', () => {
    expect(isUsefulSearchIngredient('Salt')).toBe(false)
    expect(isUsefulSearchIngredient('olive oil')).toBe(false)
    expect(isUsefulSearchIngredient('Chicken thighs')).toBe(true)
  })

  it('filters a pantry down to useful search terms', () => {
    expect(
      suggestedSearchIngredients(['Salt', 'Chicken', 'Black pepper', 'Spinach']),
    ).toEqual(['Chicken', 'Spinach'])
  })
})

describe('discoverByIngredients', () => {
  function fakeProvider(
    byIngredient: Record<string, string[]>,
    failing: string[] = [],
  ): DiscoveryProvider {
    return {
      id: 'fake',
      label: 'Fake',
      attribution: '',
      attributionUrl: '',
      async searchByIngredient(ingredient) {
        if (failing.includes(ingredient)) throw new DiscoveryError('unreachable', 'no')
        return (byIngredient[ingredient] ?? []).map((title) => ({
          providerId: 'fake',
          externalId: title,
          title,
        }))
      },
      async searchByText() {
        return []
      },
      async random() {
        return []
      },
      async fetchRecipe() {
        throw new Error('not used')
      },
    }
  }

  it('ranks by how many of the chosen ingredients each recipe uses', async () => {
    const provider = fakeProvider({
      chicken: ['Curry', 'Soup'],
      spinach: ['Curry'],
    })
    const ranked = await discoverByIngredients(provider, ['chicken', 'spinach'], {
      minMatches: 1,
    })
    expect(ranked[0].result.title).toBe('Curry')
    expect(ranked[0].matched).toHaveLength(2)
  })

  it('keeps going when one ingredient is unknown to the provider', async () => {
    const provider = fakeProvider({ chicken: ['Curry'] }, ['zzzz'])
    const ranked = await discoverByIngredients(provider, ['chicken', 'zzzz'], {
      minMatches: 1,
    })
    expect(ranked).toHaveLength(1)
  })

  it('reports failure only when nothing could be searched at all', async () => {
    const provider = fakeProvider({}, ['chicken'])
    await expect(discoverByIngredients(provider, ['chicken'])).rejects.toBeInstanceOf(
      DiscoveryError,
    )
  })

  it('asks for nothing when no ingredients were chosen', async () => {
    const provider = fakeProvider({})
    expect(await discoverByIngredients(provider, ['  ', ''])).toEqual([])
  })

  it('caps how many ingredients one search uses', async () => {
    const asked: string[] = []
    const provider: DiscoveryProvider = {
      ...fakeProvider({}),
      async searchByIngredient(ingredient) {
        asked.push(ingredient)
        return []
      },
    }
    await discoverByIngredients(provider, [
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
    ])
    expect(asked).toHaveLength(6)
  })
})
