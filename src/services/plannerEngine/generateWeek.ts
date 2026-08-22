import type {
  MealSlotConfig,
  PlanningRequest,
  Recipe,
} from '@/models'
import { slotsForDate } from '@/models'
import { mealsCovered } from '@/services/recipeMetrics'
import type { ScoringContext } from '@/services/recommendationEngine'
import { generatePlan, type GeneratedSlot } from './generatePlan'

/**
 * A whole day's worth of planning, not just dinner.
 *
 * The engine below it answers one question — how should cooking and leftovers
 * fall across a week — and it answers it for *one* slot at a time. That is the
 * right shape: dinners and lunches are separate rhythms, and cooking three
 * dinners has nothing to do with how many lunches you want.
 *
 * So this runs that engine once per cooking slot and fills the rest of the day
 * without it:
 *
 *   cook      — the engine, with this slot's own sessions and servings
 *   routine   — the same thing every day, no decision to make
 *   leftovers — eats from a cooking slot earlier in the week
 *   open      — left empty on purpose, for the user to fill
 *
 * Leftovers deliberately cross slots: yesterday's dinner is today's lunch, and
 * a planner that could not express that would be describing a different life
 * from the one most people live.
 */

export interface WeekSlotPlan {
  slot: MealSlotConfig
  /** One entry per date this slot applies to. */
  meals: GeneratedSlot[]
}

export interface GeneratedWeek {
  /** In the order the slots are eaten. */
  plans: WeekSlotPlan[]
  warnings: string[]
  cookSessions: number
  leftoverMeals: number
}

export interface GenerateWeekOptions {
  slots: MealSlotConfig[]
  dates: string[]
  /** Everything the request carries that is not slot-specific. */
  request: Omit<PlanningRequest, 'mealType' | 'mealsNeeded' | 'targetCookSessions' | 'dates'>
  library: Recipe[]
  context?: Partial<ScoringContext>
  defaultServings: number
}

/** Servings a cooking session leaves once its own night has eaten. */
function spareServings(meal: GeneratedSlot, perMeal: number): number {
  if (meal.kind !== 'recipe' || !meal.recipe) return 0
  const servings = meal.servings ?? meal.recipe.servings ?? perMeal
  return Math.max(0, mealsCovered({ ...meal.recipe, servings }, perMeal) - 1)
}

