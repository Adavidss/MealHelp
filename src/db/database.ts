import Dexie, { type EntityTable } from 'dexie'
import type {
  Collection,
  CookEvent,
  CookFeedback,
  GroceryList,
  MealPlan,
  PantryItem,
  PlannedMeal,
  Recipe,
  Settings,
} from '@/models'
import { DEFAULT_SETTINGS } from '@/models'

/**
 * IndexedDB cannot use booleans as keys, so `favorite` and friends are filtered
 * in memory rather than indexed. A library of a few thousand recipes filters in
 * well under a frame, and it keeps the schema from growing shadow columns.
 */
export class MealHelpDatabase extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>
  mealPlans!: EntityTable<MealPlan, 'id'>
  plannedMeals!: EntityTable<PlannedMeal, 'id'>
  cookEvents!: EntityTable<CookEvent, 'id'>
  groceryLists!: EntityTable<GroceryList, 'id'>
  pantryItems!: EntityTable<PantryItem, 'id'>
  collections!: EntityTable<Collection, 'id'>
  settings!: EntityTable<Settings, 'id'>
  feedback!: EntityTable<CookFeedback, 'id'>

  constructor(name = 'mealhelp') {
    super(name)

    this.version(1).stores({
      recipes:
        'id, title, createdAt, updatedAt, lastCookedAt, timesCooked, rating, *tags, *cookingMethods, *mealTypes, *categories',
      mealPlans: 'id, weekStart, updatedAt, acceptedAt',
      plannedMeals: 'id, planId, date, mealType, recipeId, [planId+date]',
      cookEvents: 'id, recipeId, date, plannedMealId',
      groceryLists: 'id, planId, weekStart, updatedAt',
      pantryItems: 'id, key, name, category',
      collections: 'id, name, updatedAt',
      settings: 'id',
      feedback: 'id, recipeId, date',
    })
  }
}

export const db = new MealHelpDatabase()

/** Every table, for backup and for the "delete everything" path. */
export const ALL_TABLE_NAMES = [
  'recipes',
  'mealPlans',
  'plannedMeals',
  'cookEvents',
  'groceryLists',
  'pantryItems',
  'collections',
  'settings',
  'feedback',
] as const

export type TableName = (typeof ALL_TABLE_NAMES)[number]

/**
 * Reads settings, writing the defaults on first run. Callers can rely on a
 * fully populated object, including keys added by later versions of the app.
 */
export async function loadSettings(): Promise<Settings> {
  const stored = await db.settings.get(DEFAULT_SETTINGS.id)
  if (!stored) {
    const fresh = { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() }
    await db.settings.put(fresh)
    return fresh
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    planningDefaults: {
      ...DEFAULT_SETTINGS.planningDefaults,
      ...stored.planningDefaults,
    },
    printOptions: { ...DEFAULT_SETTINGS.printOptions, ...stored.printOptions },
    importSettings: {
      ...DEFAULT_SETTINGS.importSettings,
      ...stored.importSettings,
    },
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings()
  const next: Settings = {
    ...current,
    ...patch,
    id: DEFAULT_SETTINGS.id,
    updatedAt: new Date().toISOString(),
  }
  await db.settings.put(next)
  return next
}
