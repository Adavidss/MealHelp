import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Printer } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { getGroceryList } from '@/db/grocery'
import type { PlannedMeal, PrintOptions, Recipe } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import { buildAppUrl, describeShare, groceryPayload } from '@/services/shareCodec'
import { formatQuantity } from '@/services/unitConversion'
import { dayName, formatWeekRange, monthDay, startOfWeek, todayISO, weekDates } from '@/utils/date'
import { QRCode } from '@/components/common/QRCode'
import { mealTitle } from '@/features/planner/mealTitle'
import styles from './PrintPage.module.css'

/**
 * The refrigerator sheet.
 *
 * Everything on paper is static, so the interactive controls live above the
 * sheet and are removed by the print stylesheet. The QR codes are what bring a
 * phone back to the app: one per cooked recipe, one for the whole grocery list.
 */
export function PrintPage() {
  const { weekStart: weekParam } = useParams<{ weekStart: string }>()
  const { settings, update } = useSettings()

  const weekStart = weekParam ?? startOfWeek(todayISO(), settings.weekStartsOn)
  const dates = useMemo(() => weekDates(weekStart), [weekStart])

  const [options, setOptions] = useState<PrintOptions>(settings.printOptions)

  const plan = useLiveQuery(
    () => db.mealPlans.where('weekStart').equals(weekStart).first(),
    [weekStart],
  )
  const meals = useLiveQuery(
    async () => (plan ? db.plannedMeals.where('planId').equals(plan.id).toArray() : []),
    [plan?.id],
    [] as PlannedMeal[],
  )
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const grocery = useLiveQuery(() => getGroceryList(weekStart), [weekStart])

  const recipesById = useMemo(
    () => new Map((recipes ?? []).map((recipe) => [recipe.id, recipe])),
    [recipes],
  )

  const visibleMealTypes = useMemo(() => {
    const types: string[] = []
    if (options.includeBreakfast) types.push('breakfast')
    if (options.includeLunch) types.push('lunch')
    if (options.includeDinner) types.push('dinner')
    return types.length ? types : ['dinner']
  }, [options])

  const mealsByDate = useMemo(() => {
    const map = new Map<string, PlannedMeal[]>()
    for (const date of dates) map.set(date, [])
    for (const meal of meals ?? []) {
      if (!visibleMealTypes.includes(meal.mealType)) continue
      map.get(meal.date)?.push(meal)
    }
    return map
  }, [meals, dates, visibleMealTypes])

  const groceryShare = useMemo(() => {
    if (!grocery || !options.includeGroceryQr) return undefined
    const share = describeShare(groceryPayload(grocery.items, weekStart))
    return share.qrSafe ? share : undefined
  }, [grocery, options.includeGroceryQr, weekStart])

  const toggle = (key: keyof PrintOptions) => {
    const next = { ...options, [key]: !options[key] }
    setOptions(next)
    void update({ printOptions: next })
  }

  const remaining = grocery?.items.filter((item) => !item.checked && !item.haveIt) ?? []

  return (
    <div className={options.largeText ? styles.large : undefined}>
      <div className={`${styles.controls} no-print`}>
        <div className={styles.controlsRow}>
          <Link to={`/plan/${weekStart}`} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to plan
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm print-keep"
            onClick={() => window.print()}
          >
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
        </div>

        <div className="row-tight">
          <Toggle label="Meal QR codes" on={options.includeMealQr} onClick={() => toggle('includeMealQr')} />
          <Toggle label="Grocery QR" on={options.includeGroceryQr} onClick={() => toggle('includeGroceryQr')} />
          <Toggle label="Notes" on={options.includeNotes} onClick={() => toggle('includeNotes')} />
          <Toggle label="Breakfast" on={options.includeBreakfast} onClick={() => toggle('includeBreakfast')} />
          <Toggle label="Lunch" on={options.includeLunch} onClick={() => toggle('includeLunch')} />
          <Toggle label="Dinner" on={options.includeDinner} onClick={() => toggle('includeDinner')} />
          <Toggle label="Compact" on={options.compact} onClick={() => toggle('compact')} />
          <Toggle label="Large text" on={options.largeText} onClick={() => toggle('largeText')} />
        </div>
      </div>

      <article className={`${styles.sheet} ${options.compact ? styles.compact : ''}`}>
        <header className={styles.sheetHeader}>
          <h1 className={styles.brand}>MealHelp</h1>
          <p className={styles.week}>Week of {formatWeekRange(weekStart)}</p>
        </header>

        <div className={styles.days}>
          {dates.map((date) => {
            const dayMeals = mealsByDate.get(date) ?? []
            return (
              <section key={date} className={`${styles.day} print-block`}>
                <div className={styles.dayHead}>
                  <h2>{dayName(date)}</h2>
                  <span>{monthDay(date)}</span>
                </div>

                {dayMeals.length === 0 ? (
                  <p className={styles.blank}>—</p>
                ) : (
                  dayMeals.map((meal) => {
                    const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
                    // Straight into this app's recipe view: the sheet is on the
                    // fridge of the household whose phone already has it.
                    const recipeUrl =
                      options.includeMealQr && recipe && meal.kind === 'recipe'
                        ? buildAppUrl(`/recipes/${recipe.id}`)
                        : undefined
                    return (
                      <div key={meal.id} className={styles.meal}>
                        <div className={styles.mealText}>
                          {visibleMealTypes.length > 1 ? (
                            <p className={styles.mealType}>
                              {MEAL_TYPE_LABELS[meal.mealType]}
                            </p>
                          ) : null}
                          <p className={styles.mealTitle}>{mealTitle(meal, recipe)}</p>
                          {meal.servings && meal.kind === 'recipe' ? (
                            <p className={styles.mealMeta}>{meal.servings} servings</p>
                          ) : null}
                          {options.includeNotes && meal.notes ? (
                            <p className={styles.mealNote}>{meal.notes}</p>
                          ) : null}
                        </div>
                        {recipeUrl ? (
                          <QRCode
                            value={recipeUrl}
                            size={options.compact ? 46 : 62}
                            label={`Scan for ${recipe?.title ?? 'recipe'}`}
                          />
                        ) : null}
                      </div>
                    )
                  })
                )}
              </section>
            )
          })}
        </div>

        <section className={`${styles.grocery} print-block`}>
          <div>
            <h2 className={styles.groceryTitle}>Grocery list</h2>
            {remaining.length ? (
              <ul className={styles.groceryList}>
                {remaining.map((item) => (
                  <li key={item.id}>
                    ☐ {item.quantities.map(formatQuantity).filter(Boolean).join(' + ')}{' '}
                    {item.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.blank}>
                Nothing left to buy — or no list generated for this week yet.
              </p>
            )}
          </div>

          {groceryShare ? (
            <div className={styles.groceryQr}>
              <QRCode value={groceryShare.url} size={104} label="Scan to open the grocery list" />
              <p>Open this list on your phone</p>
            </div>
          ) : null}
        </section>
      </article>
    </div>
  )
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="chip chip-button" aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  )
}
