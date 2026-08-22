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

/** A count with no unit — "3 onions" — which prices per item. */
function isCount(quantity: GroceryQuantity): boolean {
  return quantity.amount != null && !quantity.unit
}

/**
 * How many of the priced unit one quantity represents.
 *
 * The awkward case is that shops sell by mass while recipes ask by volume:
 * "2 cups of rice" is not a number of pounds until you know what rice weighs.
 * Rather than invent a density, this borrows the gram weights the nutrition
 * estimator already carries for exactly this problem — real per-cup weights
 * for real foods — and gives up honestly when there is none.
 */
function unitsNeeded(
  quantity: GroceryQuantity,
  entry: PriceEntry,
  name: string,
): number | undefined {
  const priceUnit = normalizeUnit(entry.unit) ?? entry.unit
  const amount = quantity.amount

  if (amount == null) return undefined

  if (isCount(quantity)) {
    // Priced per item: "3 onions" is three onions. Priced by mass, a count is
    // only useful if we know what one of them weighs.
    if (priceUnit === 'each') return amount
    return viaGrams(amount, undefined, priceUnit, name)
  }

  const from = normalizeUnit(quantity.unit)
  if (!from) return undefined

  if (priceUnit === 'each') {
    // "1 can black beans" against a per-can price is a straight count; any
    // other unit against a per-item price is not something to guess at.
    return dimensionOf(from) === dimensionOf(priceUnit) ? amount : undefined
  }

  const converted = convert(amount, from, priceUnit)
  if (converted != null) return converted

  return viaGrams(amount, quantity.unit, priceUnit, name)
}

/** Volume or a count into a weight, using the food's own density. */
function viaGrams(
  amount: number,
  unit: string | undefined,
  priceUnit: string,
  name: string,
): number | undefined {
  if (dimensionOf(priceUnit) !== 'mass') return undefined
  const food = findFood(name)
  if (!food) return undefined
  const grams = gramsOf(
    { id: 'price', originalText: name, ingredientName: name, quantity: amount, unit },
    food,
  )
  if (grams == null) return undefined
  return convert(grams, 'g', priceUnit) ?? undefined
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
