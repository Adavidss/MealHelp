import type { Recipe } from '@/models'
import {
  activeMinutes,
  cleanupScore,
  leftoverScore,
} from '@/services/recipeMetrics'

/**
 * The few words that go on a photograph.
 *
 * A card is a picture first, so whatever sits on top of it has to earn the
 * space: three badges at most, and only the ones that would change your mind
 * about cooking something tonight. "Simple", "Hands off" and "Meal prep" are
 * all true of the same slow cooker meal and none of them says more than the
 * appliance does, so the list is deliberately shorter than the filter set in
 * characteristics.ts — that one is for narrowing, this one is for choosing.
 */

export type BadgeTone = 'time' | 'method' | 'keeps' | 'thrift' | 'nutrition'

export interface MealBadge {
  id: string
  label: string
  tone: BadgeTone
}

/** Protein per serving at which "High protein" stops being a stretch. */
const HIGH_PROTEIN_GRAMS = 25

/** Rounded to the nearest five, because "23 min" reads as precision nobody has. */
function roundedMinutes(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5)
}

interface BadgeRule {
  id: string
  tone: BadgeTone
  /** Lower goes on the card first. */
  priority: number
  label: (recipe: Recipe) => string
  matches: (recipe: Recipe) => boolean
}

const RULES: BadgeRule[] = [
  {
    // The single most useful thing to know at a glance, so it leads — and it
    // says the actual number rather than the word "quick", which every site
    // uses and nobody believes.
    id: 'time',
    tone: 'time',
    priority: 1,
    label: (recipe) => `${roundedMinutes(activeMinutes(recipe))} min`,
    matches: (recipe) => activeMinutes(recipe) > 0 && activeMinutes(recipe) <= 30,
  },
  {
    id: 'slow-cooker',
    tone: 'method',
    priority: 2,
    label: () => 'Slow cooker',
    matches: (recipe) => recipe.cookingMethods.includes('slow-cooker'),
  },
  {
    id: 'instant-pot',
    tone: 'method',
    priority: 2,
    label: () => 'Instant Pot',
    matches: (recipe) => recipe.cookingMethods.includes('instant-pot'),
  },
  {
    id: 'one-pan',
    tone: 'method',
    priority: 3,
    label: () => 'One pan',
    matches: (recipe) =>
      recipe.cookingMethods.includes('one-pot') || recipe.cookingMethods.includes('sheet-pan'),
  },
  {
    id: 'no-cook',
    tone: 'method',
    priority: 3,
    label: () => 'No cooking',
    matches: (recipe) => recipe.cookingMethods.includes('no-cook'),
  },
  {
    id: 'leftovers',
    tone: 'keeps',
    priority: 4,
    label: () => 'Great leftovers',
    matches: (recipe) => leftoverScore(recipe) >= 4,
  },
  {
    id: 'freezer',
    tone: 'keeps',
    priority: 5,
    label: () => 'Freezer friendly',
    matches: (recipe) => Boolean(recipe.freezerFriendly),
  },
  {
    id: 'protein',
    tone: 'nutrition',
    priority: 5,
    label: () => 'High protein',
    matches: (recipe) => (recipe.nutrition?.protein ?? 0) >= HIGH_PROTEIN_GRAMS,
  },
  {
    id: 'budget',
    tone: 'thrift',
    priority: 6,
    label: () => 'Budget',
    matches: (recipe) => recipe.costTier === '$',
  },
  {
    id: 'cleanup',
    tone: 'thrift',
    priority: 7,
    label: () => 'Easy cleanup',
    matches: (recipe) => cleanupScore(recipe) >= 4,
  },
]

/**
 * At most `limit` badges, most telling first.
 *
 * Only one badge per tone: "One pan" and "Slow cooker" are both about the pan,
 * and a card carrying both has spent its whole budget saying one thing.
 */
export function mealBadges(recipe: Recipe, limit = 3): MealBadge[] {
  const chosen: MealBadge[] = []
  const usedTones = new Set<BadgeTone>()

  for (const rule of [...RULES].sort((a, b) => a.priority - b.priority)) {
    if (chosen.length >= limit) break
    if (usedTones.has(rule.tone) || !rule.matches(recipe)) continue
    usedTones.add(rule.tone)
    chosen.push({ id: rule.id, label: rule.label(recipe), tone: rule.tone })
  }

  return chosen
}

/** What a recipe costs, as the one-glance mark a card shows next to its time. */
export function costMark(recipe: Recipe): string | undefined {
  return recipe.costTier
}
