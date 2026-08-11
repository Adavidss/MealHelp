import type { Recipe } from '@/models'
import { characteristicById, filterByCharacteristics } from './characteristics'

/**
 * The shelves the library opens on.
 *
 * Each is nothing more than a saved combination of the characteristics the app
 * already works out, so a shelf and the filter chips can never disagree about
 * what belongs on it — and "See all" is just those chips switched on.
 *
 * Adding a shelf is one entry here.
 */
export interface BrowseSectionDefinition {
  id: string
  title: string
  /** One line under the heading, saying why these belong together. */
  blurb: string
  /** Characteristic ids a recipe must match all of. */
  characteristics: string[]
}

export const BROWSE_SECTIONS: BrowseSectionDefinition[] = [
  {
    id: 'easy-crock-pot',
    title: 'Easy Crock-Pot meals',
    blurb: 'Load it in the morning, forget about it',
    characteristics: ['slow-cooker', 'simple'],
  },
  {
    id: 'easy-instant-pot',
    title: 'Easy Instant Pot meals',
    blurb: 'Dinner out of a cold start, fast',
    characteristics: ['instant-pot', 'simple'],
  },
  {
    id: 'one-pot',
    title: 'One pot meals',
    blurb: 'Everything in together, one thing to wash',
    characteristics: ['one-pot'],
  },
]

export interface BrowseSection extends BrowseSectionDefinition {
  recipes: Recipe[]
}

/**
 * Builds the shelves, dropping any that would be empty.
 *
 * A recipe can appear on more than one — a one-pot Instant Pot stew belongs on
 * both, and hiding it from one of them to avoid the repeat would make the
 * shelves lie about what they contain.
 */
export function buildBrowseSections(
  recipes: Recipe[],
  options: { limit?: number } = {},
): BrowseSection[] {
  const { limit = 12 } = options

  return BROWSE_SECTIONS.map((definition) => ({
    ...definition,
    recipes: filterByCharacteristics(recipes, definition.characteristics).slice(0, limit),
  })).filter((section) => section.recipes.length > 0)
}

/** How many recipes a shelf would hold in full, for its "See all" count. */
export function sectionTotal(
  recipes: Recipe[],
  definition: BrowseSectionDefinition,
): number {
  return filterByCharacteristics(recipes, definition.characteristics).length
}

/** The words a shelf is built from, for describing it to the user. */
export function sectionLabels(definition: BrowseSectionDefinition): string[] {
  return definition.characteristics
    .map((id) => characteristicById(id)?.label)
    .filter((label): label is string => Boolean(label))
}