export function generateWeek(options: GenerateWeekOptions): GeneratedWeek {
  const { slots, dates, library, defaultServings } = options
  const warnings: string[] = []

  const datesFor = (slot: MealSlotConfig) =>
    dates.filter((date) => slotsForDate([slot], date).length > 0)

  const active = slots.filter((slot) => datesFor(slot).length > 0)

  /*
   * How many meals will be eaten out of the cooking, beyond the cooking slots'
   * own nights. A lunch slot set to "leftovers" is a promise that has to be
   * kept by the pan on Monday, so it has to be known before anything is
   * cooked — which is why this is counted first and the batches are sized for
   * it below.
   */
  const leftoverDemand = active
    .filter((slot) => slot.fill === 'leftovers')
    .reduce((total, slot) => total + datesFor(slot).length, 0)

  // ---- Cooking slots ----
  const plans = new Map<string, WeekSlotPlan>()
  const cookingMeals: Array<{ meal: GeneratedSlot; perMeal: number }> = []

  for (const slot of active.filter((slot) => slot.fill === 'cook')) {
    const slotDates = datesFor(slot)
    const perMeal = slot.servings ?? defaultServings
    const result = generatePlan({
      request: {
        ...options.request,
        dates: slotDates,
        mealType: slot.type,
        mealsNeeded: slotDates.length,
        targetCookSessions: slot.cookSessions ?? slotDates.length,
        servingsPerMeal: perMeal,
      },
      library,
      context: options.context,
    })
    plans.set(slot.id, { slot, meals: result.slots })

    /*
     * One warning per slot rather than one per day: "nothing fit Tuesday,
     * nothing fit Wednesday, nothing fit Thursday" is the same fact three
     * times, and the fix — more recipes for that meal — is the same too.
     */
    const empty = result.slots.filter((meal) => meal.unfilled).length
    if (empty) {
      warnings.push(
        `Nothing in your library fits ${empty} ${slot.label.toLowerCase()}${
          empty === 1 ? '' : 's'
        } this week — add recipes for it, or use Surprise me to plan from the web.`,
      )
    }
    warnings.push(...result.warnings.filter((warning) => !/^Nothing in your library fit/.test(warning)))
    for (const meal of result.slots) {
      if (meal.kind === 'recipe' && !meal.unfilled) cookingMeals.push({ meal, perMeal })
    }
  }

  // ---- Cook enough for the slots that eat from it ----
  if (leftoverDemand > 0 && cookingMeals.length) {
    // Spread evenly rather than rounding every session up, which would cook
    // three extra meals to cover one.
    const base = Math.floor(leftoverDemand / cookingMeals.length)
    const remainder = leftoverDemand % cookingMeals.length
    cookingMeals.forEach(({ meal, perMeal }, index) => {
      const each = base + (index < remainder ? 1 : 0)
      if (each === 0) return
      const before = meal.servings ?? meal.recipe?.servings ?? perMeal
      meal.servings = before + each * perMeal
      meal.reasons = [
        `Cooks ${meal.servings} servings — enough to eat again later in the week`,
        ...meal.reasons.filter((reason) => !reason.startsWith('Cooks ')),
      ]
    })
  }

  // ---- What is spare, once each cooking slot has fed its own leftover nights ----
  const spare = new Map<
    string,
    { title: string; recipe: Recipe; left: number; date: string; order: number }
  >()
  for (const [slotId, plan] of plans) {
    const perMeal = plan.slot.servings ?? defaultServings
    for (const meal of plan.meals) {
      if (meal.kind !== 'recipe' || !meal.recipe) continue
      const claimed = plan.meals.filter(
        (other) => other.kind === 'leftover' && other.sourceDate === meal.date,
      ).length
      const left = spareServings(meal, perMeal) - claimed
      if (left > 0) {
        spare.set(`${slotId}:${meal.date}`, {
          title: meal.recipe.title,
          recipe: meal.recipe,
          left,
          date: meal.date,
          order: slots.findIndex((entry) => entry.id === slotId),
        })
      }
    }
  }

  // ---- Everything that is not a cooking decision ----
  for (const slot of active.filter((slot) => slot.fill !== 'cook')) {
    const slotDates = datesFor(slot)
    const perMeal = slot.servings ?? defaultServings

    if (slot.fill === 'routine') {
      const name = slot.routine?.name?.trim()
      plans.set(slot.id, {
        slot,
        meals: slotDates.map((date) => ({
          date,
          mealType: slot.type,
          kind: 'custom' as const,
          customName: name || slot.label,
          servings: perMeal,
          reasons: name ? ['What you always have'] : [],
          unfilled: !name,
        })),
      })
      if (!name) warnings.push(`${slot.label} has no usual meal set — add one in Settings.`)
      continue
    }

    if (slot.fill === 'leftovers') {
      const order = slots.findIndex((entry) => entry.id === slot.id)
      const meals: GeneratedSlot[] = []
      for (const date of slotDates) {
        /*
         * The most recent cooking that has already happened by the time this
         * meal is eaten, and still has portions spare. "Already happened"
         * has to respect the order of the day as well as the calendar:
         * Monday's lunch cannot eat Monday's dinner, which is food that does
         * not exist yet — a bug that read perfectly plausibly on screen.
         */
        const source = [...spare.values()]
          .filter(
            (entry) =>
              entry.left > 0 &&
              (entry.date < date || (entry.date === date && entry.order < order)),
          )
          .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order)[0]

        if (!source) {
          meals.push({ date, mealType: slot.type, kind: 'recipe', reasons: [], unfilled: true })
          continue
        }

        source.left -= 1
        meals.push({
          date,
          mealType: slot.type,
          kind: 'leftover',
          recipeId: source.recipe.id,
          recipe: source.recipe,
          servings: perMeal,
          sourceDate: source.date,
          reasons: [`Leftovers from ${source.title}`],
        })
      }
      plans.set(slot.id, { slot, meals })
      const empty = meals.filter((meal) => meal.unfilled).length
      if (empty) {
        warnings.push(
          `${empty} ${slot.label.toLowerCase()}${empty === 1 ? '' : 's'} had no leftovers to eat — cook more often, or change that slot.`,
        )
      }
      continue
    }

    // 'open': the user said they would handle it.
    plans.set(slot.id, { slot, meals: [] })
  }

  // Back into the order they are eaten, whatever order they were planned in.
  const inOrder = slots
    .map((slot) => plans.get(slot.id))
    .filter((plan): plan is WeekSlotPlan => Boolean(plan))

  const all = inOrder.flatMap((plan) => plan.meals)
  return {
    plans: inOrder,
    warnings,
    cookSessions: all.filter((meal) => meal.kind === 'recipe' && !meal.unfilled).length,
    leftoverMeals: all.filter((meal) => meal.kind === 'leftover').length,
  }
}
