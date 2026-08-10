import type { RecipeDraft } from '@/models'

/**
 * Finding recipes that are not yet in your library.
 *
 * This is the one part of MealHelp that talks to the internet, and it is
 * deliberately optional: everything else — planning, groceries, cooking —
 * works with no network at all. Discovery is a way to *get* recipes, so when
 * it is unreachable the app says so and points at the paste importer rather
 * than pretending to be broken.
 *
 * The provider interface exists for the same reason the import adapters do:
 * the source of recipes should be replaceable without touching a screen.
 */

/** A search hit. Cheap to list; the full recipe is fetched only when opened. */
export interface DiscoveryResult {
  providerId: string
  externalId: string
  title: string
  image?: string
  category?: string
  cuisine?: string
  sourceUrl?: string
}

/** A hit plus which of the user's ingredients it turned out to use. */
export interface RankedDiscovery {
  result: DiscoveryResult
  matched: string[]
  /** True when a recipe with this title is already saved. */
  alreadySaved?: boolean
}

export interface DiscoveryProvider {
  id: string
  label: string
  /** Shown to the user; these results are somebody else's work. */
  attribution: string
  attributionUrl: string

  searchByText(query: string, signal?: AbortSignal): Promise<DiscoveryResult[]>
  searchByIngredient(ingredient: string, signal?: AbortSignal): Promise<DiscoveryResult[]>
  random(signal?: AbortSignal): Promise<DiscoveryResult[]>
  /** The full recipe, converted into a draft ready for the preview screen. */
  fetchRecipe(externalId: string, signal?: AbortSignal): Promise<RecipeDraft>
}

export type DiscoveryFailure = 'offline' | 'unreachable' | 'empty'

export class DiscoveryError extends Error {
  kind: DiscoveryFailure
  suggestion?: string

  constructor(kind: DiscoveryFailure, message: string, suggestion?: string) {
    super(message)
    this.name = 'DiscoveryError'
    this.kind = kind
    this.suggestion = suggestion
  }
}

export const OFFLINE_MESSAGE =
  'Finding new recipes needs a connection. Everything already saved — your recipes, this week, the grocery list — still works without one.'
