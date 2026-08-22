import { db } from './database'
import { recordDeletion, recordDeletions } from './deletions'
import type { MealPlan, MealType, PlannedMeal, PlannedMealKind } from '@/models'
import { newId, nowISO } from '@/utils/id'

export async function getPlanByWeek(weekStart: string): Promise<MealPlan | undefined> {
  return db.mealPlans.where('weekStart').equals(weekStart).first()
}

/** A week exists as soon as you look at it; planning into it is the same act. */
export async function getOrCreatePlan(weekStart: string): Promise<MealPlan> {
  const existing = await getPlanByWeek(weekStart)
  if (existing) return existing
  const now = nowISO()
  const plan: MealPlan = {
    id: newId('plan'),
    weekStart,
    createdAt: now,
    updatedAt: now,
  }
  await db.mealPlans.put(plan)
  return plan
}

export async function listPlans(): Promise<MealPlan[]> {
  const plans = await db.mealPlans.toArray()
  return plans.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

export async function listPlannedMeals(planId: string): Promise<PlannedMeal[]> {
  const meals = await db.plannedMeals.where('planId').equals(planId).toArray()
  return meals.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.order ?? 0) - (b.order ?? 0),
  )
}

export async function listPlannedMealsForDates(
  dates: string[],
): Promise<PlannedMeal[]> {
  if (!dates.length) return []
  return db.plannedMeals.where('date').anyOf(dates).toArray()
}

export interface PlannedMealInput {
  planId: string
  date: string
  mealType: MealType
  slotId?: string
  kind: PlannedMealKind
  recipeId?: string
  customName?: string
  servings?: number
  notes?: string
  sourceCookEventId?: string
  sourcePlannedMealId?: string
  isLeftover?: boolean
  locked?: boolean
  reasons?: string[]
}

export async function addPlannedMeal(input: PlannedMealInput): Promise<PlannedMeal> {
  const now = nowISO()
  const meal: PlannedMeal = {
    id: newId('pm'),
    ...input,
    isLeftover: input.isLeftover ?? input.kind === 'leftover',
    createdAt: now,
    updatedAt: now,
  }
  await db.plannedMeals.put(meal)
  await touchPlan(input.planId)
  return meal
}

export async function updatePlannedMeal(
  id: string,
  patch: Partial<PlannedMeal>,
): Promise<void> {
  const existing = await db.plannedMeals.get(id)
  if (!existing) return
  await db.plannedMeals.put({ ...existing, ...patch, id, updatedAt: nowISO() })
  await touchPlan(existing.planId)
}

export async function deletePlannedMeal(id: string): Promise<void> {
  const existing = await db.plannedMeals.get(id)
  await db.plannedMeals.delete(id)
  await recordDeletion('plannedMeals', id)
  // A leftover night whose source is gone is a night with nothing to eat.
  if (existing) {
    const dependents = await db.plannedMeals
      .where('planId')
      .equals(existing.planId)
      .filter((meal) => meal.sourcePlannedMealId === id)
      .toArray()
    await Promise.all(
      dependents.map((meal) =>
        db.plannedMeals.put({
          ...meal,
          sourcePlannedMealId: undefined,
          updatedAt: nowISO(),
        }),
      ),
    )
    await touchPlan(existing.planId)
  }
}

export async function movePlannedMeal(
  id: string,
  date: string,
  mealType?: MealType,
  slotId?: string,
): Promise<void> {
  // Dropping a meal on a day drops it into that day's slot, so dragging
  // Tuesday's dinner onto Saturday's lunch makes it a lunch.
  await updatePlannedMeal(id, {
    date,
    ...(mealType ? { mealType } : {}),
    ...(slotId ? { slotId } : {}),
  })
}

export async function duplicatePlannedMeal(id: string): Promise<void> {
  const existing = await db.plannedMeals.get(id)
  if (!existing) return
  const now = nowISO()
  await db.plannedMeals.put({
    ...existing,
    id: newId('pm'),
    locked: false,
    createdAt: now,
    updatedAt: now,
  })
  await touchPlan(existing.planId)
}

/**
 * Commits an accepted plan. Locked meals are kept exactly as they are, so
 * accepting a regenerated week never overwrites something the user pinned.
 */
export async function replacePlanMeals(
  planId: string,
  meals: PlannedMealInput[],
  options: { mealType?: MealType; slotIds?: string[]; dates?: string[] } = {},
): Promise<void> {
  const existing = await listPlannedMeals(planId)
  const doomed = existing.filter((meal) => {
    if (options.mealType && meal.mealType !== options.mealType) return false
    /*
     * Two slots can share a meal type — two breakfasts, or a lunch and a
     * post-gym snack — so a regenerated week clears by slot. A meal saved
     * before slots existed has no slotId and is matched by its type, which is
     * what the mealType filter above is still for.
     */
    if (options.slotIds && meal.slotId && !options.slotIds.includes(meal.slotId)) return false
    if (options.dates && !options.dates.includes(meal.date)) return false
    return true
  })

  await db.transaction('rw', db.plannedMeals, db.mealPlans, db.deletions, async () => {
    await db.plannedMeals.bulkDelete(doomed.map((meal) => meal.id))
    await recordDeletions('plannedMeals', doomed.map((meal) => meal.id))
    const now = nowISO()
    await db.plannedMeals.bulkPut(
      meals.map((meal) => ({
        id: newId('pm'),
        ...meal,
        isLeftover: meal.isLeftover ?? meal.kind === 'leftover',
        createdAt: now,
        updatedAt: now,
      })),
    )
    const plan = await db.mealPlans.get(planId)
    if (plan) {
      await db.mealPlans.put({ ...plan, acceptedAt: now, updatedAt: now })
    }
  })
}

/** "Copy previous week" — the same meals, moved forward, history reset. */
export async function copyWeek(
  fromWeekStart: string,
  toWeekStart: string,
): Promise<number> {
  const source = await getPlanByWeek(fromWeekStart)
  if (!source) return 0
  const meals = await listPlannedMeals(source.id)
  if (!meals.length) return 0

  const target = await getOrCreatePlan(toWeekStart)
  const offsetDays = Math.round(
    (new Date(toWeekStart).getTime() - new Date(fromWeekStart).getTime()) / 86_400_000,
  )
  const now = nowISO()

  const copies: PlannedMeal[] = meals.map((meal) => {
    const date = new Date(meal.date)
    date.setDate(date.getDate() + offsetDays)
    return {
      ...meal,
      id: newId('pm'),
      planId: target.id,
      date: date.toISOString().slice(0, 10),
      locked: false,
      sourceCookEventId: undefined,
      createdAt: now,
      updatedAt: now,
    }
  })

  await db.plannedMeals.bulkPut(copies)
  return copies.length
}

async function touchPlan(planId: string): Promise<void> {
  const plan = await db.mealPlans.get(planId)
  if (plan) await db.mealPlans.put({ ...plan, updatedAt: nowISO() })
}
