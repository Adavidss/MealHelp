import { db } from './database'
import { recordDeletion } from './deletions'
import type { Recipe, RecipeDraft, RecipeIngredient, RecipeInstruction } from '@/models'
import { newId, nowISO } from '@/utils/id'

/** Fills in the bookkeeping fields a draft from import or the editor lacks. */
export function materializeRecipe(draft: RecipeDraft): Recipe {
  const now = nowISO()
  return {
    favorite: false,
    timesCooked: 0,
    ...draft,
    id: draft.id ?? newId('rec'),
    tags: draft.tags ?? [],
    categories: draft.categories ?? [],
    equipment: draft.equipment ?? [],
    cookingMethods: draft.cookingMethods ?? [],
    mealTypes: draft.mealTypes?.length ? draft.mealTypes : ['dinner'],
    ingredients: (draft.ingredients ?? []).map(withIngredientId),
    instructions: (draft.instructions ?? []).map(withInstructionId),
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
  }
}

function withIngredientId(ingredient: RecipeIngredient): RecipeIngredient {
  return ingredient.id ? ingredient : { ...ingredient, id: newId('ing') }
}

function withInstructionId(
  instruction: RecipeInstruction,
  index: number,
): RecipeInstruction {
  return {
    ...instruction,
    id: instruction.id || newId('step'),
    order: instruction.order ?? index + 1,
  }
}

export async function listRecipes(): Promise<Recipe[]> {
  return db.recipes.toArray()
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id)
}

export async function getRecipes(ids: string[]): Promise<Recipe[]> {
  if (!ids.length) return []
  const found = await db.recipes.bulkGet(ids)
  return found.filter((r): r is Recipe => Boolean(r))
}

export async function saveRecipe(draft: RecipeDraft): Promise<Recipe> {
  const recipe = materializeRecipe(draft)
  await db.recipes.put(recipe)
  return recipe
}

export async function updateRecipe(
  id: string,
  patch: Partial<Recipe>,
): Promise<Recipe | undefined> {
  const existing = await db.recipes.get(id)
  if (!existing) return undefined
  const next: Recipe = { ...existing, ...patch, id, updatedAt: nowISO() }
  await db.recipes.put(next)
  return next
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id)
  await recordDeletion('recipes', id)
}

export async function toggleFavorite(id: string): Promise<void> {
  const recipe = await db.recipes.get(id)
  if (!recipe) return
  await db.recipes.update(id, {
    favorite: !recipe.favorite,
    updatedAt: nowISO(),
  })
}

/** Duplicates a recipe so an edited variant does not overwrite the original. */
export async function duplicateRecipe(id: string): Promise<Recipe | undefined> {
  const recipe = await db.recipes.get(id)
  if (!recipe) return undefined
  return saveRecipe({
    ...recipe,
    id: undefined,
    title: `${recipe.title} (copy)`,
    timesCooked: 0,
    lastCookedAt: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    ingredients: recipe.ingredients.map((i) => ({ ...i, id: newId('ing') })),
    instructions: recipe.instructions.map((s) => ({ ...s, id: newId('step') })),
  })
}
