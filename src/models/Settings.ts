import type { BudgetLevel, CookingMethod, EffortLevel, MealType } from './common'
import type { VarietyMode } from './MealPlan'
import type { NutritionTargets } from './Nutrition'

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

/**
 * How a slot in the day gets filled when MealHelp plans a week.
 *
 * Not every meal is a cooking decision. Breakfast, for most people, is the
 * same thing every day and the only question it raises is whether there is
 * cereal in the cupboard; lunch is often yesterday's dinner. Making those
 * first-class stops the planner from pretending every slot needs a recipe
 * chosen for it, and stops the user from having to fill them in by hand.
 */
export type SlotFill = 'cook' | 'routine' | 'leftovers' | 'open'

export const SLOT_FILL_LABELS: Record<SlotFill, string> = {
  cook: 'Cook something',
  routine: 'The same thing every day',
  leftovers: 'Leftovers from earlier',
  open: 'Leave it to me',
}

/** The same thing every day — "a bowl of Special K", "toast and coffee". */
export interface MealRoutine {
  name: string
  /**
   * What that costs at the shop, written the way you would buy it — "1 box
   * Special K", "2 L milk". Added to the list once for the week rather than
   * once per day, because nobody buys seven boxes of cereal for seven
   * breakfasts.
   */
  groceryLines: string[]
}

export interface MealSlotConfig {
  id: string
  /** What the user calls it: "Dinner", "Second breakfast", "Post-gym". */
  label: string
  /** The underlying kind, which is what recipes are matched against. */
  type: MealType
  fill: SlotFill
  routine?: MealRoutine
  /** For `cook`: how many times a week to actually cook for this slot. */
  cookSessions?: number
  /** How many people this slot feeds; falls back to the kitchen default. */
  servings?: number
  /**
   * Days this slot happens on, 0 = Sunday. Undefined means every day — which
   * is how a big weekend breakfast differs from an everyday one.
   */
  daysOfWeek?: number[]
}

export interface Settings {
  /** Single-row table; the id is always 'settings'. */
  id: string

  /**
   * The day's slots, in the order they are eaten. Dinner alone is the common
   * case and the default; anyone who wants breakfast, two lunches or a
   * post-gym snack adds them here.
   */
  mealSlots: MealSlotConfig[]

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
   * Whether the picture gallery also shows recipes with no photograph. They are
   * never hidden outright — only folded into a section with a visible count —
   * and this remembers whether you keep it open.
   */
  showRecipesWithoutPhotos: boolean

  /**
   * Reading a recipe page from another website needs someone to fetch it, and
   * a static site cannot. These control who.
   */
  importSettings: ImportSettings

  /**
   * What money looks like here. The built-in price estimates are US dollars,
   * so changing this changes the symbol and not the numbers — which the
   * grocery estimate says plainly.
   */
  currency?: string

  /**
   * A key the user brings themselves. Nothing is shipped with the app, and the
   * key never leaves this device except to the service it belongs to.
   */
  spoonacularKey?: string

  /** Which palette, and whether to follow the system between light and dark. */
  theme?: string
  colorScheme?: 'auto' | 'light' | 'dark'

  /** Daily nutrition targets; anything unset falls back to the Daily Value. */
  nutritionTargets?: NutritionTargets

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

/** The one slot nearly everyone plans, and the only one on by default. */
export const DEFAULT_MEAL_SLOTS: MealSlotConfig[] = [
  { id: 'dinner', label: 'Dinner', type: 'dinner', fill: 'cook' },
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  mealSlots: DEFAULT_MEAL_SLOTS,
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
  showRecipesWithoutPhotos: false,
  importSettings: {
    useSharedFetchers: true,
  },
  theme: 'paper',
  colorScheme: 'auto',
  updatedAt: new Date(0).toISOString(),
}
