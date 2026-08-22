import type { GroceryItem, Recipe, RecipeIngredient } from '@/models'
import { displayIngredientName, normalizeIngredientKey } from '@/services/ingredientParser'
import { scaleAmount } from '@/services/unitConversion'
import { priceOfItem, type ItemPrice } from './estimate'

/**
 * What one recipe costs to cook.
 *
 * The number people expect here is not the price of a shop. Two tablespoons of
 * olive oil cost about thirty cents of a bottle you already own, and pricing
 * them as a bottle would say a stir fry costs forty pounds. So every line is
 * costed as *the amount the recipe uses*, which is also how the week's list is
 * costed — the two can never disagree.
 *
 * The other half of that honesty is the cupboard: salt, oil and the spices you
 * always have are counted separately, because "what will this cost me" and
 * "what does this contain" are different questions and only the first one is
 * about shopping.
 */

export interface RecipeCostLine {
  id: string
  name: string
  /** As the line will read on screen, already scaled. */
  originalText: string
  price: ItemPrice
  /** True when the cook says they always have this. */
  pantry: boolean
}

export interface RecipeCost {
  /** What you would spend, leaving out what you already keep in. */
  total: number
  /** Per serving at the scale asked for, so two recipes can be compared. */
  perServing?: number
  /** What the cupboard contributes, said separately rather than hidden. */
  pantryTotal: number
  lines: RecipeCostLine[]
  pricedCount: number
  /** Ingredients with no price and no honest way to guess one. */
  unpriced: string[]
  /** Servings the figures are for, after scaling. */
  servings?: number
}

export interface RecipeCostOptions {
  /** ½× to 2×, matching the recipe page's own scaling. */
  scale?: number
  ownPrices?: Map<string, { price: number; unit: string }>
  /** Normalised keys of things the cook always has. */
  pantryKeys?: Set<string>
}

/** One ingredient, scaled, in the shape the pricing table understands. */
function asItem(ingredient: RecipeIngredient, scale: number): GroceryItem {
  const name = ingredient.ingredientName?.trim() || ingredient.originalText
  const amount = ingredient.quantity != null ? scaleAmount(ingredient.quantity, scale) : undefined

  return {
    id: ingredient.id,
    key: normalizeIngredientKey(name),
    name: displayIngredientName(name),
    quantities:
      amount != null ? [{ amount, unit: ingredient.unit }] : [],
    category: 'Other',
    checked: false,
    sources: [],
  }
}

export function recipeCost(
  recipe: Pick<Recipe, 'ingredients' | 'servings'>,
  options: RecipeCostOptions = {},
): RecipeCost {
  const { scale = 1, ownPrices = new Map(), pantryKeys = new Set() } = options

  const lines: RecipeCostLine[] = []
  const unpriced: string[] = []
  let total = 0
  let pantryTotal = 0
  let pricedCount = 0

  for (const ingredient of recipe.ingredients) {
    const item = asItem(ingredient, scale)
    if (!item.key) continue

    const own = ownPrices.get(item.key)
    const price = priceOfItem(item, own ? { own } : {})
    const pantry = pantryKeys.has(item.key)

    if (price.amount != null) {
      pricedCount += 1
      if (pantry) pantryTotal += price.amount
      else total += price.amount
    } else {
      unpriced.push(item.name)
    }

    lines.push({
      id: ingredient.id,
      name: item.name,
      originalText: ingredient.originalText,
      price,
      pantry,
    })
  }

  const servings =
    recipe.servings != null ? Math.round(recipe.servings * scale * 10) / 10 : undefined

  return {
    total: Math.round(total * 100) / 100,
    pantryTotal: Math.round(pantryTotal * 100) / 100,
    perServing:
      servings && servings > 0 ? Math.round((total / servings) * 100) / 100 : undefined,
    lines,
    pricedCount,
    unpriced,
    servings,
  }
}
