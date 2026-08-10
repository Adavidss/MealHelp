import { describe, expect, it } from 'vitest'
import { rankRecipes, scoreRecipe } from './score'
import { findAlternatives, matchByIngredients } from './similar'
import { ingredientsFrom, makeRecipe } from '@/test/factories'

describe('scoreRecipe', () => {
  it('rewards a preferred cooking method', () => {
    const slowCooker = makeRecipe({ cookingMethods: ['slow-cooker'] })
    const stovetop = makeRecipe({ cookingMethods: ['stovetop'] })

    const a = scoreRecipe(slowCooker, { preferredMethods: ['slow-cooker'] })
    const b = scoreRecipe(stovetop, { preferredMethods: ['slow-cooker'] })

    expect(a.score).toBeGreaterThan(b.score)
    expect(a.reasons.join(' ')).toMatch(/slow cooker/i)
  })

  it('penalises a 90-minute recipe on a busy night', () => {
    const long = makeRecipe({ activeTimeMinutes: 90 })
    const quick = makeRecipe({ activeTimeMinutes: 15 })

    const longScore = scoreRecipe(long, { dayLoad: 'busy' }).score
    const quickScore = scoreRecipe(quick, { dayLoad: 'busy' }).score

    expect(longScore).toBeLessThan(quickScore)
    expect(longScore).toBeLessThan(0)
  })

  it('pushes down something cooked two days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const recent = makeRecipe({ lastCookedAt: twoDaysAgo, timesCooked: 1 })
    const old = makeRecipe({
      lastCookedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      timesCooked: 1,
    })

    expect(scoreRecipe(recent, {}).score).toBeLessThan(scoreRecipe(old, {}).score)
  })

  it('says how long it has been since a recipe was cooked', () => {
    const old = makeRecipe({
      lastCookedAt: new Date(Date.now() - 42 * 86_400_000).toISOString(),
      timesCooked: 2,
    })
    expect(scoreRecipe(old, {}).reasons.join(' ')).toMatch(/6 weeks ago/)
  })

  it('drops a recipe marked "do not make again" far down the list', () => {
    const rejected = makeRecipe({ makeAgain: false, rating: 1 })
    const normal = makeRecipe({})
    expect(scoreRecipe(rejected, {}).score).toBeLessThan(scoreRecipe(normal, {}).score - 30)
  })

  it('refuses to suggest a recipe needing equipment the user does not own', () => {
    const instantPot = makeRecipe({ cookingMethods: ['instant-pot'] })
    const scored = scoreRecipe(instantPot, { equipmentOwned: ['Large Pot'] })
    expect(scored.excluded).toMatch(/instant pot/i)
  })

  it('keeps a breakfast recipe out of a dinner slot', () => {
    const breakfast = makeRecipe({ mealTypes: ['breakfast'] })
    expect(scoreRecipe(breakfast, { mealType: 'dinner' }).excluded).toBeTruthy()
  })

  it('prefers a big-batch recipe when leftovers are wanted', () => {
    const big = makeRecipe({ servings: 8, leftoverScore: 5 })
    const small = makeRecipe({ servings: 2, leftoverScore: 2 })
    const context = { preferLeftovers: true }
    expect(scoreRecipe(big, context).score).toBeGreaterThan(
      scoreRecipe(small, context).score,
    )
  })

  it('boosts a recipe that uses up an ingredient the user named', () => {
    const spinach = makeRecipe({
      ingredients: ingredientsFrom(['2 cups spinach', '1 lb chicken']),
    })
    const plain = makeRecipe({ ingredients: ingredientsFrom(['1 lb chicken']) })
    const context = { useUpIngredients: ['spinach'] }

    expect(scoreRecipe(spinach, context).score).toBeGreaterThan(
      scoreRecipe(plain, context).score,
    )
    expect(scoreRecipe(spinach, context).reasons.join(' ')).toMatch(/spinach/)
  })
})

describe('rankRecipes', () => {
  it('sorts best first and removes unusable recipes', () => {
    const ranked = rankRecipes(
      [
        makeRecipe({ id: 'a', rating: 2 }),
        makeRecipe({ id: 'b', rating: 5, favorite: true }),
        makeRecipe({ id: 'c', mealTypes: ['breakfast'] }),
      ],
      { mealType: 'dinner' },
    )

    expect(ranked.map((r) => r.recipe.id)).toEqual(['b', 'a'])
  })
})

describe('findAlternatives', () => {
  it('prefers a replacement with the same effort and yield', () => {
    const target = makeRecipe({
      id: 'target',
      servings: 6,
      activeTimeMinutes: 20,
      cookingMethods: ['slow-cooker'],
      ingredients: ingredientsFrom(['1 onion', '1 lb chicken', '2 cups stock']),
    })
    const similar = makeRecipe({
      id: 'similar',
      servings: 6,
      activeTimeMinutes: 20,
      cookingMethods: ['slow-cooker'],
      ingredients: ingredientsFrom(['1 onion', '1 lb chicken', '1 cup stock']),
    })
    const different = makeRecipe({
      id: 'different',
      servings: 2,
      activeTimeMinutes: 90,
      cookingMethods: ['grill'],
      ingredients: ingredientsFrom(['1 steak']),
    })

    const results = findAlternatives(target, [similar, different])
    expect(results[0].recipe.id).toBe('similar')
  })
})

describe('matchByIngredients', () => {
  it('ranks by how much of the recipe is already covered', () => {
    const covered = makeRecipe({
      id: 'covered',
      ingredients: ingredientsFrom(['1 lb chicken', '2 cups spinach', '1 cup rice']),
    })
    const partial = makeRecipe({
      id: 'partial',
      ingredients: ingredientsFrom([
        '1 lb chicken',
        '1 can tomatoes',
        '1 onion',
        '2 tbsp cream',
      ]),
    })

    const matches = matchByIngredients(
      [covered, partial],
      ['chicken', 'spinach', 'rice'],
      { minCoverage: 0.2 },
    )
    expect(matches[0].recipe.id).toBe('covered')
    expect(matches[0].coverage).toBe(1)
    expect(matches[1].missing.length).toBeGreaterThan(0)
  })

  it('hides recipes it would only be guessing about', () => {
    const barelyRelated = makeRecipe({
      ingredients: ingredientsFrom([
        '1 lb chicken',
        '1 can tomatoes',
        '1 onion',
        '2 tbsp cream',
      ]),
    })
    expect(matchByIngredients([barelyRelated], ['chicken'])).toHaveLength(0)
  })
})
