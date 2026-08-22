import type { CookingMethod, DayLoad, MealType, PlanningRequest, Recipe } from '@/models'
import { COOKING_METHOD_LABELS, DAY_LOAD_ACTIVE_LIMIT } from '@/models'
import { dayName } from '@/utils/date'
import { mealsCovered } from '@/services/recipeMetrics'
import {
  contextFromRequest,
  rankRecipes,
  type ScoringContext,
} from '@/services/recommendationEngine'

/**
 * The planner engine answers a different question from the recommender.
 *
 * The recommender asks "which recipe fits this slot?". This asks "how should
 * cooking and leftovers be spread across the week?" — which is why five dinners
 * do not mean five cooking sessions. Cook nights are placed on the days with
 * room for them, each cooking session is asked to cover the leftover nights
 * that follow it, and the ingredients for those leftover nights are never
 * bought twice.
 */

export interface GeneratedSlot {
  date: string
  mealType: MealType
  /**
   * `custom` is how a routine slot arrives — "a bowl of Special K" is a meal
   * with no recipe behind it, and the week has to be able to say so.
   */
  kind: 'recipe' | 'leftover' | 'custom'
  recipeId?: string
  /** For `custom`: what the user always has. */
  customName?: string
  recipe?: Recipe
  servings?: number
  reasons: string[]
  /** For a leftover slot: the date of the cook session it eats from. */
  sourceDate?: string
  locked?: boolean
  /** Set when the slot could not be filled, so the UI can say why. */
  unfilled?: boolean
}

export interface GeneratedPlan {
  slots: GeneratedSlot[]
  warnings: string[]
  cookSessions: number
  leftoverMeals: number
}

export interface GenerateOptions {
  request: PlanningRequest
  library: Recipe[]
  context?: Partial<ScoringContext>
}

const COOKABILITY: Record<DayLoad, number> = {
  free: 3,
  normal: 2,
  busy: 1,
  minimal: 0,
}

