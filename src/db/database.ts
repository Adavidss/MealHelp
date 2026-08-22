import Dexie, { type EntityTable } from 'dexie'
import type {
  Collection,
  CookEvent,
  CookFeedback,
  GroceryList,
  MealPlan,
  NutritionLogEntry,
  PantryItem,
  PlannedMeal,
  PriceBookEntry,
  Tombstone,
  Recipe,
  Settings,
} from '@/models'
import { DEFAULT_SETTINGS, DEFAULT_MEAL_SLOTS, slotsFromMealTypes } from '@/models'

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
  priceBook!: EntityTable<PriceBookEntry, 'key'>
  /** What has been deleted, so deletions reach the other phone too. */
  deletions!: EntityTable<Tombstone, 'id'>
  feedback!: EntityTable<CookFeedback, 'id'>
  nutritionLog!: EntityTable<NutritionLogEntry, 'id'>

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

    /*
     * Version 2 adds the price book. Dexie carries every existing table
     * forward untouched, so an upgrade costs nothing and loses nothing.
     */
    this.version(2).stores({
      priceBook: 'key, updatedAt',
    })

    /*
     * Version 3 adds tombstones. Without them a recipe deleted on one phone
     * comes back the next time the other one syncs — the classic sync bug
     * that makes people stop trusting it.
     */
    this.version(3).stores({
      deletions: 'id, table, deletedAt',
    })

    // Things eaten outside the plan, for the nutrition overview.
    this.version(2).stores({
      nutritionLog: 'id, date, createdAt',
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
  'nutritionLog',
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
    // Settings written before slots existed carry visibleMealTypes instead.
    mealSlots: stored.mealSlots?.length
      ? stored.mealSlots
      : legacyMealTypes(stored) ?? DEFAULT_MEAL_SLOTS,
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

/** Reads the pre-slots shape off a stored settings row, if it is there. */
function legacyMealTypes(stored: unknown) {
  const types = (stored as { visibleMealTypes?: unknown }).visibleMealTypes
  return Array.isArray(types) && types.length ? slotsFromMealTypes(types) : undefined
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
