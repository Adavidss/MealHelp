import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Printer,
  ShoppingCart,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { copyWeek, movePlannedMeal } from '@/db/plans'
import { generateGroceryList } from '@/db/grocery'
import type { MealType, PlannedMeal } from '@/models'
import { addDays, formatWeekRange, startOfWeek, todayISO } from '@/utils/date'
import { EmptyState } from '@/components/common/EmptyState'
import { SegmentedTabs } from '@/components/common/SegmentedTabs'
import { useToast } from '@/components/common/Toast'
import { useSectionTab } from '@/app/useSectionTab'
import { HistoryView } from '@/features/history/HistoryPage'
import { NutritionView } from '@/features/nutrition/NutritionView'
import { AddMealDialog } from './AddMealDialog'
import { MealActionsDialog } from './MealActionsDialog'
import { WeekBoard } from './WeekBoard'
import { usePlannerWeek } from './usePlannerWeek'
import styles from './PlannerPage.module.css'

const PLAN_TABS = ['week', 'nutrition', 'history'] as const
type PlanTab = (typeof PLAN_TABS)[number]

export function PlannerPage() {
  const { weekStart: weekParam } = useParams<{ weekStart: string }>()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { toast } = useToast()

  const weekStart = weekParam ?? startOfWeek(todayISO(), settings.weekStartsOn)
  const week = usePlannerWeek(weekStart)
  const [tab, setTab] = useSectionTab<PlanTab>(PLAN_TABS, 'week')

  const [adding, setAdding] = useState<{ date: string; mealType: MealType } | null>(null)
  const [selected, setSelected] = useState<PlannedMeal | null>(null)

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

  if (week.loading) {
    return (
      <div className="page">
        <p className="muted">Loading your week…</p>
      </div>
    )
  }

  if (tab !== 'week') {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">{tab === 'history' ? 'History' : 'Nutrition'}</h1>
            <p className="page-subtitle">
              {tab === 'history'
                ? 'What you cooked, and what worked'
                : 'What the week adds up to, per day'}
            </p>
          </div>
          <SegmentedTabs
            tabs={[
              { id: 'week', label: 'Week' },
              { id: 'nutrition', label: 'Nutrition' },
              { id: 'history', label: 'History' },
            ]}
            value={tab}
            onChange={setTab}
            label="Plan views"
          />
        </header>
        {tab === 'history' ? <HistoryView /> : <NutritionView />}
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

      <div className={styles.tabRow}>
        <SegmentedTabs
          tabs={[
            { id: 'week', label: 'Week' },
            { id: 'nutrition', label: 'Nutrition' },
            { id: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
          label="Plan views"
        />
      </div>

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

      <WeekBoard
        dates={week.dates}
        mealsByDate={week.mealsByDate}
        recipesById={week.recipesById}
        mealTypes={mealTypes}
        today={today}
        onAdd={(date, mealType) => setAdding({ date, mealType })}
        onOpenMeal={setSelected}
        onMove={(mealId, date, mealType) => void movePlannedMeal(mealId, date, mealType)}
      />

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