export function generatePlan(options: GenerateOptions): GeneratedPlan {
  const { request, library } = options
  const warnings: string[] = []

  const perMeal = request.servingsPerMeal ?? 4
  const dates = request.dates.slice(
    0,
    request.mealsNeeded > 0 ? request.mealsNeeded : request.dates.length,
  )

  const lockedByDate = new Map(
    (request.lockedMeals ?? [])
      .filter((meal) => meal.locked)
      .map((meal) => [meal.date, meal]),
  )

  const baseContext: ScoringContext = {
    ...contextFromRequest(request),
    ...options.context,
  }

  if (!library.length) {
    return {
      slots: dates.map((date) => emptySlot(date, request.mealType)),
      warnings: ['Your recipe library is empty, so there is nothing to plan yet.'],
      cookSessions: 0,
      leftoverMeals: 0,
    }
  }

  // ---- Decide which nights are cooking nights ----
  const openIndexes = dates
    .map((date, index) => ({ date, index }))
    .filter(({ date }) => !lockedByDate.has(date))

  const lockedCookCount = [...lockedByDate.values()].filter(
    (meal) => meal.kind === 'recipe',
  ).length

  const wantsLeftovers = request.preferLeftovers !== false
  const targetCook = wantsLeftovers
    ? (request.targetCookSessions ?? dates.length)
    : dates.length
  const openCookTarget = clamp(targetCook - lockedCookCount, 0, openIndexes.length)

  const cookDates = chooseCookDays(request, openIndexes, openCookTarget)
  // Somebody has to cook first; an opening leftover night has no source.
  if (openIndexes.length && openCookTarget > 0) {
    const first = openIndexes[0]
    if (!cookDates.has(first.date) && !hasEarlierCook(dates, first.index, lockedByDate)) {
      const lastCook = [...cookDates].pop()
      if (lastCook) cookDates.delete(lastCook)
      cookDates.add(first.date)
    }
  }

  // ---- Walk the week, filling slots ----
  const slots: GeneratedSlot[] = []
  const usedRecipeIds = new Set<string>()
  const chosenRecipes: Recipe[] = []
  /** Cook sessions with leftover portions still unspoken for. */
  const pantryOfLeftovers: Array<{ date: string; recipe: Recipe; remaining: number }> = []

  const requiredMethods = new Set(request.requiredMethods ?? [])

  for (const [index, date] of dates.entries()) {
    const locked = lockedByDate.get(date)
    if (locked) {
      const recipe = library.find((r) => r.id === locked.recipeId)
      if (recipe && locked.kind === 'recipe') {
        usedRecipeIds.add(recipe.id)
        chosenRecipes.push(recipe)
        const covered = mealsCovered(recipe, perMeal) - 1
        if (covered > 0) {
          pantryOfLeftovers.push({ date, recipe, remaining: covered })
        }
      }
      slots.push({
        date,
        mealType: request.mealType,
        kind: locked.kind === 'leftover' ? 'leftover' : 'recipe',
        recipeId: locked.recipeId,
        recipe,
        servings: locked.servings,
        reasons: ['You locked this one'],
        locked: true,
      })
      continue
    }

    const shouldCook = cookDates.has(date)

    if (!shouldCook) {
      const source = pantryOfLeftovers.find((entry) => entry.remaining > 0)
      if (source) {
        source.remaining -= 1
        slots.push({
          date,
          mealType: request.mealType,
          kind: 'leftover',
          recipeId: source.recipe.id,
          recipe: source.recipe,
          servings: perMeal,
          sourceDate: source.date,
          reasons: [`Leftovers from ${dayName(source.date)}`],
        })
        continue
      }
      // Nothing in the fridge to eat, so this becomes a cooking night after
      // all rather than an empty evening.
      cookDates.add(date)
    }

    // How many leftover nights lean on this session?
    const dependents = countFollowingLeftovers(dates, index, cookDates, lockedByDate)
    const minServings = (dependents + 1) * perMeal

    const remainingCookSlots = countRemainingCookSlots(dates, index, cookDates)
    const unmetMethods = [...requiredMethods].filter(
      (method) => !chosenRecipes.some((recipe) => recipe.cookingMethods.includes(method)),
    )

    const context: ScoringContext = {
      ...baseContext,
      dayLoad: request.dayLoads?.[date],
      maxActiveTimeMinutes:
        request.maxActiveTimeMinutes ?? loadLimit(request.dayLoads?.[date]),
      chosenRecipes,
      minServings,
    }

    const candidates = rankRecipes(
      library.filter((recipe) => !usedRecipeIds.has(recipe.id)),
      context,
    )

    // When the remaining cooking nights exactly cover the still-missing "at
    // least one slow cooker meal" style requests, this night has to take one.
    const mustUseMethod =
      unmetMethods.length > 0 && remainingCookSlots <= unmetMethods.length
        ? unmetMethods[0]
        : undefined

    const chosen = pickRecipe(candidates, {
      minServings: dependents > 0 ? minServings : undefined,
      requiredMethod: mustUseMethod,
    })

    if (!chosen) {
      slots.push({ ...emptySlot(date, request.mealType) })
      warnings.push(
        `Nothing in your library fit ${request.mealType === 'dinner' ? '' : `${request.mealType} on `}${dayName(date)}.`,
      )
      continue
    }

    usedRecipeIds.add(chosen.recipe.id)
    chosenRecipes.push(chosen.recipe)

    const servings = Math.max(chosen.recipe.servings ?? perMeal, minServings)
    const covered = Math.floor(servings / perMeal) - 1
    if (covered > 0) {
      pantryOfLeftovers.push({ date, recipe: chosen.recipe, remaining: covered })
    }

    const reasons = [...chosen.reasons]
    if (mustUseMethod) {
      reasons.unshift(`A ${COOKING_METHOD_LABELS[mustUseMethod].toLowerCase()} meal, as requested`)
    }
    if (dependents > 0) {
      reasons.unshift(
        `Cooks ${servings} servings — enough for ${dependents + 1} ${
          dependents + 1 === 2 ? 'nights' : 'nights'
        }`,
      )
    }

    slots.push({
      date,
      mealType: request.mealType,
      kind: 'recipe',
      recipeId: chosen.recipe.id,
      recipe: chosen.recipe,
      servings,
      reasons: reasons.slice(0, 4),
    })
  }

  const cookSessions = slots.filter((slot) => slot.kind === 'recipe' && slot.recipe).length
  const leftoverMeals = slots.filter((slot) => slot.kind === 'leftover').length

  if (wantsLeftovers && request.targetCookSessions && cookSessions > request.targetCookSessions) {
    warnings.push(
      `MealHelp had to cook ${cookSessions} times instead of ${request.targetCookSessions} — your recipes do not make enough servings to stretch further.`,
    )
  }

  return { slots, warnings, cookSessions, leftoverMeals }
}

export interface PickOptions {
  minServings?: number
  requiredMethod?: CookingMethod
}

