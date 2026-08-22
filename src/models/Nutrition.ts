/**
 * Nutrition, per serving.
 *
 * The shape follows schema.org's NutritionInformation, which is what recipe
 * sites publish and what Mealie and Tandoor store: calories plus the
 * handful of nutrients a label carries. Everything is optional — a recipe
 * that only knows its calories is still worth showing.
 *
 * Units are fixed so numbers can be added: kcal, grams, and milligrams for
 * sodium and cholesterol (the two a label reports in mg).
 */
export interface Nutrition {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  saturatedFat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  cholesterol?: number
}

export type NutrientKey = keyof Nutrition

/** Where a recipe's numbers came from, so the label can be honest about it. */
export type NutritionSource = 'site' | 'manual' | 'estimate'

export interface NutrientInfo {
  key: NutrientKey
  label: string
  unit: 'kcal' | 'g' | 'mg'
  /** The FDA Daily Value for a 2,000 kcal diet, used as the default target. */
  dailyValue: number
  /** Shown in the overview's main bars; the rest are in the detail. */
  headline?: boolean
}

export const NUTRIENTS: NutrientInfo[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', dailyValue: 2000, headline: true },
  { key: 'protein', label: 'Protein', unit: 'g', dailyValue: 50, headline: true },
  { key: 'carbs', label: 'Carbs', unit: 'g', dailyValue: 275, headline: true },
  { key: 'fat', label: 'Fat', unit: 'g', dailyValue: 78, headline: true },
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', dailyValue: 20 },
  { key: 'fiber', label: 'Fibre', unit: 'g', dailyValue: 28 },
  { key: 'sugar', label: 'Sugar', unit: 'g', dailyValue: 50 },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dailyValue: 2300 },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dailyValue: 300 },
]

export const NUTRIENT_KEYS: NutrientKey[] = NUTRIENTS.map((n) => n.key)

/** Daily targets the overview measures against. Any key left out uses the Daily Value. */
export type NutritionTargets = Partial<Record<NutrientKey, number>>

/**
 * Something eaten that is not a planned meal — a snack, a coffee, lunch out.
 * Logged per day with whatever numbers are known, so the day's total is the
 * day's total and not just the plan's.
 */
export interface NutritionLogEntry {
  id: string
  /** ISO date (YYYY-MM-DD). */
  date: string
  name: string
  /** How many of the portion described by `nutrition` were eaten. */
  quantity: number
  nutrition: Nutrition
  /** Where the numbers came from, e.g. "Open Food Facts". */
  source?: string
  createdAt: string
}
