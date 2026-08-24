import type { Recipe, RecipeIngredient } from '@/models'
import { pluralize, singularize } from '@/services/ingredientParser'
import { formatQuantityRange, scaleAmount } from '@/services/unitConversion'

/**
 * How an ingredient reads on screen at a given scale.
 *
 * When the quantity could not be parsed there is nothing safe to multiply, so
 * the original line is shown verbatim and the scale is simply not applied to
 * it — inventing "2 salt to taste" would be worse than leaving it alone.
 */
export interface DisplayedIngredient {
  id: string
  quantityText: string
  name: string
  preparation?: string
  optional?: boolean
  /** True when the line is shown as written because scaling could not apply. */
  verbatim: boolean
  originalText: string
  section?: string
}

export function displayIngredient(
  ingredient: RecipeIngredient,
  scale = 1,
): DisplayedIngredient {
  const scalable = ingredient.quantity != null

  if (!scalable) {
    return {
      id: ingredient.id,
      quantityText: '',
      name: ingredient.originalText || ingredient.ingredientName,
      preparation: undefined,
      optional: ingredient.optional,
      verbatim: true,
      originalText: ingredient.originalText,
      section: ingredient.section,
    }
  }

  const quantity = countable(scaleAmount(ingredient.quantity, scale), ingredient.unit)
  const quantityMax = countable(scaleAmount(ingredient.quantityMax, scale), ingredient.unit)

  return {
    id: ingredient.id,
    quantityText: formatQuantityRange(quantity, quantityMax, ingredient.unit),
    name: counted(ingredient.ingredientName, quantity, ingredient.unit),
    preparation: ingredient.preparation,
    optional: ingredient.optional,
    verbatim: false,
    originalText: ingredient.originalText,
    section: ingredient.section,
  }
}

/**
 * Things you count rather than measure.
 *
 * Scaling a recipe to nineteen servings gives "3.17 onions", which is not a
 * number anybody can act on — there is no such thing as a sixth of an onion in
 * a kitchen. Weights and volumes keep their precision, because 6 1/3 lbs is a
 * real thing to weigh out.
 */
function countable(amount: number | undefined, unit: string | undefined): number | undefined {
  if (amount == null || unit) return amount
  const step = amount >= 1 ? 0.5 : 0.25
  return Math.round(amount / step) * step
}

/**
 * "3 large yellow onion" is what doubling a recipe used to produce, and it
 * reads as a bug even though the arithmetic is right. Only counted things are
 * touched — "2 lbs ground beef" is already correct — and only when the recipe
 * itself wrote the word in the singular.
 */
function counted(name: string, quantity: number | undefined, unit: string | undefined): string {
  if (unit || quantity == null || quantity <= 1) return name
  const words = name.trim().split(/\s+/)
  const head = words[words.length - 1]
  if (!head || !/[a-z]$/i.test(head) || singularize(head) !== head.toLowerCase()) return name
  words[words.length - 1] = pluralize(head)
  return words.join(' ')
}

export interface IngredientSection {
  title?: string
  items: DisplayedIngredient[]
}

/** Groups by the "For the sauce:" headings the parser preserved. */
export function displayIngredientSections(
  ingredients: RecipeIngredient[],
  scale = 1,
): IngredientSection[] {
  const sections: IngredientSection[] = []
  for (const ingredient of ingredients) {
    const displayed = displayIngredient(ingredient, scale)
    const last = sections[sections.length - 1]
    if (last && last.title === displayed.section) {
      last.items.push(displayed)
    } else {
      sections.push({ title: displayed.section, items: [displayed] })
    }
  }
  return sections
}

/**
 * The ingredient list as plain text, for pasting into a note or a message.
 * Scaled the way the screen is, with section headings kept.
 */
export function ingredientsAsText(
  recipe: Pick<Recipe, 'title' | 'servings' | 'ingredients'>,
  scale = 1,
): string {
  const lines: string[] = [recipe.title]
  const servings = recipe.servings ? Math.round(recipe.servings * scale * 10) / 10 : undefined
  if (servings) lines.push(`Serves ${servings}`)
  lines.push('')
  for (const section of displayIngredientSections(recipe.ingredients, scale)) {
    if (section.title) lines.push(`${section.title}:`)
    for (const item of section.items) {
      const quantity = item.quantityText ? `${item.quantityText} ` : ''
      const preparation = item.preparation ? `, ${item.preparation}` : ''
      const optional = item.optional ? ' (optional)' : ''
      lines.push(`- ${quantity}${item.name}${preparation}${optional}`)
    }
  }
  return lines.join('\n').trim()
}

/**
 * Doubling is the common one; tripling for a freezer batch is the next. The
 * servings stepper beside these covers everything they do not — cooking for
 * five when the recipe was written for four is not a multiplier anybody wants
 * to work out.
 */
export const SCALE_OPTIONS = [0.5, 1, 1.5, 2, 3, 4] as const

export function scaleLabel(scale: number): string {
  if (scale === 0.5) return '½×'
  if (scale === 1) return '1×'
  if (scale === 1.5) return '1½×'
  const rounded = Math.round(scale * 100) / 100
  return `${rounded}×`
}
