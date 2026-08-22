import type { GroceryItem, GroceryQuantity } from '@/models'
import { convert, dimensionOf, normalizeUnit } from '@/services/unitConversion'
import { findFood, gramsOf } from '@/services/nutrition'
import { findPrice, type PriceEntry } from './priceTable'

/**
 * What a line of the shop costs, roughly.
 *
 * Two things make this an estimate rather than a sum. The price itself is a
 * typical price, not this shop's price on this day; and quantities in recipes
 * are cooking quantities, not shopping ones — "2 tbsp olive oil" costs a few
 * cents of a bottle you already own. Both are surfaced rather than hidden:
 * every total says how many of its lines it could price, and a price the user
 * types in beats the built-in one for ever after.
 */

export interface PriceSource {
  /** A price the user set for this item, in their own shop. */
  own?: { price: number; unit: string }
}

export type PriceOrigin = 'own' | 'table'

export interface ItemPrice {
  /** Undefined when nothing could be worked out — never a guess of zero. */
  amount?: number
  origin?: PriceOrigin
  /** Why there is no number, for the one-line explanation in the UI. */
  reason?: 'unknown-item' | 'incompatible-unit' | 'no-quantity'
}

/**
 * How many of the priced unit one quantity represents.
 *
 * The awkward cases are all mismatches of kind: shops sell mince by the pound
 * and potatoes by the potato, while recipes ask for two pounds of baby
 * potatoes, a head of garlic, two tablespoons of tomato paste. None of those
 * convert arithmetically — they need to know what the food weighs.
 *
 * So the gram weights the nutrition estimator already carries do the work in
 * both directions: a quantity becomes grams, and grams become however the
 * thing is priced. Where no weight is known it gives up rather than guessing,
 * because a quietly wrong price is worse than a dash.
 */
function unitsNeeded(
  quantity: GroceryQuantity,
  entry: PriceEntry,
  name: string,
): number | undefined {
  const priceUnit = normalizeUnit(entry.unit) ?? entry.unit
  const amount = quantity.amount
  if (amount == null) return undefined

  const from = normalizeUnit(quantity.unit)

  // Same kind of thing: pounds to ounces, cups to millilitres, cans to cans.
  if (from && convert(amount, from, priceUnit) != null) {
    return convert(amount, from, priceUnit) ?? undefined
  }

  // A bare count against a per-item price: "3 onions" is three onions.
  if (!from && priceUnit === 'each') return amount

  // Sold by the package, cooked by the piece: four slices of a sixteen-slice
  // loaf is a quarter of a loaf.
  const perPackage = entry.contains?.[from ?? 'each']
  if (perPackage) return amount / perPackage

  return viaGrams(amount, quantity.unit, priceUnit, name)
}

/**
 * Across kinds, by weight.
 *
 * `gramsOf` turns a recipe quantity into grams using the food's own density
 * or piece weight; this then turns grams into whatever the shop sells — a
 * weight, a piece, a can, a clove.
 */
function viaGrams(
  amount: number,
  unit: string | undefined,
  priceUnit: string,
  name: string,
): number | undefined {
  const food = findFood(name)
  if (!food) return undefined

  const grams = gramsOf(
    { id: 'price', originalText: name, ingredientName: name, quantity: amount, unit },
    food,
  )
  if (grams == null) return undefined

  // Priced by weight: straight conversion.
  if (dimensionOf(priceUnit) === 'mass') {
    return convert(grams, 'g', priceUnit) ?? undefined
  }

  /*
   * Priced by the piece, the can, the clove: how many of those weigh this
   * much. "each" is the piece weight; anything else has to be a unit the
   * food table knows a weight for, or there is no honest answer.
   */
  const perUnit =
    priceUnit === 'each'
      ? food.grams?.each
      : food.grams?.[priceUnit as keyof NonNullable<typeof food.grams>]
  if (!perUnit) return undefined
  return grams / perUnit
}

export function priceOfItem(item: GroceryItem, source: PriceSource = {}): ItemPrice {
  const entry: PriceEntry | undefined = source.own
    ? { key: item.key, price: source.own.price, unit: source.own.unit }
    : findPrice(item.key) ?? findPrice(item.name.toLowerCase())

  if (!entry) return { reason: 'unknown-item' }
  const origin: PriceOrigin = source.own ? 'own' : 'table'

  if (!item.quantities.length) {
    // No quantity at all — "salt" — is still one of the thing, which is what
    // ends up in the basket.
    return { amount: entry.price, origin }
  }

  let total = 0
  let priced = false
  for (const quantity of item.quantities) {
    const units = unitsNeeded(quantity, entry, item.key || item.name)
    if (units == null) continue
    total += units * entry.price
    priced = true
  }

  if (!priced) return { reason: 'incompatible-unit', origin }
  // Rounded to the cent; anything finer is false precision on a typical price.
  return { amount: Math.round(total * 100) / 100, origin }
}

export interface PricedItem {
  item: GroceryItem
  price: ItemPrice
}

export interface PriceBreakdown {
  /** Category → what it comes to, biggest first. */
  byCategory: Array<{ category: string; total: number; items: PricedItem[] }>
  total: number
  /** How much of the list the number covers, so it can be honest. */
  pricedCount: number
  itemCount: number
  unpriced: GroceryItem[]
}

/**
 * The week's shop, totalled by aisle.
 *
 * Items already ticked off or marked as "have it" are left out: the question
 * this answers is "what is this going to cost me", not "what did all the food
 * in my kitchen cost".
 */
export function priceBreakdown(
  items: GroceryItem[],
  ownPrices: Map<string, { price: number; unit: string }> = new Map(),
): PriceBreakdown {
  const groups = new Map<string, PricedItem[]>()
  const unpriced: GroceryItem[] = []
  let total = 0
  let pricedCount = 0
  let itemCount = 0

  for (const item of items) {
    if (item.checked || item.haveIt) continue
    itemCount += 1
    const own = ownPrices.get(item.key)
    const price = priceOfItem(item, own ? { own } : {})
    if (price.amount != null) {
      total += price.amount
      pricedCount += 1
    } else {
      unpriced.push(item)
    }
    const bucket = groups.get(item.category) ?? []
    bucket.push({ item, price })
    groups.set(item.category, bucket)
  }

  const byCategory = [...groups.entries()]
    .map(([category, entries]) => ({
      category,
      items: entries,
      total: entries.reduce((sum, entry) => sum + (entry.price.amount ?? 0), 0),
    }))
    // Biggest first: the useful question is what is driving the total.
    .sort((a, b) => b.total - a.total)

  return {
    byCategory,
    total: Math.round(total * 100) / 100,
    pricedCount,
    itemCount,
    unpriced,
  }
}

export function formatMoney(amount: number, currency = '$'): string {
  return `${currency}${amount.toFixed(2)}`
}
