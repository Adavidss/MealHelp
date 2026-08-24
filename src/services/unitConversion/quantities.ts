import type { GroceryQuantity } from '@/models'
import { convert, dimensionOf, formatUnit, getUnit, normalizeUnit } from './units'

/** Fractions cooks actually read, in the order a kitchen thinks about them. */
const NICE_FRACTIONS: Array<[number, string]> = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
]

const FRACTION_TOLERANCE = 0.02

/**
 * "1 1/2", "2/3", "3", "1.4" — whichever reads best. Numbers that are close to
 * a familiar fraction snap to it; anything else falls back to two decimals so a
 * scaled quantity never turns into 1.3333333333.
 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return ''
  const rounded = Math.round(value * 1000) / 1000
  const whole = Math.floor(rounded)
  const remainder = rounded - whole

  if (remainder < FRACTION_TOLERANCE) return String(whole)

  for (const [fractionValue, label] of NICE_FRACTIONS) {
    if (Math.abs(remainder - fractionValue) < FRACTION_TOLERANCE) {
      return whole === 0 ? label : `${whole} ${label}`
    }
  }

  if (1 - remainder < FRACTION_TOLERANCE) return String(whole + 1)

  const decimal = Math.round(rounded * 100) / 100
  return String(decimal)
}

/**
 * The same quantity, as a shop sells it.
 *
 * A list adding up two thirds of an onion here and two there is right about
 * the cooking and useless in the shop: nobody buys 2.7 onions. Counted things
 * round up — better a spare onion than a missing one — while anything with a
 * unit keeps its precision, because 2.7 lbs is a real thing to ask for at a
 * counter.
 */
export function formatShoppingQuantity(quantity: GroceryQuantity): string {
  if (quantity.freeform || quantity.unit || quantity.amount == null) {
    return formatQuantity(quantity)
  }
  return formatQuantity({ ...quantity, amount: Math.ceil(quantity.amount) })
}

export function formatQuantity(quantity: GroceryQuantity): string {
  if (quantity.freeform) return quantity.freeform
  if (quantity.amount == null) return quantity.unit ?? ''
  const amount = formatAmount(quantity.amount)
  const unit = formatUnit(quantity.unit, quantity.amount)
  return unit ? `${amount} ${unit}` : amount
}

/** "2 1/2 cups" / "3 lbs" / "a pinch" for a single ingredient line. */
export function formatQuantityRange(
  quantity: number | undefined,
  quantityMax: number | undefined,
  unit: string | undefined,
): string {
  if (quantity == null) return ''
  const unitLabel = formatUnit(unit, quantityMax ?? quantity)
  const amount =
    quantityMax != null && quantityMax !== quantity
      ? `${formatAmount(quantity)}–${formatAmount(quantityMax)}`
      : formatAmount(quantity)
  return unitLabel ? `${amount} ${unitLabel}` : amount
}

/**
 * Adds up a set of quantities, keeping incompatible ones apart.
 *
 * Compatible amounts are summed in the largest unit that appeared in the input:
 * a tablespoon plus two teaspoons reads as tablespoons, not as 34 ml. Nothing
 * is promoted to a unit nobody used, and nothing is converted across
 * dimensions — "1 bunch" and "20 g" come back as two entries.
 */
export function combineQuantities(quantities: GroceryQuantity[]): GroceryQuantity[] {
  const groups = new Map<string, GroceryQuantity[]>()
  const freeform: GroceryQuantity[] = []

  for (const quantity of quantities) {
    if (quantity.amount == null) {
      freeform.push(quantity)
      continue
    }
    const unit = normalizeUnit(quantity.unit)
    const key = dimensionOf(unit)
    const bucket = groups.get(key)
    if (bucket) bucket.push({ ...quantity, unit })
    else groups.set(key, [{ ...quantity, unit }])
  }

  const combined: GroceryQuantity[] = []

  for (const bucket of groups.values()) {
    // The unit the total is expressed in: the biggest one anybody used.
    let displayUnit = bucket[0].unit
    let displaySize = getUnit(displayUnit)?.toBase ?? 1
    for (const entry of bucket) {
      const size = getUnit(entry.unit)?.toBase ?? 1
      if (size > displaySize) {
        displaySize = size
        displayUnit = entry.unit
      }
    }

    let total = 0
    for (const entry of bucket) {
      const value = convert(entry.amount ?? 0, entry.unit, displayUnit)
      total += value ?? entry.amount ?? 0
    }

    combined.push({
      amount: Math.round(total * 1000) / 1000,
      ...(displayUnit ? { unit: displayUnit } : {}),
    })
  }

  // "A pinch" and friends survive as their own lines rather than disappearing.
  const seenFreeform = new Set<string>()
  for (const entry of freeform) {
    const label = entry.freeform ?? entry.unit ?? ''
    if (!label || seenFreeform.has(label)) continue
    seenFreeform.add(label)
    combined.push(entry)
  }

  return combined
}

/**
 * Scales a quantity for a serving change. Undefined quantities stay undefined:
 * doubling "salt to taste" is not a thing MealHelp pretends to know how to do.
 */
export function scaleAmount(
  amount: number | undefined,
  factor: number,
): number | undefined {
  if (amount == null || !Number.isFinite(amount)) return undefined
  const scaled = amount * factor
  // Three decimals is far below what any kitchen measures, and it keeps
  // floating point noise out of the display layer.
  return Math.round(scaled * 1000) / 1000
}
