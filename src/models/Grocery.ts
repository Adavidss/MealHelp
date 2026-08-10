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

export interface GroceryList {
  id: string
  planId?: string
  weekStart: string
  items: GroceryItem[]
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
