import type {
  BudgetLevel,
  CookingMethod,
  Difficulty,
  EffortLevel,
  MealType,
  Score5,
} from './common'
import type { Nutrition, NutritionSource } from './Nutrition'

/**
 * One ingredient line.
 *
 * `originalText` is the contract with the user: parsing may be wrong, so the
 * line the recipe actually said is never overwritten or discarded. Everything
 * else is a best-effort interpretation used for grocery aggregation, scaling
 * and pantry matching.
 */
export interface RecipeIngredient {
  id: string
  originalText: string

  quantity?: number
  /** Upper bound of a range such as "2–3 cloves". */
  quantityMax?: number

  unit?: string

  ingredientName: string

  preparation?: string

  optional?: boolean

  groceryCategory?: string

  /** Section heading this line sits under, e.g. "For the sauce". */
  section?: string
}

export interface RecipeInstruction {
  id: string
  order: number
  text: string

  /** Duration detected in the step text, offered as a one-tap timer. */
  timerMinutes?: number

  referencedIngredientIds?: string[]
}

export interface Recipe {
  id: string

  title: string
  description?: string

  sourceUrl?: string
  sourceName?: string
  author?: string

  /** Remote URL or a compressed data URL for user uploads. */
  image?: string

  servings?: number

  prepTimeMinutes?: number
  cookTimeMinutes?: number
  totalTimeMinutes?: number

  ingredients: RecipeIngredient[]
  instructions: RecipeInstruction[]

  notes?: string

  tags: string[]
  categories: string[]

  equipment: string[]

  cookingMethods: CookingMethod[]

  mealTypes: MealType[]

  difficulty?: Difficulty

  /** Hands-on minutes. A slow cooker meal has a long cook time but low active time. */
  activeTimeMinutes?: number

  effort?: EffortLevel
  cleanup?: EffortLevel

  bulkScore?: Score5
  leftoverScore?: Score5
  cleanupScore?: Score5
  weeknightScore?: Score5
  reheatScore?: Score5

  freezerFriendly?: boolean
  mealPrepFriendly?: boolean
  reheatsWell?: boolean

  costTier?: BudgetLevel

  /** Per serving. Read from the site, typed in, or estimated from the ingredients. */
  nutrition?: Nutrition
  nutritionSource?: NutritionSource

  favorite: boolean

  rating?: number
  makeAgain?: boolean

  timesCooked: number
  lastCookedAt?: string

  /** Planner history, used to avoid suggesting the same things forever. */
  timesPlanned?: number
  lastPlannedAt?: string
  timesRejected?: number

  createdAt: string
  updatedAt: string
}

/** The shape the import and manual-entry flows produce before an id exists. */
export type RecipeDraft = Omit<
  Recipe,
  'id' | 'createdAt' | 'updatedAt' | 'timesCooked' | 'favorite'
> &
  Partial<Pick<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'timesCooked' | 'favorite'>>
