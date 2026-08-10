/**
 * Ingredient identity.
 *
 * Two lines describe the same grocery item when they normalise to the same key.
 * The rules stay deliberately shallow: strip punctuation, drop words that only
 * describe size, and singularise the head noun. Anything that could change what
 * you put in the basket — "red" vs "yellow", "dried" vs "fresh", "boneless" —
 * is left alone, because a wrong merge is worse than a duplicate line.
 */

/** Words that describe size only and never change which product to buy. */
const SIZE_WORDS = new Set([
  'large',
  'lg',
  'small',
  'sm',
  'medium',
  'med',
  'extra-large',
  'jumbo',
  'big',
  'tiny',
])

/** Leading noise that carries no identity. */
const LEADING_NOISE = new Set(['a', 'an', 'the', 'of', 'some'])

/** Plurals that do not follow the usual rules. */
const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  potatoes: 'potato',
  tomatoes: 'tomato',
  mangoes: 'mango',
  avocados: 'avocado',
  chilies: 'chili',
  chiles: 'chile',
  berries: 'berry',
  cherries: 'cherry',
  anchovies: 'anchovy',
  scallions: 'scallion',
  children: 'child',
  geese: 'goose',
  feet: 'foot',
}

/** Words that end in "s" but are already singular. */
const ALWAYS_SINGULAR = new Set([
  'asparagus',
  'couscous',
  'hummus',
  'molasses',
  'watercress',
  'swiss',
  'bass',
  'grass',
  'lettuce',
  'rice',
  'cheese',
  'greens',
  'oats',
  'grits',
  'chips',
  'sprouts',
  'noodles',
  'beans',
  'peas',
  'lentils',
  'capers',
  'olives',
  'oats',
])

export function singularize(word: string): string {
  const lower = word.toLowerCase()
  if (IRREGULAR_PLURALS[lower]) return IRREGULAR_PLURALS[lower]
  if (ALWAYS_SINGULAR.has(lower)) return lower
  if (lower.length <= 3) return lower
  if (/(ss|us|is|sh|ch)$/.test(lower)) return lower
  if (/ies$/.test(lower)) return `${lower.slice(0, -3)}y`
  if (/(ches|shes|xes|zes|ses)$/.test(lower)) return lower.slice(0, -2)
  if (/oes$/.test(lower)) return lower.slice(0, -2)
  if (/s$/.test(lower)) return lower.slice(0, -1)
  return lower
}

/**
 * The merge key. "2 Yellow Onions" and "yellow onion" both become
 * "yellow onion"; "red onion" stays its own thing.
 */
export function normalizeIngredientKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[.,;:!?"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  const kept: string[] = []
  for (const [index, word] of words.entries()) {
    if (SIZE_WORDS.has(word)) continue
    if (index === 0 && LEADING_NOISE.has(word)) continue
    kept.push(word)
  }

  if (!kept.length) return name.toLowerCase().trim()

  // Only the head noun is singularised: "chicken thighs" → "chicken thigh",
  // but "sweet potatoes" keeps "sweet".
  kept[kept.length - 1] = singularize(kept[kept.length - 1])
  return kept.join(' ')
}

/**
 * How an ingredient reads on the grocery list.
 *
 * The wording comes from what the recipes actually said rather than from the
 * merge key, so "breadcrumbs" and "bay leaves" survive as themselves instead of
 * being rebuilt into "breadcrumb" and "bay leafs". The key is only ever used to
 * decide what merges with what.
 */
export function displayIngredientName(
  spelling: string,
  options: { plural?: boolean } = {},
): string {
  const words = spelling.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''

  if (options.plural) {
    const head = words[words.length - 1]
    // Already plural is left alone: pluralising "eggs" gives "eggses".
    if (singularize(head) === head.toLowerCase()) {
      words[words.length - 1] = pluralize(head)
    }
  }

  const joined = words.join(' ')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

/** Plural forms that do not follow the usual rules, keyed by the singular. */
const IRREGULAR_SINGULARS: Record<string, string> = Object.fromEntries(
  Object.entries(IRREGULAR_PLURALS).map(([plural, singular]) => [singular, plural]),
)

export function pluralize(word: string): string {
  const lower = word.toLowerCase()
  if (ALWAYS_SINGULAR.has(lower)) return lower
  if (IRREGULAR_SINGULARS[lower]) return IRREGULAR_SINGULARS[lower]
  if (/(potato|tomato|mango|hero|echo)$/.test(lower)) return `${lower}es`
  if (/(s|x|z|ch|sh)$/.test(lower)) return `${lower}es`
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`
  if (/(f|fe)$/.test(lower)) return `${lower.replace(/fe?$/, '')}ves`
  return `${lower}s`
}
