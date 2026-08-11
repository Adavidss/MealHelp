import type { BudgetLevel, CookingMethod, EffortLevel, MealType } from './common'
import type { VarietyMode } from './MealPlan'

export interface PlanningDefaults {
  mealsNeeded: number
  targetCookSessions: number
  preferLeftovers: boolean
  preferredMethods: CookingMethod[]
  preferredEffort?: EffortLevel
  budgetPreference?: BudgetLevel
  variety: VarietyMode
  usePantryFirst: boolean
  avoidRecentlyCooked: boolean
  servingsPerMeal: number
}

export interface PrintOptions {
  includeMealQr: boolean
  includeGroceryQr: boolean
  includeNotes: boolean
  includeBreakfast: boolean
  includeLunch: boolean
  includeDinner: boolean
  compact: boolean
  largeText: boolean
}

export interface Settings {
  /** Single-row table; the id is always 'settings'. */
  id: string

  /** Meal types the planner shows. Dinner-only is the common case. */
  visibleMealTypes: MealType[]

  equipmentOwned: string[]

  defaultServings: number

  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1

  hideCompletedGrocery: boolean

  groceryCategoryOrder?: string[]

  planningDefaults: PlanningDefaults

  printOptions: PrintOptions

  /** Days within which a repeat is penalised hard, then softly. */
  recentlyCookedHardDays: number
  recentlyCookedSoftDays: number

  keepScreenAwakeWhileCooking: boolean

  /**
   * Reading a recipe page from another website needs someone to fetch it, and
   * a static site cannot. These control who.
   */
  importSettings: ImportSettings

  /**
   * A key the user brings themselves. Nothing is shipped with the app, and the
   * key never leaves this device except to the service it belongs to.
   */
  spoonacularKey?: string

  onboardedAt?: string
  updatedAt: string
}

export interface ImportSettings {
  /**
   * The user's own fetcher, e.g. a Cloudflare Worker. Tried before anything
   * public, because it is theirs: no stranger sees the pages they read.
   */
  proxyUrl?: string

  /**
   * Fall back to shared public fetchers when there is no proxy of their own.
   * Convenient, and the honest cost is that a third party sees the URL — which
   * is why it can be turned off.
   */
  useSharedFetchers: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  visibleMealTypes: ['dinner'],
  equipmentOwned: ['Slow Cooker', 'Instant Pot', 'Sheet Pan', 'Large Pot'],
  defaultServings: 4,
  weekStartsOn: 1,
  hideCompletedGrocery: false,
  planningDefaults: {
    mealsNeeded: 5,
    targetCookSessions: 3,
    preferLeftovers: true,
    preferredMethods: [],
    variety: 'mixed',
    usePantryFirst: false,
    avoidRecentlyCooked: true,
    servingsPerMeal: 4,
  },
  printOptions: {
    includeMealQr: true,
    includeGroceryQr: true,
    includeNotes: false,
    includeBreakfast: false,
    includeLunch: false,
    includeDinner: true,
    compact: false,
    largeText: false,
  },
  recentlyCookedHardDays: 7,
  recentlyCookedSoftDays: 30,
  keepScreenAwakeWhileCooking: true,
  importSettings: {
    useSharedFetchers: true,
  },
  updatedAt: new Date(0).toISOString(),
}
