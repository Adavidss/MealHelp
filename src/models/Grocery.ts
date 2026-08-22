import type { GroceryCategory } from './common'

/**
 * A quantity that survived parsing. Amounts only ever combine with amounts in a
 * compatible unit — "1 bunch" and "20 g" stay as two entries rather than
 * becoming one invented number.
 */
export interface GroceryQuantity {
  amount?: number
  unit?: string
  /** Set when the source line had no parseable number at all ("a pinch"). */
  freeform?: string
}

export interface GrocerySource {
  recipeId?: string
  recipeTitle: string
  originalText: string
  /** Date the meal is planned for, so the list can explain "for Wednesday". */
  date?: string
}

export interface GroceryItem {
  id: string
  /** Normalized identity used for merging: "yellow onion". */
  key: string
  /** What the list shows: "Yellow onions". */
  name: string

  quantities: GroceryQuantity[]

  category: GroceryCategory

  checked: boolean

  /** Added by hand rather than derived from a recipe. */
  manual?: boolean

  /**
   * Matches a pantry staple. These are moved to a "Check pantry" section
   * instead of being silently dropped from the list.
   */
  pantryStaple?: boolean
  /** User confirmed they already have it. */
  haveIt?: boolean

  optional?: boolean

  sources: GrocerySource[]

  note?: string
}

/**
 * A recipe shopped for on its own, outside the week's plan — "I want to make
 * this too". Kept on the list rather than flattened into items so that
 * rebuilding the list from the plan keeps it, and so its quantities merge
 * with the plan's ("1 onion + 2 onions") instead of sitting beside them.
 */
export interface GroceryExtra {
  recipeId: string
  /** The title as it was when added, in case the recipe is later deleted. */
  recipeTitle: string
  /** Servings to shop for; scales the recipe when it differs from its own. */
  servings?: number
  /** Ingredients left off on purpose — already in the cupboard. */
  excludedIngredientIds?: string[]
  addedAt: string
}

export interface GroceryList {
  id: string
  planId?: string
  weekStart: string
  items: GroceryItem[]
  /** Recipes added to this week's shopping by hand, beyond the plan. */
  extras?: GroceryExtra[]
  /** Custom store order; falls back to the default category order. */
  categoryOrder?: string[]
  generatedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PantryItem {
  id: string
  name: string
  /** Same normalization the grocery aggregator uses, so matching is exact. */
  key: string
  category: GroceryCategory
  /** "I always have this" — the reason it gets pulled out of the main list. */
  alwaysHave: boolean
  note?: string
  createdAt: string
  updatedAt: string
}

export interface Collection {
  id: string
  name: string
  description?: string
  emoji?: string
  recipeIds: string[]
  createdAt: string
  updatedAt: string
}

/**
 * A price the shopper corrected, kept by ingredient so it applies to every
 * list from then on. Typical prices are a starting point; this is what things
 * cost where they actually shop.
 */
export interface PriceBookEntry {
  /** Normalised ingredient key, as used by the grocery aggregator. */
  key: string
  price: number
  /** The unit that price buys — "lb", "each", "fl oz". */
  unit: string
  updatedAt: string
}
