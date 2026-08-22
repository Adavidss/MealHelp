import type { GroceryItem, Nutrition, PantryItem, Recipe } from '@/models'
import { aggregateGroceries } from '@/services/groceryAggregator'
import { addNutrition, roundNutrition, scaleNutrition } from '@/services/nutrition'
import { priceBreakdown } from '@/services/pricing'
import { activeMinutes } from '@/services/recipeMetrics'
import type { GeneratedSlot } from './generatePlan'

/**
 * Whether a week is the week you asked for.
 *
 * The planner has always been able to lean towards cheap or quick recipes,
 * but leaning is not answering: "is this under sixty pounds", "is any night
 * longer than half an hour", "does this get me to a hundred grams of protein"
 * are questions with numbers for answers, and until you can see the number
 * you are brainstorming in the dark.
 *
 * Everything here is an estimate built on estimates — typical prices, guessed
 * nutrition — so every figure travels with what it was measured against and
 * the screens say so plainly.
 */

export interface WeekTargets {
  /** Total for the week's shop, in the user's currency. */
  budget?: number
  /** The most hands-on minutes any single night should take. */
  maxMinutesPerMeal?: number
  /** Per day, the way the nutrition page counts a day. */
  proteinPerDay?: number
  caloriesPerDay?: number
}

export type FitStatus = 'unknown' | 'good' | 'over' | 'under'

export interface FitMetric {
  /** What it actually comes to; undefined when there was nothing to measure. */
  value?: number
  target?: number
  status: FitStatus
  /**
   * True when the figure is a floor rather than a total — some of the week
   * could not be counted. A partial figure is never judged against a target:
   * telling someone they missed a protein goal when a third of their meals
   * were not counted is worse than saying nothing.
   */
  partial?: boolean
}

export interface WeekFit {
  cost: FitMetric
  /** The longest hands-on night, which is the one that decides if a week works. */
  longestMeal: FitMetric
  protein: FitMetric
  calories: FitMetric
  /** Cooking meals sorted by what they cost, dearest first. */
  dearest: Array<{ slot: GeneratedSlot; cost: number }>
  /** Cooking meals sorted by hands-on time, longest first. */
  slowest: Array<{ slot: GeneratedSlot; minutes: number }>
  /** How many of the week's meals had no nutrition to count. */
  uncountedMeals: number
}

export interface WeekFitInput {
  slots: GeneratedSlot[]
  pantry?: PantryItem[]
  ownPrices?: Map<string, { price: number; unit: string }>
  targets?: WeekTargets
  /** Days the week covers, for turning totals into per-day figures. */
  dayCount: number
  /**
   * Meals with no recipe behind them but numbers of their own — the cereal
   * every morning, the afternoon snack. Without these the week's nutrition
   * disagrees with the nutrition page, which does count them, and a day of
   * cereal, leftovers and dinner reads as two thirds of what was eaten.
   */
  standingMeals?: Array<{ nutrition: Nutrition; count: number }>
}

function within(value: number | undefined, target: number | undefined, higherIsBetter = false): FitMetric {
  if (value == null) return { value, target, status: 'unknown' }
  if (target == null) return { value, target, status: 'unknown' }
  if (higherIsBetter) {
    return { value, target, status: value >= target ? 'good' : 'under' }
  }
  return { value, target, status: value <= target ? 'good' : 'over' }
}

/** What the week's cooking would cost, as the grocery page would price it. */
export function weekCost(
  slots: GeneratedSlot[],
  pantry: PantryItem[] = [],
  ownPrices: Map<string, { price: number; unit: string }> = new Map(),
): { total: number; perSlot: Map<string, number>; items: GroceryItem[] } {
  const cooking = slots.filter((slot) => slot.kind === 'recipe' && slot.recipe)

  const items = aggregateGroceries({
    entries: cooking.map((slot) => ({
      recipe: slot.recipe as Recipe,
      servings: slot.servings,
      date: slot.date,
    })),
    pantry,
  })
  const priced = priceBreakdown(items, ownPrices)

  /*
   * A line can belong to several meals — onions to both the chili and the
   * tacos — so its cost is split between them rather than counted twice. It
   * is a rough attribution, and only used to answer "which night is dearest",
   * never to produce the total, which comes from the list itself.
   */
  const perSlot = new Map<string, number>()
  for (const group of priced.byCategory) {
    for (const { item, price } of group.items) {
      if (price.amount == null) continue
      const dates = [...new Set(item.sources.map((source) => source.date).filter(Boolean))]
      const share = price.amount / (dates.length || 1)
      for (const date of dates) {
        perSlot.set(date as string, (perSlot.get(date as string) ?? 0) + share)
      }
    }
  }

  return { total: priced.total, perSlot, items }
}

export function weekFit(input: WeekFitInput): WeekFit {
  const { slots, targets = {}, dayCount } = input
  const cooking = slots.filter((slot) => slot.kind === 'recipe' && slot.recipe)

  const { total, perSlot } = weekCost(slots, input.pantry, input.ownPrices)

  const dearest = cooking
    .map((slot) => ({ slot, cost: Math.round((perSlot.get(slot.date) ?? 0) * 100) / 100 }))
    .sort((a, b) => b.cost - a.cost)

  const slowest = cooking
    .map((slot) => ({ slot, minutes: Math.round(activeMinutes(slot.recipe as Recipe)) }))
    .sort((a, b) => b.minutes - a.minutes)

  /*
   * Nutrition counts every meal of the week, not only the cooking: a leftover
   * night is a night somebody ate. Each is counted as one serving, the way
   * the nutrition page counts a day.
   */
  const eaten = slots.filter(
    (slot) => !slot.unfilled && (slot.kind === 'recipe' || slot.kind === 'leftover') && slot.recipe,
  )
  let totals: Nutrition = {}
  let uncountedMeals = 0
  for (const slot of eaten) {
    const nutrition = (slot.recipe as Recipe).nutrition
    if (!nutrition?.calories && !nutrition?.protein) {
      uncountedMeals += 1
      continue
    }
    totals = addNutrition(totals, nutrition)
  }
  for (const standing of input.standingMeals ?? []) {
    if (!standing.count) continue
    totals = addNutrition(totals, scaleNutrition(standing.nutrition, standing.count))
  }

  const days = Math.max(1, dayCount)
  const perDay = roundNutrition(scaleNutrition(totals, 1 / days))

  // Nutrition counted from only some of the week is a floor, not an answer.
  const partial = uncountedMeals > 0
  const asFloor = (metric: FitMetric): FitMetric =>
    partial ? { ...metric, partial: true, status: 'unknown' } : metric

  return {
    cost: within(total || undefined, targets.budget),
    longestMeal: within(slowest[0]?.minutes, targets.maxMinutesPerMeal),
    protein: asFloor(within(perDay.protein, targets.proteinPerDay, true)),
    calories: asFloor(within(perDay.calories, targets.caloriesPerDay)),
    dearest,
    slowest,
    uncountedMeals,
  }
}
