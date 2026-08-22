/**
 * Turning what you are looking at into something worth searching for.
 *
 * Discovery only feels stressless if you never have to compose a query. You
 * tap a mood, or you look at a recipe you like — and the words that go to the
 * recipe databases are worked out from that.
 */

/**
 * Words that describe how a recipe is cooked rather than what it is.
 *
 * "Slow Cooker Chicken Curry" searched verbatim finds slow cooker recipes,
 * which is the one axis you already decided. What you want more of is chicken
 * curry, so the appliance and the marketing come off first.
 */
const NOISE = [
  'slow cooker', 'crock pot', 'crockpot', 'instant pot', 'pressure cooker',
  'air fryer', 'sheet pan', 'one pot', 'one pan', 'skillet', 'dutch oven',
  'big batch', 'easy', 'quick', 'simple', 'best', 'ultimate', 'perfect',
  'weeknight', 'homemade', 'classic', 'the', 'my', 'copycat', 'healthy',
  '30 minute', '20 minute', '15 minute', 'make ahead', 'freezer',
]

/** What to ask the recipe databases for, given a recipe you already like. */
export function similarQuery(title: string): string {
  let words = ` ${title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `
  for (const phrase of NOISE) {
    words = words.split(` ${phrase} `).join(' ')
  }
  const cleaned = words.trim()
  // Everything was noise — "Easy Weeknight Dinner" — so the original is the
  // better question, however vague, than an empty one.
  if (!cleaned) return title.trim()
  // Two or three words find dishes; a whole sentence finds nothing.
  return cleaned.split(' ').slice(0, 3).join(' ')
}

/**
 * What each mood means to a recipe database.
 *
 * The moods narrow your own library by measurement — effort, batch size,
 * leftovers — and none of that exists for a stranger's recipe. Online, the
 * same question has to be asked in the words people write recipes with, which
 * is why this is a separate map and not a reuse of the mood predicates.
 */
export const MOOD_QUERIES: Record<string, string[]> = {
  comforting: ['comfort food stew', 'creamy pasta bake', 'chicken casserole'],
  fresh: ['fresh salad bowl', 'summer salad', 'grain bowl'],
  'very-easy': ['5 ingredient dinner', 'easy weeknight dinner', 'no fuss dinner'],
  'big-batch': ['big batch dinner', 'freezer friendly casserole', 'batch cooking'],
  cheap: ['budget dinner', 'cheap family meal', 'pantry dinner'],
  leftovers: ['make ahead dinner', 'meal prep dinner', 'chili'],
  pantry: ['pantry staples dinner', 'store cupboard dinner'],
  different: ['something different dinner', 'unusual weeknight dinner'],
}

/** One search for a mood, varied so asking twice does not show the same row. */
export function moodQuery(moodId: string | undefined, attempt = 0): string {
  const options = MOOD_QUERIES[moodId ?? ''] ?? ['easy dinner recipes']
  return options[attempt % options.length]
}
