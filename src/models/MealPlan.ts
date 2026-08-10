import type { BudgetLevel, CookingMethod, EffortLevel, MealType } from './common'

/** A week of planning. Days hang off it by ISO date. */
export interface MealPlan {
  id: string
  /** ISO date (YYYY-MM-DD) of the first day of the week. */
  weekStart: string
  title?: string
  notes?: string
  /** Set when the user accepts a generated plan; drafts stay unaccepted. */
  acceptedAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * How a slot gets filled. Keeping these apart matters for groceries: only
 * `recipe` slots contribute ingredients, because leftovers were already bought
 * for on the day they were cooked.
 */
export type PlannedMealKind = 'recipe' | 'leftover' | 'custom' | 'eating-out' | 'skip'

export interface PlannedMeal {
  id: string
  planId: string

  /** ISO date (YYYY-MM-DD). */
  date: string

  mealType: MealType

  kind: PlannedMealKind

  recipeId?: string

  customName?: string

  servings?: number

  /** For leftovers: the cook session those servings came from. */
  sourceCookEventId?: string
  /** For planned leftovers before anything is actually cooked. */
  sourcePlannedMealId?: string

  isLeftover?: boolean

  notes?: string

  /** Survives regeneration in the Plan My Week flow. */
  locked?: boolean

  /** Why the generator chose this, shown in the plan preview. */
  reasons?: string[]

  order?: number

  createdAt: string
  updatedAt: string
}

/**
 * One act of cooking. Leftovers are tracked here rather than on the recipe so
 * that "4 servings of curry in the fridge" is a fact about Monday night, not
 * about the curry recipe forever.
 */
export interface CookEvent {
  id: string
  recipeId: string
  /** ISO date. */
  date: string
  recipeTitle: string

  servingsMade: number
  servingsConsumed: number
  remainingServings: number

  plannedMealId?: string
  notes?: string

  createdAt: string
  updatedAt: string
}

export const FEEDBACK_VERDICTS = ['loved', 'good', 'okay', 'never-again'] as const
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number]

export const FEEDBACK_VERDICT_LABELS: Record<FeedbackVerdict, string> = {
  loved: 'Loved it',
  good: 'Good',
  okay: 'Okay',
  'never-again': "Don't make again",
}

export const FEEDBACK_TAGS = [
  'great-leftovers',
  'too-much-work',
  'easy',
  'too-expensive',
  'took-longer',
] as const
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number]

export const FEEDBACK_TAG_LABELS: Record<FeedbackTag, string> = {
  'great-leftovers': 'Great leftovers',
  'too-much-work': 'Too much work',
  easy: 'Easy',
  'too-expensive': 'Too expensive',
  'took-longer': 'Took longer than expected',
}

export interface CookFeedback {
  id: string
  recipeId: string
  cookEventId?: string
  date: string
  verdict?: FeedbackVerdict
  rating?: number
  tags: FeedbackTag[]
  note?: string
  createdAt: string
}

export const VARIETY_MODES = [
  'mostly-favorites',
  'mixed',
  'try-new',
  'avoid-recent',
] as const
export type VarietyMode = (typeof VARIETY_MODES)[number]

export const VARIETY_LABELS: Record<VarietyMode, string> = {
  'mostly-favorites': 'Mostly favorites',
  mixed: 'Mix of favorites and new',
  'try-new': 'Try new recipes',
  'avoid-recent': 'Avoid anything recent',
}

/** How much cooking a given day can absorb. */
export const DAY_LOADS = ['normal', 'busy', 'minimal', 'free'] as const
export type DayLoad = (typeof DAY_LOADS)[number]

export const DAY_LOAD_LABELS: Record<DayLoad, string> = {
  free: 'Time to cook',
  normal: 'Normal',
  busy: 'Very busy',
  minimal: 'Minimal effort',
}

/** Active-minute ceiling implied by a day's load. */
export const DAY_LOAD_ACTIVE_LIMIT: Record<DayLoad, number> = {
  free: 999,
  normal: 60,
  busy: 30,
  minimal: 20,
}

/** The structured request handed to the planner engine. */
export interface PlanningRequest {
  startDate: string
  /** Which days of the week the plan covers, as ISO dates. */
  dates: string[]

  mealType: MealType

  mealsNeeded: number

  allowedCookingDays?: string[]

  targetCookSessions?: number

  preferLeftovers?: boolean

  preferredCookingMethods?: CookingMethod[]

  maxActiveTimeMinutes?: number

  preferredEffort?: EffortLevel

  budgetPreference?: BudgetLevel

  usePantryFirst?: boolean

  avoidRecentlyCooked?: boolean

  variety?: VarietyMode

  /** Per-date busyness, keyed by ISO date. */
  dayLoads?: Record<string, DayLoad>

  /** Slots the user pinned; regeneration leaves these alone. */
  lockedMeals?: PlannedMeal[]

  servingsPerMeal?: number

  /** Ingredients the user wants used up this week. */
  useUpIngredients?: string[]

  requiredMethods?: CookingMethod[]
}
