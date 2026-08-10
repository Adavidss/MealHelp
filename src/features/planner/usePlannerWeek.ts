import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { getOrCreatePlan } from '@/db/plans'
import type { CookEvent, MealPlan, PlannedMeal, Recipe } from '@/models'
import { weekDates } from '@/utils/date'

export interface PlannerWeek {
  weekStart: string
  dates: string[]
  plan?: MealPlan
  meals: PlannedMeal[]
  mealsByDate: Map<string, PlannedMeal[]>
  recipesById: Map<string, Recipe>
  leftovers: CookEvent[]
  loading: boolean
}

/**
 * Everything the planner screens need for one week, read live from IndexedDB so
 * a change made in a dialog shows up on the grid behind it without any manual
 * refetching.
 */
export function usePlannerWeek(weekStart: string): PlannerWeek {
  const dates = useMemo(() => weekDates(weekStart), [weekStart])

  const plan = useLiveQuery(() => getOrCreatePlan(weekStart), [weekStart])

  const meals = useLiveQuery(
    async () => (plan ? db.plannedMeals.where('planId').equals(plan.id).toArray() : []),
    [plan?.id],
    [] as PlannedMeal[],
  )

  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])

  const leftovers = useLiveQuery(
    async () => {
      const events = await db.cookEvents.toArray()
      return events
        .filter((event) => event.remainingServings > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
    },
    [],
    [] as CookEvent[],
  )

  const mealsByDate = useMemo(() => {
    const map = new Map<string, PlannedMeal[]>()
    for (const date of dates) map.set(date, [])
    for (const meal of meals ?? []) {
      const bucket = map.get(meal.date)
      if (bucket) bucket.push(meal)
      else map.set(meal.date, [meal])
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    return map
  }, [meals, dates])

  const recipesById = useMemo(
    () => new Map((recipes ?? []).map((recipe) => [recipe.id, recipe])),
    [recipes],
  )

  return {
    weekStart,
    dates,
    plan,
    meals: meals ?? [],
    mealsByDate,
    recipesById,
    leftovers: leftovers ?? [],
    loading: plan === undefined,
  }
}
