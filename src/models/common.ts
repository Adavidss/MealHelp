/** Vocabulary shared by more than one domain model. */

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  other: 'Other',
}

/**
 * Which meals a recipe written for one can stand in for.
 *
 * Meal types were a hard filter, which is wrong about how people eat:
 * yesterday's dinner is today's lunch — the planner models exactly that with
 * leftovers — and a soup written for dinner is a perfectly good lunch. The
 * effect of treating them as separate worlds was that anyone who asked the
 * planner for lunches got "nothing fit this day" every day, because almost
 * nobody tags recipes as lunches.
 *
 * Breakfast is the one that really is its own thing, so it stands alone: a
 * chili at eight in the morning is not a near miss.
 */
export const MEAL_TYPE_NEIGHBOURS: Record<MealType, MealType[]> = {
  breakfast: ['breakfast'],
  lunch: ['lunch', 'dinner', 'snack', 'other'],
  dinner: ['dinner', 'lunch', 'other'],
  snack: ['snack', 'lunch', 'breakfast', 'other'],
  other: MEAL_TYPES as unknown as MealType[],
}

/** True when a recipe written for `recipeTypes` can fill a `slot` meal. */
export function mealTypeFits(slot: MealType, recipeTypes: MealType[]): boolean {
  // A recipe that says nothing about when it is eaten fits anywhere.
  if (!recipeTypes.length) return true
  if (recipeTypes.includes(slot)) return true
  return recipeTypes.some((type) => MEAL_TYPE_NEIGHBOURS[slot]?.includes(type))
}

export const COOKING_METHODS = [
  'stovetop',
  'oven',
  'slow-cooker',
  'instant-pot',
  'air-fryer',
  'grill',
  'microwave',
  'no-cook',
  'one-pot',
  'sheet-pan',
] as const
export type CookingMethod = (typeof COOKING_METHODS)[number]

export const COOKING_METHOD_LABELS: Record<CookingMethod, string> = {
  stovetop: 'Stovetop',
  oven: 'Oven',
  'slow-cooker': 'Slow Cooker',
  'instant-pot': 'Instant Pot',
  'air-fryer': 'Air Fryer',
  grill: 'Grill',
  microwave: 'Microwave',
  'no-cook': 'No Cook',
  'one-pot': 'One Pot',
  'sheet-pan': 'Sheet Pan',
}

/**
 * Methods that depend on owning a specific appliance. The recommendation engine
 * refuses to suggest these when the user has said they do not own one.
 */
export const EQUIPMENT_DEPENDENT_METHODS: CookingMethod[] = [
  'slow-cooker',
  'instant-pot',
  'air-fryer',
  'grill',
]

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const EFFORT_LEVELS = ['very-low', 'low', 'medium', 'high'] as const
export type EffortLevel = (typeof EFFORT_LEVELS)[number]

export const EFFORT_LABELS: Record<EffortLevel, string> = {
  'very-low': 'Very low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/** Effort and cleanup are the same four-point scale, ordered for comparison. */
export const EFFORT_RANK: Record<EffortLevel, number> = {
  'very-low': 0,
  low: 1,
  medium: 2,
  high: 3,
}

export const BUDGET_LEVELS = ['$', '$$', '$$$'] as const
export type BudgetLevel = (typeof BUDGET_LEVELS)[number]

/** 1–5 subjective scales (leftovers, bulk, weeknight fit, reheating). */
export type Score5 = 1 | 2 | 3 | 4 | 5

export const GROCERY_CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Deli',
  'Bakery',
  'Frozen',
  'Pantry',
  'Canned Goods',
  'Pasta & Grains',
  'Sauces & Condiments',
  'Spices & Seasonings',
  'Snacks',
  'Beverages',
  'Household',
  'Other',
] as const
export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number]

export const COMMON_EQUIPMENT = [
  'Slow Cooker',
  'Instant Pot',
  'Air Fryer',
  'Dutch Oven',
  'Sheet Pan',
  'Blender',
  'Food Processor',
  'Stand Mixer',
  'Grill',
  'Rice Cooker',
  'Cast Iron Skillet',
  'Large Pot',
] as const

/** Cooking methods that only work if the matching appliance is owned. */
export const METHOD_EQUIPMENT: Partial<Record<CookingMethod, string>> = {
  'slow-cooker': 'Slow Cooker',
  'instant-pot': 'Instant Pot',
  'air-fryer': 'Air Fryer',
  grill: 'Grill',
}
