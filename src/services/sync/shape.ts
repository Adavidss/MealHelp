import type { Record_ } from './merge'

/**
 * Records arriving from a phone that is not running this version.
 *
 * Two people rarely update an app on the same day, so a household will
 * routinely have one phone a release behind. A recipe written by the older one
 * can be missing a field this version takes for granted, and the app assumes
 * these lists exist — `recipe.equipment.join(' ')` in the library search is
 * enough to take the whole screen down.
 *
 * So incoming records are patched, not rejected: a missing list becomes an
 * empty one, and everything else is left exactly as the other phone wrote it.
 * Dropping the record instead would quietly lose their recipe, which is worse.
 */
const REQUIRED_LISTS: Record<string, string[]> = {
  recipes: [
    'ingredients',
    'instructions',
    'tags',
    'categories',
    'equipment',
    'cookingMethods',
    'mealTypes',
  ],
  groceryLists: ['items'],
  collections: ['recipeIds'],
}

export function repairIncoming(table: string, record: Record_): Record_ {
  const lists = REQUIRED_LISTS[table]
  if (!lists) return record
  let repaired: Record_ | undefined
  for (const field of lists) {
    if (Array.isArray(record[field])) continue
    repaired ??= { ...record }
    repaired[field] = []
  }
  return repaired ?? record
}
