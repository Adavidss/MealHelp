import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  ChefHat,
  Compass,
  Plus,
  Refrigerator,
  ShoppingCart,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { getGroceryList } from '@/db/grocery'
import type { CookEvent, PlannedMeal, Recipe } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import {
  addDays,
  formatMinutes,
  monthDay,
  relativeDayLabel,
  startOfWeek,
  todayISO,
  weekDates,
} from '@/utils/date'
import { activeMinutes } from '@/services/recipeMetrics'
import { EmptyState } from '@/components/common/EmptyState'
import { mealTitle } from '@/features/planner/mealTitle'
import { StarterRecipesButton } from '@/features/recipes/StarterRecipesButton'
import styles from './TodayPage.module.css'

export function TodayPage() {
  const { settings } = useSettings()
  const today = todayISO()
  const weekStart = startOfWeek(today, settings.weekStartsOn)
  const dates = useMemo(() => weekDates(weekStart), [weekStart])

  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const meals = useLiveQuery(
    // The next fortnight covers "today" and "coming up" even when the week rolls over.
    () => db.plannedMeals.where('date').between(today, addDays(today, 14), true, true).toArray(),
    [today],
    [] as PlannedMeal[],
  )
  const weekMeals = useLiveQuery(
    () => db.plannedMeals.where('date').anyOf(dates).toArray(),
    [dates.join(',')],
    [] as PlannedMeal[],
  )
  const leftovers = useLiveQuery(
    async () => {
      const events = await db.cookEvents.toArray()
      return events.filter((event) => event.remainingServings > 0)
    },
    [],
    [] as CookEvent[],
  )
  const grocery = useLiveQuery(() => getGroceryList(weekStart), [weekStart])

  const recipesById = useMemo(
    () => new Map((recipes ?? []).map((recipe) => [recipe.id, recipe])),
    [recipes],
  )

  const todayMeals = (meals ?? []).filter((meal) => meal.date === today)
  const upcoming = (meals ?? [])
    .filter((meal) => meal.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  // A note like "defrost the chicken" matters the day before, not on the day.
  const reminders = (meals ?? []).filter(
    (meal) => meal.notes && meal.date > today && meal.date <= addDays(today, 2),
  )

  const weekSummary = useMemo(() => {
    const cooking = (weekMeals ?? []).filter((meal) => meal.kind === 'recipe').length
    const leftoverNights = (weekMeals ?? []).filter((meal) => meal.kind === 'leftover').length
    return { planned: weekMeals?.length ?? 0, cooking, leftoverNights }
  }, [weekMeals])

  const remainingGrocery =
    grocery?.items.filter((item) => !item.checked && !item.haveIt).length ?? 0

  const libraryEmpty = recipes?.length === 0

  return (
    <div className="page">
      <header className={styles.hero}>
        <p className={styles.date}>{monthDay(today)}</p>
        <h1 className="page-title">
          {todayMeals.length ? 'Tonight' : 'Nothing planned today'}
        </h1>
      </header>

      {libraryEmpty ? (
        <EmptyState
          title="Welcome to MealHelp"
          description="Start with a few recipes, then let MealHelp turn them into a week and a shopping list."
        >
          <StarterRecipesButton />
          <Link to="/import" className="btn btn-secondary">
            Import a recipe
          </Link>
        </EmptyState>
      ) : null}

      {todayMeals.length ? (
        <section className={styles.todaySection}>
          {todayMeals.map((meal) => {
            const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
            return (
              <article key={meal.id} className={styles.todayCard}>
                <p className={styles.mealType}>{MEAL_TYPE_LABELS[meal.mealType]}</p>
                <h2 className={styles.todayTitle}>{mealTitle(meal, recipe)}</h2>
                <p className={styles.todayMeta}>
                  {meal.servings ? `${meal.servings} servings` : null}
                  {recipe
                    ? ` · ${formatMinutes(Math.round(activeMinutes(recipe)))} prep`
                    : null}
                  {recipe?.cookTimeMinutes
                    ? ` · cook ${formatMinutes(recipe.cookTimeMinutes)}`
                    : null}
                </p>
                {meal.notes ? <p className={styles.note}>{meal.notes}</p> : null}
                {recipe ? (
                  <div className={styles.todayActions}>
                    <Link
                      to={`/recipes/${recipe.id}/cook?servings=${meal.servings ?? recipe.servings ?? 4}&plannedMeal=${meal.id}`}
                      className="btn btn-primary"
                    >
                      <ChefHat size={17} aria-hidden="true" />
                      {meal.kind === 'leftover' ? 'Open recipe' : 'Start cooking'}
                    </Link>
                    <Link to={`/recipes/${recipe.id}`} className="btn btn-secondary">
                      View recipe
                    </Link>
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>
      ) : !libraryEmpty ? (
        <section className={styles.todaySection}>
          <article className={styles.todayCard}>
            <h2 className={styles.todayTitle}>What are you eating?</h2>
            <p className={styles.todayMeta}>
              Nothing is on the plan for today.
            </p>
            <div className={styles.todayActions}>
              <Link to="/plan-week?quick=1" className="btn btn-primary">
                <Zap size={17} aria-hidden="true" />
                Plan it for me
              </Link>
              <Link to="/plan-week" className="btn btn-secondary">
                <Sparkles size={17} aria-hidden="true" />
                Customise
              </Link>
              <Link to={`/plan/${weekStart}`} className="btn btn-ghost">
                Open planner
              </Link>
            </div>
          </article>
        </section>
      ) : null}

      {reminders.length ? (
        <section>
          <h2 className="section-title">Before then</h2>
          <ul className={styles.reminders}>
            {reminders.map((meal) => (
              <li key={meal.id}>
                <strong>{relativeDayLabel(meal.date, today)}:</strong> {meal.notes}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {leftovers?.length ? (
        <section>
          <h2 className="section-title">In the fridge</h2>
          <ul className={styles.leftovers}>
            {leftovers.map((event) => (
              <li key={event.id} className={styles.leftover}>
                <Refrigerator size={16} aria-hidden="true" />
                <span>
                  <strong>{event.recipeTitle}</strong>
                  <small>
                    {' '}
                    · {event.remainingServings} serving
                    {event.remainingServings === 1 ? '' : 's'}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length ? (
        <section>
          <h2 className="section-title">Coming up</h2>
          <ul className={styles.upcoming}>
            {upcoming.map((meal) => {
              const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
              return (
                <li key={meal.id} className={styles.upcomingRow}>
                  <span className={styles.upcomingDay}>
                    {relativeDayLabel(meal.date, today)}
                  </span>
                  <span className={styles.upcomingTitle}>{mealTitle(meal, recipe)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {weekSummary.planned > 0 ? (
        <section>
          <h2 className="section-title">This week</h2>
          <div className={styles.summary}>
            <div>
              <strong>{weekSummary.planned}</strong>
              <small>meals planned</small>
            </div>
            <div>
              <strong>{weekSummary.cooking}</strong>
              <small>cooking nights</small>
            </div>
            <div>
              <strong>{weekSummary.leftoverNights}</strong>
              <small>leftover nights</small>
            </div>
            <div>
              <strong>{remainingGrocery}</strong>
              <small>items to buy</small>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="section-title">Quick actions</h2>
        <div className={styles.actions}>
          <Link to="/plan-week?quick=1" className={styles.action}>
            <Zap size={19} aria-hidden="true" />
            Plan it for me
          </Link>
          <Link to="/plan-week" className={styles.action}>
            <Sparkles size={19} aria-hidden="true" />
            Plan my week
          </Link>
          <Link to="/grocery" className={styles.action}>
            <ShoppingCart size={19} aria-hidden="true" />
            Grocery list
          </Link>
          <Link to="/recipes/new" className={styles.action}>
            <Plus size={19} aria-hidden="true" />
            Add recipe
          </Link>
          <Link to="/discover" className={styles.action}>
            <Compass size={19} aria-hidden="true" />
            Discover recipes
          </Link>
          <Link to="/recipes" className={styles.action}>
            <BookOpen size={19} aria-hidden="true" />
            Browse recipes
          </Link>
          <Link to="/recipes/what-can-i-make" className={styles.action}>
            <Refrigerator size={19} aria-hidden="true" />
            What can I make?
          </Link>
        </div>
      </section>
    </div>
  )
}
