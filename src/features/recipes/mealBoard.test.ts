import { describe, expect, it } from 'vitest'
import { mealBadges } from './mealBadges'
import { MOODS, applyMood, moodById, pantryCoverage } from './moods'
import { ingredientsFrom, makeRecipe } from '@/test/factories'

describe('mealBadges', () => {
  it('leads with the real number of minutes, not the word "quick"', () => {
    const recipe = makeRecipe({ activeTimeMinutes: 22, cookingMethods: ['stovetop'] })
    expect(mealBadges(recipe)[0]).toMatchObject({ tone: 'time', label: '20 min' })
  })

  it('says nothing about time when a recipe is not quick', () => {
    const recipe = makeRecipe({ activeTimeMinutes: 75, cookingMethods: ['stovetop'] })
    expect(mealBadges(recipe).some((badge) => badge.tone === 'time')).toBe(false)
  })

  /**
   * A card is a photograph with a few words on it. Three appliance badges that
   * all mean "one pan" would spend the whole budget saying one thing.
   */
  it('never spends two badges on the same kind of fact', () => {
    const recipe = makeRecipe({
      cookingMethods: ['slow-cooker', 'one-pot'],
      leftoverScore: 5,
      freezerFriendly: true,
    })
    const badges = mealBadges(recipe)
    expect(badges.map((badge) => badge.tone)).toEqual([...new Set(badges.map((b) => b.tone))])
    expect(badges).toHaveLength(3)
  })

  it('calls a recipe high protein only when its own numbers say so', () => {
    const guessy = makeRecipe({ cookingMethods: ['stovetop'], activeTimeMinutes: 60 })
    const known = makeRecipe({
      cookingMethods: ['stovetop'],
      activeTimeMinutes: 60,
      nutrition: { calories: 520, protein: 38 },
    })
    expect(mealBadges(guessy).some((b) => b.id === 'protein')).toBe(false)
    expect(mealBadges(known).some((b) => b.label === 'High protein')).toBe(true)
  })
})

describe('moods', () => {
  const stew = makeRecipe({ id: 'stew', title: 'Beef Stew', cookTimeMinutes: 180, cookingMethods: ['slow-cooker'] })
  const salad = makeRecipe({
    id: 'salad',
    title: 'Chopped Salad',
    cookTimeMinutes: 0,
    activeTimeMinutes: 10,
    cookingMethods: ['no-cook'],
  })

  it('sorts a stew into comforting and a salad into fresh, and not the other way about', () => {
    expect(applyMood([stew, salad], 'comforting').map((r) => r.id)).toEqual(['stew'])
    expect(applyMood([stew, salad], 'fresh').map((r) => r.id)).toEqual(['salad'])
  })

  it('ranks "use what I have" by how much of it you already have', () => {
    const covered = makeRecipe({ id: 'covered', ingredients: ingredientsFrom(['1 cup rice', '2 eggs']) })
    const partial = makeRecipe({
      id: 'partial',
      ingredients: ingredientsFrom(['1 cup rice', '1 lb prawns', '1 mango']),
    })
    const unrelated = makeRecipe({ id: 'unrelated', ingredients: ingredientsFrom(['1 lb beef']) })

    const ranked = applyMood([unrelated, partial, covered], 'pantry', {
      pantryKeys: new Set(['rice', 'eggs']),
    })

    expect(ranked.map((r) => r.id)).toEqual(['covered', 'partial'])
    expect(pantryCoverage(covered, new Set(['rice', 'eggs']))).toBe(1)
  })

  it('puts what you have never cooked at the front of "something different"', () => {
    const often = makeRecipe({
      id: 'often',
      timesCooked: 9,
      lastCookedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    })
    const never = makeRecipe({ id: 'never', timesCooked: 0 })
    expect(applyMood([often, never], 'different')[0].id).toBe('never')
  })

  it('shows everything when no mood is chosen, and for a mood that no longer exists', () => {
    expect(applyMood([stew, salad], undefined)).toHaveLength(2)
    expect(applyMood([stew, salad], 'retired-mood')).toHaveLength(2)
  })

  it('offers "use what I have" nothing to say when the pantry is empty', () => {
    expect(applyMood([stew, salad], 'pantry', { pantryKeys: new Set() })).toEqual([])
  })

  it('gives every mood a label and a blurb, because each one is a row heading', () => {
    for (const mood of MOODS) {
      expect(moodById(mood.id)).toBe(mood)
      expect(mood.label.length).toBeGreaterThan(2)
      expect(mood.blurb.length).toBeGreaterThan(5)
    }
  })
})
