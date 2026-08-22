import { describe, expect, it } from 'vitest'
import { parseSchemaNutrition } from './parseSchemaNutrition'
import { estimateNutrition, findFood, gramsOf } from './estimate'
import { dayTotals, resolveTargets, percentOfTarget } from './sum'
import { nutritionFromProduct } from './openFoodFacts'
import { ingredientsFrom, makePlannedMeal, makeRecipe } from '@/test/factories'

describe('parseSchemaNutrition', () => {
  it('reads the numbers out of the strings sites publish', () => {
    const parsed = parseSchemaNutrition({
      '@type': 'NutritionInformation',
      calories: '250 calories',
      proteinContent: '12 g',
      carbohydrateContent: '30g',
      fatContent: '1,5 g',
      sodiumContent: '450 mg',
      fiberContent: '4 grams',
    })
    expect(parsed).toEqual({ calories: 250, protein: 12, carbs: 30, fat: 1.5, sodium: 450, fiber: 4 })
  })

  it('turns sodium written in grams into milligrams, and kJ into kcal', () => {
    const parsed = parseSchemaNutrition({ calories: '1046 kJ', sodiumContent: '0.45 g' })
    expect(parsed).toEqual({ calories: 250, sodium: 450 })
  })

  it('returns nothing for a page with no numbers', () => {
    expect(parseSchemaNutrition({ '@type': 'NutritionInformation' })).toBeUndefined()
    expect(parseSchemaNutrition(undefined)).toBeUndefined()
  })
})

describe('estimateNutrition', () => {
  it('recognises foods and weighs them by their own density', () => {
    expect(findFood('boneless skinless chicken thighs')?.match[0]).toBe('chicken thigh')
    expect(findFood('low-sodium chicken stock')?.match[0]).toBe('chicken stock')

    const flour = findFood('all-purpose flour')!
    const cup = ingredientsFrom(['1 cup all-purpose flour'])[0]
    expect(gramsOf(cup, flour)).toBeCloseTo(125, 0)

    const oil = findFood('olive oil')!
    const tbsp = ingredientsFrom(['2 tbsp olive oil'])[0]
    expect(gramsOf(tbsp, oil)).toBeCloseTo(27, 0)

    const eggs = ingredientsFrom(['2 eggs'])[0]
    expect(gramsOf(eggs, findFood('eggs')!)).toBe(100)
  })

  it('adds a recipe up per serving and says how much it could count', () => {
    const recipe = makeRecipe({
      servings: 4,
      ingredients: ingredientsFrom([
        '1 lb ground beef',
        '1 yellow onion',
        '2 tbsp olive oil',
        '1 can crushed tomatoes',
        '1 pinch unicorn dust',
      ]),
    })
    const estimate = estimateNutrition(recipe)
    expect(estimate.total).toBe(5)
    expect(estimate.matched).toBe(4)
    expect(estimate.unmatched).toEqual(['unicorn dust'])
    // 454 g beef ≈ 976 kcal, onion 44, oil 239, tomatoes 128 → ~1390 / 4
    expect(estimate.perServing.calories).toBeGreaterThan(300)
    expect(estimate.perServing.calories).toBeLessThan(400)
    expect(estimate.perServing.protein).toBeGreaterThan(20)
  })
})

describe('dayTotals', () => {
  it('counts each planned meal as one serving, logs by quantity, and lists what it could not count', () => {
    const curry = makeRecipe({ id: 'curry', nutrition: { calories: 500, protein: 30 } })
    const mystery = makeRecipe({ id: 'mystery', title: 'Mystery' })
    const recipes = new Map([[curry.id, curry], [mystery.id, mystery]])
    const meals = [
      makePlannedMeal({ date: '2026-08-17', recipeId: 'curry', kind: 'recipe', servings: 6 }),
      makePlannedMeal({ date: '2026-08-17', recipeId: 'mystery', kind: 'recipe' }),
      makePlannedMeal({ date: '2026-08-18', recipeId: 'curry', kind: 'leftover' }),
    ]
    const log = [
      { id: 'l1', date: '2026-08-17', name: 'Latte', quantity: 2, nutrition: { calories: 120, protein: 6 }, createdAt: '' },
    ]

    const day = dayTotals('2026-08-17', meals, recipes, log)
    expect(day.total.calories).toBe(740)
    expect(day.total.protein).toBe(42)
    expect(day.uncounted).toBe(1)
    expect(day.contributions.find((c) => c.label === 'Mystery')?.missing).toBe(true)
  })

  it('measures against the Daily Value unless the user set their own', () => {
    const targets = resolveTargets({ calories: 1800 })
    expect(targets.calories).toBe(1800)
    expect(targets.protein).toBe(50)
    expect(percentOfTarget(900, 1800)).toBe(50)
  })
})

describe('Open Food Facts', () => {
  it('prefers per-serving figures and converts sodium to mg', () => {
    const hit = nutritionFromProduct({
      code: '1',
      product_name: 'Oat drink',
      brands: 'Oatly, Oatly AB',
      serving_size: '250 ml',
      nutriments: { 'energy-kcal_serving': 115, proteins_serving: 2.5, carbohydrates_serving: 16.5, fat_serving: 3.8, sodium_serving: 0.1 },
    })
    expect(hit).toMatchObject({ name: 'Oat drink', brand: 'Oatly', basis: 'serving', servingSize: '250 ml' })
    expect(hit?.nutrition).toEqual({ calories: 115, protein: 2.5, carbs: 16.5, fat: 3.8, sodium: 100 })
  })

  it('falls back to per 100 g', () => {
    const hit = nutritionFromProduct({ product_name: 'Peanut butter', nutriments: { 'energy-kcal_100g': 588, proteins_100g: 25 } })
    expect(hit?.basis).toBe('100g')
    expect(hit?.nutrition.calories).toBe(588)
  })
})
