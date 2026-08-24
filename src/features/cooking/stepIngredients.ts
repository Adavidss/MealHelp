import type { DisplayedIngredient } from '@/features/recipes/ingredientDisplay'

/**
 * Which ingredients a step is talking about.
 *
 * "Brown the beef with the onion and pepper" assumes you know it means two
 * pounds and one of each — and on a phone, checking meant leaving the step,
 * scrolling a list and finding your way back with wet hands. The amounts
 * belong beside the sentence that needs them.
 *
 * The matching is deliberately shallow, because a wrong guess here costs
 * nothing: a cook reading "1 onion" beside a step about onions can see for
 * themselves. What it must not do is miss the obvious ones.
 */

/** Words in an ingredient name that a step will never use to refer to it. */
const NOISE = new Set([
  'fresh', 'freshly', 'frozen', 'chopped', 'minced', 'diced', 'sliced', 'shredded',
  'grated', 'crumbled', 'crushed', 'peeled', 'cooked', 'uncooked', 'raw', 'boneless',
  'skinless', 'lean', 'large', 'medium', 'small', 'baby', 'ripe', 'unsalted', 'salted',
  'ground', 'whole', 'dried', 'canned', 'low-sodium', 'extra', 'virgin', 'all-purpose',
  'plain', 'organic', 'of', 'the', 'a', 'an', 'and',
])

function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** "2 cloves garlic, minced" is about garlic. */
function headNoun(name: string): string | undefined {
  const meaningful = words(name).filter((word) => !NOISE.has(word))
  return meaningful[meaningful.length - 1]
}

function mentions(text: string, phrase: string): boolean {
  if (phrase.length < 3) return false
  // Whole words only: "oil" must not match "boiling", "pea" must not match "peanut".
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}(s|es)?\\b`, 'i').test(text)
}

/**
 * The ingredients this step names, the specific ones first.
 *
 * A step saying "pepper" when the recipe has both a bell pepper and black
 * pepper gets both — guessing between them would be worse than showing the
 * cook the two lines and letting them look.
 */
export function ingredientsForStep(
  stepText: string,
  ingredients: DisplayedIngredient[],
): DisplayedIngredient[] {
  if (!stepText) return []

  const strong: DisplayedIngredient[] = []
  const weak: Array<{ item: DisplayedIngredient; noun: string }> = []

  for (const item of ingredients) {
    const plain = words(item.name).filter((word) => !NOISE.has(word)).join(' ')
    const noun = headNoun(item.name)

    if (plain && mentions(stepText, plain)) {
      strong.push(item)
      continue
    }
    if (noun && mentions(stepText, noun)) weak.push({ item, noun })
  }

  // A step that named something exactly does not also need the loose match on
  // the same word: "chili powder" beats "powder".
  const named = new Set(
    strong.map((item) => headNoun(item.name)).filter(Boolean) as string[],
  )
  const kept = weak.filter((entry) => !named.has(entry.noun)).map((entry) => entry.item)

  // Recipe order, so the list reads the way the ingredients do.
  const chosen = new Set([...strong, ...kept])
  return ingredients.filter((item) => chosen.has(item))
}
