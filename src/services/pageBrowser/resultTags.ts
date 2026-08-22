import type { WebSearchResult } from './types'

/**
 * What a search result is, read from its own words.
 *
 * A list of blue titles is not something you can pick from, and MealHelp
 * already knows how to say what a recipe *is* — but only once it has the
 * recipe. Before that, all there is to go on is the title and the snippet the
 * engine returned. That is enough for the facts that decide whether a result
 * is worth opening: a slow cooker recipe says so in its title, and so does a
 * one-pan or a thirty-minute one.
 *
 * Deliberately conservative. These are claims *the page makes about itself*,
 * and a tag that guessed would be worse than no tag: it would be MealHelp
 * putting words in a stranger's mouth.
 */

export interface ResultTag {
  id: string
  label: string
}

interface TagRule {
  id: string
  label: string
  pattern: RegExp
  priority: number
}

const RULES: TagRule[] = [
  { id: 'slow-cooker', label: 'Crock-Pot', priority: 1, pattern: /\b(slow[- ]cooker|crock[- ]?pot|crockpot)\b/i },
  { id: 'instant-pot', label: 'Instant Pot', priority: 1, pattern: /\b(instant[- ]pot|pressure[- ]cook(er|ed|ing)?)\b/i },
  { id: 'air-fryer', label: 'Air fryer', priority: 1, pattern: /\bair[- ]fry(er|ed)?\b/i },
  { id: 'one-pan', label: 'One pan', priority: 2, pattern: /\bone[- ](pan|pot|skillet|dish)\b|\bsheet[- ]pan\b|\btray[- ]?bake\b|\bdump dinner\b/i },
  { id: 'no-cook', label: 'No cooking', priority: 2, pattern: /\bno[- ]cook\b|\bno[- ]bake\b/i },
  { id: 'grill', label: 'Grilled', priority: 3, pattern: /\bgrill(ed|ing)?\b|\bbarbecue\b|\bbbq\b/i },
  { id: 'freezer', label: 'Freezer friendly', priority: 4, pattern: /\bfreezer[- ]friendly\b|\bmake[- ]ahead\b|\bfreeze(s|able)?\b/i },
  { id: 'budget', label: 'Budget', priority: 5, pattern: /\bbudget\b|\bcheap\b|\bfrugal\b|\b\$\d+ dinner\b/i },
  { id: 'vegetarian', label: 'Vegetarian', priority: 5, pattern: /\bvegetarian\b|\bmeat[- ]free\b|\bmeatless\b/i },
  { id: 'vegan', label: 'Vegan', priority: 5, pattern: /\bvegan\b|\bplant[- ]based\b/i },
  { id: 'high-protein', label: 'High protein', priority: 6, pattern: /\bhigh[- ]protein\b|\bprotein[- ]packed\b/i },
  { id: 'leftovers', label: 'Great leftovers', priority: 6, pattern: /\bleftovers?\b|\bmeal[- ]prep\b/i },
]

/** "Ready in 25 minutes", "30-minute dinner", "20 min meals". */
const MINUTES = /\b(\d{1,3})[- ]?(?:minute|minutes|min|mins)\b/i

export function resultTags(result: Pick<WebSearchResult, 'title' | 'snippet'>, limit = 3): ResultTag[] {
  // The title is what the page calls itself; the snippet is the engine's
  // extract of it. Both are the page's own words, neither is ours.
  const words = `${result.title} ${result.snippet ?? ''}`

  const tags: ResultTag[] = []

  const minutes = MINUTES.exec(result.title) ?? MINUTES.exec(result.snippet ?? '')
  const value = minutes ? Number(minutes[1]) : undefined
  // Over an hour is not a selling point, and "5 minutes" in a snippet is
  // usually a step rather than the whole recipe.
  if (value != null && value >= 10 && value <= 60) {
    tags.push({ id: 'time', label: `${value} min` })
  }

  for (const rule of [...RULES].sort((a, b) => a.priority - b.priority)) {
    if (tags.length >= limit) break
    if (tags.some((tag) => tag.id === rule.id)) continue
    if (rule.pattern.test(words)) tags.push({ id: rule.id, label: rule.label })
  }

  return tags.slice(0, limit)
}
