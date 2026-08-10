import type {
  BudgetLevel,
  CookingMethod,
  DayLoad,
  EffortLevel,
  MealType,
  PlanningRequest,
  Recipe,
  VarietyMode,
} from '@/models'
import {
  COOKING_METHOD_LABELS,
  DAY_LOAD_ACTIVE_LIMIT,
  EFFORT_RANK,
  METHOD_EQUIPMENT,
} from '@/models'
import { daysSince, humanAgo } from '@/utils/date'
import {
  activeMinutes,
  bulkScore,
  cleanupScore,
  effortLevel,
  ingredientKeys,
  leftoverScore,
  weeknightScore,
} from '@/services/recipeMetrics'
import { normalizeIngredientKey } from '@/services/ingredientParser'

/**
 * Recipe ranking.
 *
 * Every contribution is a named factor so a suggestion can explain itself and
 * so the weights can be argued with in one place instead of being scattered
 * through components. Nothing here touches the database or React.
 */

export interface ScoringFactor {
  name: string
  points: number
  /** Shown to the user under "Recommended because". */
  reason?: string
}

export interface ScoredRecipe {
  recipe: Recipe
  score: number
  factors: ScoringFactor[]
  reasons: string[]
  /** Set when the recipe cannot be used at all; it is filtered out, not ranked. */
  excluded?: string
}

export interface ScoringContext {
  mealType?: MealType
  dayLoad?: DayLoad
  /** Hard ceiling on hands-on minutes for this slot. */
  maxActiveTimeMinutes?: number
  preferredMethods?: CookingMethod[]
  preferredEffort?: EffortLevel
  budgetPreference?: BudgetLevel
  preferLeftovers?: boolean
  variety?: VarietyMode
  avoidRecentlyCooked?: boolean
  usePantryFirst?: boolean
  /** Normalized keys of pantry staples the user says they always have. */
  pantryKeys?: Set<string>
  /** Ingredients the user asked to use up. */
  useUpIngredients?: string[]
  /** Already chosen this week — drives variety and grocery overlap. */
  chosenRecipes?: Recipe[]
  equipmentOwned?: string[]
  recentlyCookedHardDays?: number
  recentlyCookedSoftDays?: number
  /** Minimum servings the slot needs, when leftovers hang off it. */
  minServings?: number
}

const WEIGHTS = {
  favorite: 9,
  ratingPerStar: 4,
  makeAgainPenalty: -40,
  leftovers: 4,
  bulk: 3,
  methodMatch: 12,
  effortMatch: 8,
  weeknight: 3,
  cleanup: 2,
  pantryOverlap: 8,
  useUp: 16,
  groceryOverlap: 5,
  recentHard: -35,
  recentSoft: -12,
  rejected: -3,
  neverCooked: 6,
  budgetMatch: 5,
  activeTimeOver: -18,
} as const

