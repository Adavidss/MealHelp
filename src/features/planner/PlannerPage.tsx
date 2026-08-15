import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Plus,
  Printer,
  ShoppingCart,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { copyWeek, movePlannedMeal } from '@/db/plans'
import { generateGroceryList } from '@/db/grocery'
import type { MealType, PlannedMeal } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import {
  addDays,
  dayName,
  dayNameShort,
  formatWeekRange,
  monthDay,
  startOfWeek,
  todayISO,
} from '@/utils/date'
import { EmptyState } from '@/components/common/EmptyState'
import { useToast } from '@/components/common/Toast'
import { AddMealDialog } from './AddMealDialog'
import { MealActionsDialog } from './MealActionsDialog'
import { MealSlot } from './MealSlot'
import { usePlannerWeek } from './usePlannerWeek'
import styles from './PlannerPage.module.css'

export function PlannerPage() {
  const { weekStart: weekParam } = useParams<{ weekStart: string }>()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { toast } = useToast()

  const weekStart = weekParam ?? startOfWeek(todayISO(), settings.weekStartsOn)
  const week = usePlannerWeek(weekStart)

  const [adding, setAdding] = useState<{ date: string; mealType: MealType } | null>(null)
  const [selected, setSelected] = useState<PlannedMeal | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const mealTypes = settings.visibleMealTypes.length
    ? settings.visibleMealTypes
    : (['dinner'] as MealType[])

  const usedRecipeIds = useMemo(
    () =>
      week.meals
        .filter((meal) => meal.kind === 'recipe' && meal.recipeId)
        .map((meal) => meal.recipeId as string),
    [week.meals],
  )

  const weekRecipes = useMemo(
    () =>
      usedRecipeIds
        .map((id) => week.recipesById.get(id))
        .filter((recipe): recipe is NonNullable<typeof recipe> => Boolean(recipe)),
    [usedRecipeIds, week.recipesById],
  )

  const summary = useMemo(() => {
    const cooking = week.meals.filter((meal) => meal.kind === 'recipe').length
    const leftovers = week.meals.filter((meal) => meal.kind === 'leftover').length
    const out = week.meals.filter((meal) => meal.kind === 'eating-out').length
    return { planned: week.meals.length, cooking, leftovers, out }
  }, [week.meals])

  const today = todayISO()

  const makeGroceryList = async () => {
    await generateGroceryList(weekStart, week.meals, { planId: week.plan?.id })
    toast('Grocery list ready.', {
      tone: 'success',
      action: { label: 'Open', run: () => navigate('/grocery') },
    })
  }

  const copyLastWeek = async () => {
    const previous = addDays(weekStart, -7)
    const copied = await copyWeek(previous, weekStart)
    toast(
      copied
        ? `Copied ${copied} meal${copied === 1 ? '' : 's'} from last week.`
        : 'There was nothing planned last week to copy.',
      { tone: copied ? 'success' : 'default' },
    )
  }

  const handleDrop = async (date: string, mealType: MealType) => {
    if (!dragging) return
    await movePlannedMeal(dragging, date, mealType)
    setDragging(null)
  }

  if (week.loading) {
    return (
      <div className="page">
        <p className="muted">Loading your week…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{formatWeekRange(weekStart)}</h1>
          <p className="page-subtitle">
            {summary.planned === 0
              ? 'Nothing planned yet'
              : `${summary.cooking} cooking · ${summary.leftovers} leftover${
                  summary.leftovers === 1 ? '' : 's'
                }${summary.out ? ` · ${summary.out} out` : ''}`}
          </p>
        </div>
        <div className={styles.weekNav}>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => navigate(`/plan/${addDays(weekStart, -7)}`)}
            aria-label="Previous week"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/plan/${startOfWeek(today, settings.weekStartsOn)}`)}
          >
            This week
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => navigate(`/plan/${addDays(weekStart, 7)}`)}
            aria-label="Next week"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={styles.actionBar}>
        <Link to={`/plan-week?week=${weekStart}&quick=1`} className="btn btn-primary">
          <Zap size={17} aria-hidden="true" />
          Plan it for me
        </Link>
        <Link to={`/plan-week?week=${weekStart}`} className="btn btn-secondary">
          <Sparkles size={17} aria-hidden="true" />
          Customise
        </Link>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void makeGroceryList()}
          disabled={summary.cooking === 0}
        >
          <ShoppingCart size={17} aria-hidden="true" />
          Grocery list
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void copyLastWeek()}>
          <CopyPlus size={17} aria-hidden="true" />
          Copy last week
        </button>
        <Link to={`/print/${weekStart}`} className="btn btn-secondary">
          <Printer size={17} aria-hidden="true" />
          Print
        </Link>
      </div>

      {summary.planned === 0 ? (
        <EmptyState
          title="Let's figure out what you're eating this week."
          description="One tap and MealHelp suggests a week that fits how much you actually want to cook. Change anything you like before you accept it — or fill the days in yourself."
        >
          <Link to={`/plan-week?week=${weekStart}&quick=1`} className="btn btn-primary">
            <Zap size={17} aria-hidden="true" />
            Plan it for me
          </Link>
          <Link to={`/plan-week?week=${weekStart}`} className="btn btn-secondary">
            Customise first
          </Link>
        </EmptyState>
      ) : null}

      <div className={styles.week}>
        {week.dates.map((date) => {
          const meals = week.mealsByDate.get(date) ?? []
          const isToday = date === today
          return (
            <section
              key={date}
              className={`${styles.day} ${isToday ? styles.today : ''} print-block`}
              onDragOver={(event) => {
                if (dragging) event.preventDefault()
              }}
              onDrop={() => void handleDrop(date, mealTypes[0])}
            >
              <header className={styles.dayHeader}>
                <h2 className={styles.dayName}>
                  <span className={styles.dayLong}>{dayName(date)}</span>
                  <span className={styles.dayShort}>{dayNameShort(date)}</span>
                </h2>
                <span className={styles.dayDate}>{monthDay(date)}</span>
              </header>

              <div className={styles.dayBody}>
                {mealTypes.map((mealType) => {
                  const forType = meals.filter((meal) => meal.mealType === mealType)
                  return (
                    <div key={mealType} className={styles.mealGroup}>
                      {mealTypes.length > 1 ? (
                        <p className={styles.mealTypeLabel}>
                          {MEAL_TYPE_LABELS[mealType]}
                        </p>
                      ) : null}

                      {forType.map((meal) => (
                        <div
                          key={meal.id}
                          draggable
                          onDragStart={() => setDragging(meal.id)}
                          onDragEnd={() => setDragging(null)}
                        >
                          <MealSlot
                            meal={meal}
                            recipe={
                              meal.recipeId
                                ? week.recipesById.get(meal.recipeId)
                                : undefined
                            }
                            onOpenMenu={setSelected}
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        className={styles.addButton}
                        onClick={() => setAdding({ date, mealType })}
                      >
                        <Plus size={15} aria-hidden="true" />
                        <span className="sr-only">
                          Add {MEAL_TYPE_LABELS[mealType].toLowerCase()} for{' '}
                          {dayName(date)}
                        </span>
                        <span aria-hidden="true">Add</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {adding ? (
        <AddMealDialog
          open
          weekStart={weekStart}
          date={adding.date}
          mealType={adding.mealType}
          leftovers={week.leftovers}
          usedRecipeIds={usedRecipeIds}
          weekRecipes={weekRecipes}
          defaultServings={settings.defaultServings}
          onClose={() => setAdding(null)}
        />
      ) : null}

      <MealActionsDialog
        open={Boolean(selected)}
        meal={selected}
        recipe={selected?.recipeId ? week.recipesById.get(selected.recipeId) : undefined}
        dates={week.dates}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
