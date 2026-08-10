import type { PlannedMeal, Recipe, RecipeIngredient } from '@/models'
import { parseIngredient } from '@/services/ingredientParser'
import { newId } from '@/utils/id'

/** Builds ingredients the way the app does — through the real parser. */
export function ingredientsFrom(lines: string[]): RecipeIngredient[] {
  return lines.map((line) => ({ id: newId('ing'), ...parseIngredient(line) }))
}

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const now = new Date('2026-08-01T12:00:00Z').toISOString()
  return {
    id: overrides.id ?? newId('rec'),
    title: 'Test Recipe',
    servings: 4,
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    activeTimeMinutes: 15,
    ingredients: ingredientsFrom(['1 yellow onion', '2 tbsp olive oil']),
    instructions: [{ id: newId('step'), order: 1, text: 'Cook it.' }],
    tags: [],
    categories: [],
    equipment: [],
    cookingMethods: ['stovetop'],
    mealTypes: ['dinner'],
    favorite: false,
    timesCooked: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function makePlannedMeal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
  const now = new Date('2026-08-01T12:00:00Z').toISOString()
  return {
    id: overrides.id ?? newId('pm'),
    planId: 'plan_test',
    date: '2026-08-10',
    mealType: 'dinner',
    kind: 'recipe',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
