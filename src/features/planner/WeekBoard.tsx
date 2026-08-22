import { useMemo, useState } from 'react'
import { Plus, RotateCw, Store, Utensils } from 'lucide-react'
import type { MealType, PlannedMeal, Recipe } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import { MealCard } from '@/components/meal/MealCard'
import { dayName, dayNameShort, monthDay } from '@/utils/date'
import { leftoverGraph } from './leftoverLinks'
import { mealTitle } from './mealTitle'
import styles from './WeekBoard.module.css'

interface WeekBoardProps {
  dates: string[]
  mealsByDate: Map<string, PlannedMeal[]>
  recipesById: Map<string, Recipe>
  mealTypes: MealType[]
  today: string
  onAdd: (date: string, mealType: MealType) => void
  onOpenMeal: (meal: PlannedMeal) => void
  onMove: (mealId: string, date: string, mealType: MealType) => void
}

/**
 * The week as seven pictures.
 *
 * A seven-column grid of text rows is a spreadsheet, and nobody looks forward
 * to a spreadsheet. Each day here is a card whose face is the food, so the
 * week can be read at a glance and a gap looks like a gap.
 *
 * Two relationships are drawn rather than described. A leftover night carries
 * the same photograph as the night that cooked it and is marked "↻ From
 * Monday"; the cooking night is marked with the nights it feeds. That is the
 * whole leftovers system, visible without a word of explanation.
 *
 * Meal types stay out of the way: with one type — dinner, for nearly everyone
 * — a day is one card. Turn breakfast and lunch on and the day splits into
 * labelled rows only then.
 */
export function WeekBoard({
  dates,
  mealsByDate,
  recipesById,
  mealTypes,
  today,
  onAdd,
  onOpenMeal,
  onMove,
}: WeekBoardProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const allMeals = useMemo(
    () => dates.flatMap((date) => mealsByDate.get(date) ?? []),
    [dates, mealsByDate],
  )
  const graph = useMemo(() => leftoverGraph(allMeals), [allMeals])

  return (
    <ol className={styles.week}>
      {dates.map((date) => {
        const meals = mealsByDate.get(date) ?? []
        const isToday = date === today
        const isPast = date < today

        return (
          <li
            key={date}
            className={[
              styles.day,
              isToday ? styles.isToday : '',
              isPast ? styles.isPast : '',
              dragOver === date ? styles.dropTarget : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(event) => {
              if (!dragging) return
              event.preventDefault()
              setDragOver(date)
            }}
            onDragLeave={() => setDragOver((current) => (current === date ? null : current))}
            onDrop={() => {
              if (dragging) onMove(dragging, date, mealTypes[0])
              setDragging(null)
              setDragOver(null)
            }}
          >
            <div className={styles.dayHead}>
              <h3 className={styles.dayName}>
                <span className={styles.dayLong}>{dayName(date)}</span>
                <span className={styles.dayShort}>{dayNameShort(date)}</span>
              </h3>
              <span className={styles.dayDate}>{monthDay(date)}</span>
            </div>

            {mealTypes.map((mealType) => {
              const forType = meals.filter((meal) => meal.mealType === mealType)
              return (
                <div key={mealType} className={styles.group}>
                  {mealTypes.length > 1 ? (
                    <p className={styles.groupLabel}>{MEAL_TYPE_LABELS[mealType]}</p>
                  ) : null}

                  {forType.map((meal) => {
                    const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
                    const from = graph.sourceOf.get(meal.id)
                    const feeds = graph.feeds.get(meal.id)

                    if (!recipe) {
                      return (
                        <article
                          key={meal.id}
                          className={styles.plain}
                          onClick={() => onOpenMeal(meal)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') onOpenMeal(meal)
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {meal.kind === 'eating-out' ? (
                            <Store size={16} aria-hidden="true" />
                          ) : (
                            <Utensils size={16} aria-hidden="true" />
                          )}
                          <span>{mealTitle(meal, undefined)}</span>
                        </article>
                      )
                    }

                    return (
                      <div
                        key={meal.id}
                        draggable
                        onDragStart={() => setDragging(meal.id)}
                        onDragEnd={() => {
                          setDragging(null)
                          setDragOver(null)
                        }}
                        className={styles.draggable}
                      >
                        <MealCard
                          recipe={recipe}
                          size="slot"
                          onSelect={() => onOpenMeal(meal)}
                          className={meal.kind === 'leftover' ? styles.leftoverCard : undefined}
                          eyebrow={
                            from ? (
                              <span className={styles.fromLink}>
                                <RotateCw size={11} aria-hidden="true" />
                                From {dayNameShort(from.sourceDate)}
                              </span>
                            ) : undefined
                          }
                        >
                          <p className={styles.slotMeta}>
                            {meal.kind === 'leftover'
                              ? 'Leftovers'
                              : meal.servings
                                ? `Cook ${meal.servings}`
                                : null}
                          </p>
                          {feeds?.length ? (
                            <p className={styles.feedsLine}>
                              <RotateCw size={11} aria-hidden="true" />
                              Feeds {feeds.map((fed) => dayNameShort(fed)).join(', ')}
                            </p>
                          ) : null}
                        </MealCard>
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    className={`${styles.add} ${forType.length ? '' : styles.addEmpty}`}
                    onClick={() => onAdd(date, mealType)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span className="sr-only">
                      Add {MEAL_TYPE_LABELS[mealType].toLowerCase()} for {dayName(date)}
                    </span>
                    <span aria-hidden="true">{forType.length ? 'Add another' : 'Add a meal'}</span>
                  </button>
                </div>
              )
            })}
          </li>
        )
      })}
    </ol>
  )
}