export function pickRecipe(
  candidates: ReturnType<typeof rankRecipes>,
  options: PickOptions,
): (typeof candidates)[number] | undefined {
  if (!candidates.length) return undefined

  const withMethod = options.requiredMethod
    ? candidates.filter((candidate) =>
        candidate.recipe.cookingMethods.includes(options.requiredMethod as CookingMethod),
      )
    : candidates

  const pool = withMethod.length ? withMethod : candidates

  if (options.minServings) {
    const bigEnough = pool.filter(
      (candidate) => (candidate.recipe.servings ?? 0) >= options.minServings!,
    )
    // Falling back is deliberate: a slightly small batch beats an empty night,
    // and the plan preview shows the servings so the user can adjust.
    if (bigEnough.length) return bigEnough[0]
  }

  return pool[0]
}

function emptySlot(date: string, mealType: MealType): GeneratedSlot {
  return {
    date,
    mealType,
    kind: 'recipe',
    reasons: [],
    unfilled: true,
  }
}

/**
 * Picks which nights are cooking nights.
 *
 * Spacing is the whole point here: cooking Monday, Tuesday and Wednesday and
 * then eating four-day-old food on Friday is not what "cook three times" means.
 * A week is at most seven days, so every combination is simply scored and the
 * best one wins — which keeps the rule readable instead of hiding it in a
 * greedy heuristic that has to be argued with.
 *
 * Day loads still dominate: a free Tuesday outweighs a tidier-looking pattern.
 */
function chooseCookDays(
  request: PlanningRequest,
  openSlots: Array<{ date: string; index: number }>,
  count: number,
): Set<string> {
  if (count <= 0 || !openSlots.length) return new Set()
  if (count >= openSlots.length) return new Set(openSlots.map((slot) => slot.date))

  let best: Array<{ date: string; index: number }> = []
  let bestScore = -Infinity

  const consider = (combination: Array<{ date: string; index: number }>) => {
    const score = scoreCookPattern(request, combination)
    if (score > bestScore) {
      bestScore = score
      best = combination
    }
  }

  const walk = (
    start: number,
    picked: Array<{ date: string; index: number }>,
  ): void => {
    if (picked.length === count) {
      consider(picked)
      return
    }
    for (let i = start; i < openSlots.length; i++) {
      walk(i + 1, [...picked, openSlots[i]])
    }
  }

  walk(0, [])
  return new Set(best.map((slot) => slot.date))
}

/** Higher is better: days with time to cook, spread out, starting early. */
function scoreCookPattern(
  request: PlanningRequest,
  combination: Array<{ date: string; index: number }>,
): number {
  let score = 0

  for (const slot of combination) score += cookability(request, slot.date) * 4

  for (let i = 1; i < combination.length; i++) {
    const gap = combination[i].index - combination[i - 1].index
    // Back-to-back cooking defeats the point; three days apart is about as long
    // as leftovers should be asked to stretch.
    if (gap === 1) score -= 8
    else if (gap === 3) score += 1
    else if (gap > 3) score -= (gap - 3) * 0.5
  }

  // Something has to be cooked before anything can be a leftover.
  score -= combination[0].index * 0.5

  return score
}

function cookability(request: PlanningRequest, date: string): number {
  const load = request.dayLoads?.[date] ?? 'normal'
  let score = COOKABILITY[load]
  if (request.allowedCookingDays?.length) {
    score += request.allowedCookingDays.includes(date) ? 5 : -10
  }
  return score
}

export function loadLimit(load: DayLoad | undefined): number | undefined {
  if (!load) return undefined
  const limit = DAY_LOAD_ACTIVE_LIMIT[load]
  return limit >= 999 ? undefined : limit
}

function hasEarlierCook(
  dates: string[],
  index: number,
  locked: Map<string, { kind: string }>,
): boolean {
  return dates
    .slice(0, index)
    .some((date) => locked.get(date)?.kind === 'recipe')
}

function countFollowingLeftovers(
  dates: string[],
  index: number,
  cookDates: Set<string>,
  locked: Map<string, unknown>,
): number {
  let count = 0
  for (let i = index + 1; i < dates.length; i++) {
    const date = dates[i]
    if (locked.has(date)) break
    if (cookDates.has(date)) break
    count++
  }
  return count
}

function countRemainingCookSlots(
  dates: string[],
  index: number,
  cookDates: Set<string>,
): number {
  let count = 0
  for (let i = index; i < dates.length; i++) {
    if (cookDates.has(dates[i])) count++
  }
  return count
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
