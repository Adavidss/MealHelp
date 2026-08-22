import type { Nutrition } from '@/models'

/**
 * Reading schema.org NutritionInformation.
 *
 * Sites write these as strings — "250 calories", "12 g", "1,5 g", "450mg" —
 * and not consistently. This does what Mealie's `clean_nutrition` does: take
 * the first number out of each field (comma or dot decimal), and treat sodium
 * and cholesterol as grams only when a site spells them that way, turning
 * them into milligrams. Everything else is assumed to be grams already.
 */

const FIELDS: Array<{ key: keyof Nutrition; schema: string[] }> = [
  { key: 'calories', schema: ['calories', 'energy'] },
  { key: 'protein', schema: ['proteinContent', 'protein'] },
  { key: 'carbs', schema: ['carbohydrateContent', 'carbohydrates', 'carbs'] },
  { key: 'fat', schema: ['fatContent', 'fat'] },
  { key: 'saturatedFat', schema: ['saturatedFatContent', 'saturatedFat'] },
  { key: 'fiber', schema: ['fiberContent', 'fibre', 'fiber'] },
  { key: 'sugar', schema: ['sugarContent', 'sugar'] },
  { key: 'sodium', schema: ['sodiumContent', 'sodium'] },
  { key: 'cholesterol', schema: ['cholesterolContent', 'cholesterol'] },
]

const MATCH_DIGITS = /\d+([.,]\d+)?/

export function firstNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const match = MATCH_DIGITS.exec(value)
  if (!match) return undefined
  const parsed = Number(match[0].replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

/** "0.45 g" sodium → 450 mg; "450 mg" stays; a bare number is taken as mg. */
function toMilligrams(value: unknown): number | undefined {
  const amount = firstNumber(value)
  if (amount == null) return undefined
  if (typeof value === 'string' && /\bg\b|grams?/i.test(value) && !/mg|milli/i.test(value)) {
    return amount * 1000
  }
  return amount
}

/** kJ is rare on recipe sites but real; kcal is what everything else means. */
function toKilocalories(value: unknown): number | undefined {
  const amount = firstNumber(value)
  if (amount == null) return undefined
  if (typeof value === 'string' && /\bkj\b|kilojoule/i.test(value)) return Math.round(amount / 4.184)
  return amount
}

export function parseSchemaNutrition(raw: unknown): Nutrition | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const node = raw as Record<string, unknown>
  const out: Nutrition = {}

  for (const field of FIELDS) {
    const source = field.schema.map((name) => node[name]).find((value) => value != null && value !== '')
    if (source == null) continue
    const amount =
      field.key === 'calories'
        ? toKilocalories(source)
        : field.key === 'sodium' || field.key === 'cholesterol'
          ? toMilligrams(source)
          : firstNumber(source)
    if (amount != null && amount >= 0) out[field.key] = round(amount)
  }

  return Object.keys(out).length ? out : undefined
}

export function round(value: number, places = 1): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
