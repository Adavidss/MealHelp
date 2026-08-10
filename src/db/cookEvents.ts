import { db } from './database'
import type { CookEvent, CookFeedback, FeedbackTag, FeedbackVerdict, Recipe } from '@/models'
import { newId, nowISO } from '@/utils/id'
import { todayISO } from '@/utils/date'

/**
 * Cooking is recorded as an event rather than as a flag on the recipe, because
 * the interesting fact — "there are four servings of curry in the fridge" — is
 * about Monday night, not about the curry.
 */
export async function recordCookEvent(input: {
  recipe: Recipe
  servingsMade: number
  servingsConsumed?: number
  date?: string
  plannedMealId?: string
  notes?: string
}): Promise<CookEvent> {
  const now = nowISO()
  const date = input.date ?? todayISO()
  const consumed = Math.min(input.servingsConsumed ?? 0, input.servingsMade)

  const event: CookEvent = {
    id: newId('cook'),
    recipeId: input.recipe.id,
    recipeTitle: input.recipe.title,
    date,
    servingsMade: input.servingsMade,
    servingsConsumed: consumed,
    remainingServings: Math.max(0, input.servingsMade - consumed),
    plannedMealId: input.plannedMealId,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.cookEvents, db.recipes, async () => {
    await db.cookEvents.put(event)
    const recipe = await db.recipes.get(input.recipe.id)
    if (recipe) {
      await db.recipes.put({
        ...recipe,
        timesCooked: (recipe.timesCooked ?? 0) + 1,
        lastCookedAt: new Date(`${date}T18:00:00`).toISOString(),
        updatedAt: now,
      })
    }
  })

  return event
}

export async function listCookEvents(): Promise<CookEvent[]> {
  const events = await db.cookEvents.toArray()
  return events.sort((a, b) => b.date.localeCompare(a.date))
}

/** What is actually in the fridge right now. */
export async function listAvailableLeftovers(): Promise<CookEvent[]> {
  const events = await db.cookEvents.toArray()
  return events
    .filter((event) => event.remainingServings > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function consumeLeftovers(
  eventId: string,
  servings: number,
): Promise<void> {
  const event = await db.cookEvents.get(eventId)
  if (!event) return
  const eaten = Math.min(servings, event.remainingServings)
  await db.cookEvents.put({
    ...event,
    servingsConsumed: event.servingsConsumed + eaten,
    remainingServings: event.remainingServings - eaten,
    updatedAt: nowISO(),
  })
}

export async function updateCookEvent(
  id: string,
  patch: Partial<CookEvent>,
): Promise<void> {
  const event = await db.cookEvents.get(id)
  if (!event) return
  const next = { ...event, ...patch, id, updatedAt: nowISO() }
  next.remainingServings = Math.max(0, next.servingsMade - next.servingsConsumed)
  await db.cookEvents.put(next)
}

export async function deleteCookEvent(id: string): Promise<void> {
  await db.cookEvents.delete(id)
}

/**
 * Feedback both records what happened and feeds the recommender: a verdict
 * moves the recipe's rating and its "make again" flag, which is what the
 * scorer actually reads.
 */
export async function recordFeedback(input: {
  recipeId: string
  cookEventId?: string
  verdict?: FeedbackVerdict
  rating?: number
  tags?: FeedbackTag[]
  note?: string
}): Promise<CookFeedback> {
  const now = nowISO()
  const feedback: CookFeedback = {
    id: newId('fb'),
    recipeId: input.recipeId,
    cookEventId: input.cookEventId,
    date: todayISO(),
    verdict: input.verdict,
    rating: input.rating,
    tags: input.tags ?? [],
    note: input.note,
    createdAt: now,
  }

  await db.transaction('rw', db.feedback, db.recipes, async () => {
    await db.feedback.put(feedback)
    const recipe = await db.recipes.get(input.recipeId)
    if (!recipe) return

    const rating = input.rating ?? ratingFromVerdict(input.verdict)
    const patch: Partial<Recipe> = { updatedAt: now }
    if (rating != null) patch.rating = rating
    if (input.verdict) patch.makeAgain = input.verdict !== 'never-again'
    if (input.verdict === 'loved') patch.favorite = true

    // Tags the user chose are more reliable than anything MealHelp inferred.
    if (input.tags?.includes('great-leftovers')) {
      patch.leftoverScore = 5
      patch.reheatsWell = true
    }
    if (input.tags?.includes('too-much-work')) patch.effort = 'high'
    if (input.tags?.includes('easy')) patch.effort = 'low'
    if (input.tags?.includes('too-expensive')) patch.costTier = '$$$'

    await db.recipes.put({ ...recipe, ...patch })
  })

  return feedback
}

function ratingFromVerdict(verdict: FeedbackVerdict | undefined): number | undefined {
  switch (verdict) {
    case 'loved':
      return 5
    case 'good':
      return 4
    case 'okay':
      return 3
    case 'never-again':
      return 1
    default:
      return undefined
  }
}

export async function listFeedbackForRecipe(recipeId: string): Promise<CookFeedback[]> {
  const rows = await db.feedback.where('recipeId').equals(recipeId).toArray()
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Records that a suggestion was turned down. Rejections nudge a recipe down the
 * rankings without ever removing it from the library.
 */
export async function recordRejection(recipeId: string): Promise<void> {
  const recipe = await db.recipes.get(recipeId)
  if (!recipe) return
  await db.recipes.put({
    ...recipe,
    timesRejected: (recipe.timesRejected ?? 0) + 1,
    updatedAt: nowISO(),
  })
}

export async function recordPlanned(recipeIds: string[]): Promise<void> {
  const now = nowISO()
  const recipes = await db.recipes.bulkGet(recipeIds)
  const updates = recipes
    .filter((recipe): recipe is Recipe => Boolean(recipe))
    .map((recipe) => ({
      ...recipe,
      timesPlanned: (recipe.timesPlanned ?? 0) + 1,
      lastPlannedAt: now,
      updatedAt: now,
    }))
  if (updates.length) await db.recipes.bulkPut(updates)
}
