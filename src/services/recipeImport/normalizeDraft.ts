import type { CookingMethod, Nutrition, RecipeDraft, RecipeInstruction } from '@/models'
import { COOKING_METHODS } from '@/models'
import { parseIngredient } from '@/services/ingredientParser'
import { newId } from '@/utils/id'

/** "PT1H30M" → 90. Returns undefined for anything it does not understand. */
export function parseISODuration(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined

  const iso = /^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
    value.trim(),
  )
  if (iso) {
    const [, days, hours, minutes] = iso
    const total =
      Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0)
    return total > 0 ? Math.round(total) : undefined
  }

  // Sites often write "1 hr 15 mins" straight into the field.
  return parseHumanDuration(value)
}

export function parseHumanDuration(value: string): number | undefined {
  const text = value.toLowerCase()
  const hours = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/.exec(text)
  const minutes = /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/.exec(text)
  if (!hours && !minutes) {
    const bare = /^(\d+)$/.exec(text.trim())
    return bare ? Number(bare[1]) : undefined
  }
  const total = Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0)
  return total > 0 ? Math.round(total) : undefined
}

/** "Serves 4", "4 servings", "4-6" → 4. */
export function parseServings(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (Array.isArray(value)) return parseServings(value[0])
  if (typeof value !== 'string') return undefined
  const match = /(\d+)/.exec(value)
  return match ? Number(match[1]) : undefined
}

const TIMER_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(?:to\s*\d+\s*)?(minutes?|mins?|hours?|hrs?)\b/i

/**
 * Finds the duration a step is asking you to wait for, so cooking mode can
 * offer a timer. It never starts one by itself.
 */
export function detectTimerMinutes(text: string): number | undefined {
  const match = TIMER_PATTERN.exec(text)
  if (!match) return undefined
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  const isHours = /^h/i.test(match[2])
  const minutes = isHours ? amount * 60 : amount
  // A 24-hour marinade is real but is not a kitchen timer.
  return minutes <= 24 * 60 ? Math.round(minutes) : undefined
}

export function buildInstructions(steps: string[]): RecipeInstruction[] {
  return steps
    .map((step) => step.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: newId('step'),
      order: index + 1,
      text,
      timerMinutes: detectTimerMinutes(text),
    }))
}

const METHOD_HINTS: Array<{ method: CookingMethod; patterns: RegExp }> = [
  { method: 'slow-cooker', patterns: /slow cooker|crock ?pot|crockpot/i },
  { method: 'instant-pot', patterns: /instant ?pot|pressure cooker/i },
  { method: 'air-fryer', patterns: /air fryer/i },
  { method: 'sheet-pan', patterns: /sheet ?pan|baking sheet|tray bake/i },
  { method: 'one-pot', patterns: /one[- ]pot|one[- ]pan|dutch oven/i },
  { method: 'grill', patterns: /\bgrill|barbecue|bbq\b/i },
  { method: 'oven', patterns: /\bbake\b|\boven\b|\broast\b|preheat/i },
  { method: 'stovetop', patterns: /\bskillet\b|\bsaucepan\b|\bsauté|\bsimmer\b|\bstovetop\b|\bfry\b/i },
  { method: 'microwave', patterns: /\bmicrowave\b/i },
  { method: 'no-cook', patterns: /no[- ]cook|no cooking required/i },
]

/**
 * What a recipe's own words say about how it is cooked — and nothing when they
 * say nothing. The editor uses this to *suggest*; import uses the defaulting
 * version below.
 */
export function detectCookingMethods(
  title: string,
  instructions: string[],
  equipmentText = '',
): CookingMethod[] {
  const haystack = `${title}\n${equipmentText}\n${instructions.join('\n')}`
  const found = new Set<CookingMethod>()
  for (const hint of METHOD_HINTS) {
    if (hint.patterns.test(haystack)) found.add(hint.method)
  }
  // An appliance recipe is about the appliance, not the stove it sits next to.
  if (found.has('slow-cooker') || found.has('instant-pot')) {
    found.delete('stovetop')
    found.delete('oven')
  }
  return [...found].filter(isCookingMethod)
}

/**
 * Guesses how a recipe is cooked from its own words. These are only defaults —
 * the import preview lets the user correct them before anything is saved.
 */
export function inferCookingMethods(
  title: string,
  instructions: string[],
  equipmentText = '',
): CookingMethod[] {
  const methods = detectCookingMethods(title, instructions, equipmentText)
  return methods.length ? methods : ['stovetop']
}

function isCookingMethod(value: string): value is CookingMethod {
  return (COOKING_METHODS as readonly string[]).includes(value)
}

export interface DraftInput {
  title: string
  description?: string
  sourceUrl?: string
  sourceName?: string
  author?: string
  image?: string
  servings?: number
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  totalTimeMinutes?: number
  ingredientLines: string[]
  instructionTexts: string[]
  tags?: string[]
  categories?: string[]
  notes?: string
  /** Per serving, as the site published it. */
  nutrition?: Nutrition
}

/** Assembles a preview-ready draft. Nothing here writes to the database. */
export function toRecipeDraft(input: DraftInput): RecipeDraft {
  const ingredients = input.ingredientLines
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => ({ id: newId('ing'), ...parseIngredient(line) }))

  const instructions = buildInstructions(input.instructionTexts)

  const total =
    input.totalTimeMinutes ??
    (input.prepTimeMinutes != null || input.cookTimeMinutes != null
      ? (input.prepTimeMinutes ?? 0) + (input.cookTimeMinutes ?? 0)
      : undefined)

  return {
    title: input.title.trim() || 'Untitled recipe',
    description: input.description?.trim() || undefined,
    sourceUrl: input.sourceUrl,
    sourceName: input.sourceName,
    author: input.author,
    image: input.image,
    servings: input.servings,
    prepTimeMinutes: input.prepTimeMinutes,
    cookTimeMinutes: input.cookTimeMinutes,
    totalTimeMinutes: total,
    ingredients,
    instructions,
    notes: input.notes,
    tags: input.tags ?? [],
    categories: input.categories ?? [],
    equipment: [],
    cookingMethods: inferCookingMethods(
      input.title,
      instructions.map((step) => step.text),
    ),
    mealTypes: ['dinner'],
    nutrition: input.nutrition,
    nutritionSource: input.nutrition ? 'site' : undefined,
    favorite: false,
    timesCooked: 0,
  }
}
