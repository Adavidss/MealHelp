import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CopyPlus } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { copyWeek } from '@/db/plans'
import type { PlannedMeal } from '@/models'
import { formatWeekRange, monthDay, startOfWeek, todayISO } from '@/utils/date'
import { EmptyState } from '@/components/common/EmptyState'
import { StarRating } from '@/components/common/StarRating'
import { useToast } from '@/components/common/Toast'
import styles from './HistoryPage.module.css'

/** What has actually been cooked, and which weeks are worth repeating. */
export function HistoryPage() {
  const { settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()

  const plans = useLiveQuery(() => db.mealPlans.toArray(), [], [])
  const allMeals = useLiveQuery(() => db.plannedMeals.toArray(), [], [] as PlannedMeal[])
  const cookEvents = useLiveQuery(() => db.cookEvents.toArray(), [], [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [])

  const thisWeek = startOfWeek(todayISO(), settings.weekStartsOn)

  const weeks = useMemo(() => {
    const byPlan = new Map<string, PlannedMeal[]>()
    for (const meal of allMeals ?? []) {
      const bucket = byPlan.get(meal.planId) ?? []
      bucket.push(meal)
      byPlan.set(meal.planId, bucket)
    }
    return (plans ?? [])
      .map((plan) => ({ plan, meals: byPlan.get(plan.id) ?? [] }))
      .filter((entry) => entry.meals.length > 0)
      .sort((a, b) => b.plan.weekStart.localeCompare(a.plan.weekStart))
  }, [plans, allMeals])

  const mostCooked = useMemo(
    () =>
      [...(recipes ?? [])]
        .filter((recipe) => (recipe.timesCooked ?? 0) > 0)
        .sort((a, b) => (b.timesCooked ?? 0) - (a.timesCooked ?? 0))
        .slice(0, 8),
    [recipes],
  )

  const recentCooks = useMemo(
    () => [...(cookEvents ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [cookEvents],
  )

  const repeat = async (weekStart: string) => {
    const copied = await copyWeek(weekStart, thisWeek)
    toast(
      copied ? `Copied ${copied} meals into this week.` : 'That week had nothing to copy.',
      { tone: copied ? 'success' : 'default' },
    )
    if (copied) navigate(`/plan/${thisWeek}`)
  }

  const hasHistory = weeks.length > 0 || recentCooks.length > 0

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">What you cooked, and what worked</p>
        </div>
      </header>

      {!hasHistory ? (
        <EmptyState
          title="Nothing here yet"
          description="Once you plan a week and cook from it, this is where it shows up."
        >
          <Link to="/plan-week" className="btn btn-primary">
            Plan my week
          </Link>
        </EmptyState>
      ) : null}

      {recentCooks.length ? (
        <section>
          <h2 className="section-title">Recently cooked</h2>
          <ul className={styles.list}>
            {recentCooks.map((event) => (
              <li key={event.id} className={styles.row}>
                <span className={styles.date}>{monthDay(event.date)}</span>
                <span className={styles.title}>
                  {event.recipeId ? (
                    <Link to={`/recipes/${event.recipeId}`}>{event.recipeTitle}</Link>
                  ) : (
                    event.recipeTitle
                  )}
                </span>
                <span className={styles.meta}>
                  {event.servingsMade} made
                  {event.remainingServings > 0
                    ? ` · ${event.remainingServings} left`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {weeks.length ? (
        <section>
          <h2 className="section-title">Previous weeks</h2>
          <ul className={styles.weeks}>
            {weeks.map(({ plan, meals }) => (
              <li key={plan.id} className={styles.week}>
                <div>
                  <Link to={`/plan/${plan.weekStart}`} className={styles.weekTitle}>
                    {formatWeekRange(plan.weekStart)}
                  </Link>
                  <p className={styles.weekMeta}>
                    {meals.filter((meal) => meal.kind === 'recipe').length} cooked ·{' '}
                    {meals.filter((meal) => meal.kind === 'leftover').length} leftover
                  </p>
                </div>
                {plan.weekStart !== thisWeek ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void repeat(plan.weekStart)}
                  >
                    <CopyPlus size={15} aria-hidden="true" />
                    Repeat
                  </button>
                ) : (
                  <span className="chip chip-accent">This week</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {mostCooked.length ? (
        <section>
          <h2 className="section-title">Made most often</h2>
          <ul className={styles.list}>
            {mostCooked.map((recipe) => (
              <li key={recipe.id} className={styles.row}>
                <span className={styles.title}>
                  <Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link>
                </span>
                <span className={styles.meta}>
                  {recipe.timesCooked}×{' '}
                  {recipe.rating ? <StarRating value={recipe.rating} size={13} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