export function scoreRecipe(recipe: Recipe, context: ScoringContext): ScoredRecipe {
  const factors: ScoringFactor[] = []

  const excluded = disqualify(recipe, context)
  if (excluded) {
    return { recipe, score: -Infinity, factors, reasons: [], excluded }
  }

  const push = (name: string, points: number, reason?: string) => {
    if (points === 0) return
    factors.push({ name, points, reason })
  }

  // ---- What the user already thinks of it ----
  if (recipe.favorite) push('favorite', WEIGHTS.favorite, 'One of your favorites')

  if (recipe.rating != null) {
    const points = (recipe.rating - 3) * WEIGHTS.ratingPerStar
    push(
      'rating',
      points,
      recipe.rating >= 4 ? `You rated it ${recipe.rating}/5` : undefined,
    )
  }

  if (recipe.makeAgain === false) {
    push('make-again', WEIGHTS.makeAgainPenalty)
  }

  // ---- Fit for the week's shape ----
  if (context.preferLeftovers) {
    const leftovers = leftoverScore(recipe)
    push(
      'leftovers',
      (leftovers - 3) * WEIGHTS.leftovers,
      leftovers >= 4 ? 'Great leftovers' : undefined,
    )
    const bulk = bulkScore(recipe)
    push(
      'bulk',
      (bulk - 3) * WEIGHTS.bulk,
      bulk >= 4 && recipe.servings ? `Makes ${recipe.servings} servings` : undefined,
    )
  }

  // ---- Equipment and method preferences ----
  const preferred = context.preferredMethods ?? []
  const matched = recipe.cookingMethods.filter((method) => preferred.includes(method))
  if (matched.length) {
    push(
      'method',
      WEIGHTS.methodMatch,
      `${COOKING_METHOD_LABELS[matched[0]]} meal, which you asked for`,
    )
  }

  // ---- Time and effort ----
  const active = Math.round(activeMinutes(recipe))
  const limit = context.maxActiveTimeMinutes ?? dayLimit(context.dayLoad)
  if (limit && active > limit) {
    // Over the ceiling is a strong signal, not a veto: a locked-down Friday
    // should not go empty just because nothing is fast enough.
    const overshoot = Math.min(3, (active - limit) / Math.max(10, limit))
    push('active-time', WEIGHTS.activeTimeOver * overshoot)
  } else if (limit && active <= limit * 0.6) {
    push('active-time', 6, `Only ${active} min of hands-on work`)
  }

  if (context.preferredEffort) {
    const distance = Math.abs(
      EFFORT_RANK[effortLevel(recipe)] - EFFORT_RANK[context.preferredEffort],
    )
    const points = (1 - distance) * WEIGHTS.effortMatch
    push(
      'effort',
      points,
      distance === 0 && EFFORT_RANK[context.preferredEffort] <= 1
        ? 'Low effort, like you asked'
        : undefined,
    )
  }

  if (context.dayLoad === 'busy' || context.dayLoad === 'minimal') {
    const weeknight = weeknightScore(recipe)
    push(
      'weeknight',
      (weeknight - 3) * WEIGHTS.weeknight,
      weeknight >= 4 ? 'Easy enough for a busy night' : undefined,
    )
    const cleanup = cleanupScore(recipe)
    push('cleanup', (cleanup - 3) * WEIGHTS.cleanup)
  }

  // ---- Ingredients you already have, or need to use ----
  const keys = ingredientKeys(recipe).map(normalizeIngredientKey)

  if (context.usePantryFirst && context.pantryKeys?.size && keys.length) {
    const owned = keys.filter((key) => context.pantryKeys?.has(key)).length
    const share = owned / keys.length
    push(
      'pantry',
      share * WEIGHTS.pantryOverlap,
      share > 0.4 ? 'Uses a lot of what you already have' : undefined,
    )
  }

  if (context.useUpIngredients?.length) {
    const wanted = context.useUpIngredients.map(normalizeIngredientKey)
    const hit = wanted.find((want) =>
      keys.some((key) => key.includes(want) || want.includes(key)),
    )
    if (hit) push('use-up', WEIGHTS.useUp, `Uses the ${hit} you wanted to use up`)
  }

  if (context.chosenRecipes?.length && keys.length) {
    const chosenKeys = new Set(
      context.chosenRecipes.flatMap((other) =>
        ingredientKeys(other).map(normalizeIngredientKey),
      ),
    )
    const shared = keys.filter((key) => chosenKeys.has(key)).length
    // Capped deliberately: shared shopping is nice, seven variations on the
    // same three vegetables is not.
    const share = Math.min(0.5, shared / keys.length)
    push('grocery-overlap', share * WEIGHTS.groceryOverlap)
  }

  // ---- History and variety ----
  const sinceCooked = daysSince(recipe.lastCookedAt)
  const hardDays = context.recentlyCookedHardDays ?? 7
  const softDays = context.recentlyCookedSoftDays ?? 30
  if (sinceCooked != null && context.avoidRecentlyCooked !== false) {
    if (sinceCooked <= hardDays) {
      push('recent', WEIGHTS.recentHard)
    } else if (sinceCooked <= softDays) {
      const decay = 1 - (sinceCooked - hardDays) / (softDays - hardDays)
      push('recent', WEIGHTS.recentSoft * decay)
    } else {
      push('recent', 3, `Haven't cooked it in ${humanAgo(sinceCooked)}`)
    }
  }

  if (recipe.timesRejected) {
    push('rejected', recipe.timesRejected * WEIGHTS.rejected)
  }

  applyVariety(recipe, context.variety, push)

  // ---- Budget ----
  if (context.budgetPreference && recipe.costTier) {
    const wanted = context.budgetPreference.length
    const actual = recipe.costTier.length
    if (actual <= wanted) {
      push(
        'budget',
        WEIGHTS.budgetMatch,
        wanted === 1 && actual === 1 ? 'Cheap to make' : undefined,
      )
    } else {
      push('budget', -WEIGHTS.budgetMatch * (actual - wanted))
    }
  }

  const score = factors.reduce((total, factor) => total + factor.points, 0)
  const reasons = factors
    .filter((factor) => factor.reason && factor.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((factor) => factor.reason as string)

  return { recipe, score, factors, reasons }
}

function applyVariety(
  recipe: Recipe,
  variety: VarietyMode | undefined,
  push: (name: string, points: number, reason?: string) => void,
): void {
  const cooked = recipe.timesCooked ?? 0
  switch (variety) {
    case 'mostly-favorites':
      if (recipe.favorite) push('variety', 8)
      if (cooked === 0) push('variety-new', -6)
      break
    case 'try-new':
      if (cooked === 0) push('variety-new', WEIGHTS.neverCooked + 6, 'You have never made it')
      break
    case 'avoid-recent':
      if (cooked === 0) push('variety-new', WEIGHTS.neverCooked)
      break
    case 'mixed':
    default:
      if (cooked === 0) push('variety-new', 3)
      break
  }
}

function dayLimit(load: DayLoad | undefined): number | undefined {
  if (!load) return undefined
  const limit = DAY_LOAD_ACTIVE_LIMIT[load]
  return limit >= 999 ? undefined : limit
}

/** Reasons a recipe cannot fill a slot at all, as opposed to fitting it badly. */
function disqualify(recipe: Recipe, context: ScoringContext): string | undefined {
  if (context.mealType && recipe.mealTypes.length) {
    if (!recipe.mealTypes.includes(context.mealType)) {
      return `Not a ${context.mealType} recipe`
    }
  }

  if (context.equipmentOwned) {
    const owned = new Set(context.equipmentOwned)
    for (const method of recipe.cookingMethods) {
      const needed = METHOD_EQUIPMENT[method]
      if (needed && !owned.has(needed)) {
        return `Needs a ${needed.toLowerCase()} you don't have`
      }
    }
  }

  return undefined
}

/** Ranks a library for one slot, best first, with unusable recipes removed. */
export function rankRecipes(
  recipes: Recipe[],
  context: ScoringContext,
): ScoredRecipe[] {
  return recipes
    .map((recipe) => scoreRecipe(recipe, context))
    .filter((scored) => !scored.excluded)
    .sort((a, b) => b.score - a.score)
}

/** Turns a planning request into the context used for every slot in it. */
export function contextFromRequest(
  request: PlanningRequest,
  extras: Pick<
    ScoringContext,
    'pantryKeys' | 'equipmentOwned' | 'recentlyCookedHardDays' | 'recentlyCookedSoftDays'
  > = {},
): ScoringContext {
  return {
    mealType: request.mealType,
    maxActiveTimeMinutes: request.maxActiveTimeMinutes,
    preferredMethods: request.preferredCookingMethods,
    preferredEffort: request.preferredEffort,
    budgetPreference: request.budgetPreference,
    preferLeftovers: request.preferLeftovers,
    variety: request.variety,
    avoidRecentlyCooked: request.avoidRecentlyCooked,
    usePantryFirst: request.usePantryFirst,
    useUpIngredients: request.useUpIngredients,
    ...extras,
  }
}
