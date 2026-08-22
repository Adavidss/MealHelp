import type { Recipe } from '@/models'
import {
  activeMinutes,
  bulkScore,
  effortLevel,
  ingredientKeys,
  leftoverScore,
} from '@/services/recipeMetrics'
import { daysSince } from '@/utils/date'

/**
 * How people actually decide what to eat.
 *
 * Cuisine is a librarian's question — "Italian, Mexican, Thai" is how a
 * cookbook is filed, not how anyone picks dinner on a Tuesday. What gets asked
 * is closer to "something comforting", "something fresh", "something cheap",
 * "something that isn't what we always have". These are those questions.
 *
 * A mood is not always a filter. "Use what I have" and "Something different"
 * are orderings — everything qualifies, some things qualify more — so every
 * mood is expressed as one function from the library to a shortlist, and the
 * ones that only sort say so by returning everything in a new order.
 */

export interface MoodContext {
  /** Normalised pantry keys, for "Use what I have". */
  pantryKeys?: Set<string>
}

export interface Mood {
  id: string
  label: string
  /** One line, shown when the mood is the heading of a row. */
  blurb: string
  select: (recipes: Recipe[], context: MoodContext) => Recipe[]
}

/**
 * Word matching, as a last resort.
 *
 * A stew is comforting and a salad is fresh, and nothing on a Recipe says so.
 * The metrics carry most of the weight; these patterns only break the ties
 * that metrics cannot see, and they read the title and tags — never the
 * instructions, where "fresh basil" would make a lasagne a salad.
 */
function words(recipe: Recipe): string {
  return `${recipe.title} ${recipe.tags.join(' ')} ${recipe.categories.join(' ')}`.toLowerCase()
}

const COMFORT_WORDS = /stew|chili|soup|casserole|bake|braise|roast|pie|curry|mac|pasta|risotto|dumpling|pot roast|meatball/
const FRESH_WORDS = /salad|slaw|bowl|wrap|fresh|citrus|herb|summer|ceviche|gazpacho|crudo|poke/

function comforting(recipe: Recipe): boolean {
  const slowAndWarm =
    (recipe.cookTimeMinutes ?? 0) >= 45 ||
    recipe.cookingMethods.some((method) =>
      ['slow-cooker', 'oven', 'one-pot', 'instant-pot'].includes(method),
    )
  return slowAndWarm || COMFORT_WORDS.test(words(recipe))
}

function fresh(recipe: Recipe): boolean {
  if (recipe.cookingMethods.includes('no-cook')) return true
  if (FRESH_WORDS.test(words(recipe))) return true
  // Nothing that spends an hour in an oven reads as "fresh", whatever it is called.
  return (recipe.cookTimeMinutes ?? 0) <= 20 && activeMinutes(recipe) <= 20
}

function byField(list: Recipe[], score: (recipe: Recipe) => number): Recipe[] {
  return [...list].sort((a, b) => score(b) - score(a))
}

/** How many of the recipe's ingredients the pantry already covers, 0–1. */
export function pantryCoverage(recipe: Recipe, pantryKeys: Set<string>): number {
  const keys = ingredientKeys(recipe)
  if (!keys.length) return 0
  const covered = keys.filter((key) => pantryKeys.has(key)).length
  return covered / keys.length
}

export const MOODS: Mood[] = [
  {
    id: 'comforting',
    label: 'Comforting',
    blurb: 'Slow, warm and filling',
    select: (recipes) => recipes.filter(comforting),
  },
  {
    id: 'fresh',
    label: 'Fresh',
    blurb: 'Light, quick, barely cooked',
    select: (recipes) => recipes.filter(fresh),
  },
  {
    id: 'very-easy',
    label: 'Very easy',
    blurb: 'Little work, little thinking',
    select: (recipes) =>
      recipes.filter((recipe) => {
        const effort = effortLevel(recipe)
        return (effort === 'very-low' || effort === 'low') && activeMinutes(recipe) <= 25
      }),
  },
  {
    id: 'big-batch',
    label: 'Big batch',
    blurb: 'Cook once, eat twice',
    select: (recipes) => recipes.filter((recipe) => bulkScore(recipe) >= 4),
  },
  {
    id: 'cheap',
    label: 'Cheap',
    blurb: 'Keeps the shop down',
    select: (recipes) => recipes.filter((recipe) => recipe.costTier === '$'),
  },
  {
    id: 'leftovers',
    label: 'Good for leftovers',
    blurb: 'Just as good tomorrow',
    select: (recipes) => recipes.filter((recipe) => leftoverScore(recipe) >= 4),
  },
  {
    id: 'pantry',
    label: 'Use what I have',
    blurb: 'Least shopping needed',
    /**
     * A ranking, not a filter: a recipe using two of your five staples is
     * still worth seeing, it just sits below one using all five. Anything
     * with no overlap at all is dropped, because it answers a different
     * question entirely.
     */
    select: (recipes, context) => {
      const pantry = context.pantryKeys
      if (!pantry?.size) return []
      return byField(
        recipes.filter((recipe) => pantryCoverage(recipe, pantry) > 0),
        (recipe) => pantryCoverage(recipe, pantry),
      )
    },
  },
  {
    id: 'different',
    label: 'Something different',
    blurb: 'Not what you always make',
    /**
     * Novelty, oldest first: never cooked outranks cooked once a year ago,
     * which outranks last week's dinner. Sorting rather than filtering means
     * a small library still fills the row.
     */
    select: (recipes) =>
      byField(recipes, (recipe) => {
        if (!recipe.timesCooked) return 10_000
        return daysSince(recipe.lastCookedAt) ?? 5_000
      }),
  },
]

const BY_ID = new Map(MOODS.map((mood) => [mood.id, mood]))

export function moodById(id: string | undefined): Mood | undefined {
  return id ? BY_ID.get(id) : undefined
}

/**
 * The shortlist for a mood, or the whole library when no mood is chosen.
 * Unknown ids fall through to everything rather than to nothing, so a stale
 * link can never present an empty screen with no explanation.
 */
export function applyMood(
  recipes: Recipe[],
  moodId: string | undefined,
  context: MoodContext = {},
): Recipe[] {
  const mood = moodById(moodId)
  return mood ? mood.select(recipes, context) : recipes
}

/** How many recipes each mood would show, for counts next to the chips. */
export function countMoods(
  recipes: Recipe[],
  context: MoodContext = {},
): Map<string, number> {
  return new Map(MOODS.map((mood) => [mood.id, mood.select(recipes, context).length]))
}
