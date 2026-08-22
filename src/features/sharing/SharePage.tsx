import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { saveRecipe } from '@/db/recipes'
import { addManualGroceryItem } from '@/db/grocery'
import { useSettings } from '@/app/SettingsContext'
import {
  decodeShare,
  readGroceryPayload,
  readPlanPayload,
  readRecipePayload,
} from '@/services/shareCodec'
import { toRecipeDraft } from '@/services/recipeImport'
import { formatWeekRange, dayName, startOfWeek, todayISO } from '@/utils/date'
import { useToast } from '@/components/common/Toast'
import styles from './SharePage.module.css'

/**
 * Opens a shared link. The payload arrives in the URL fragment, which browsers
 * never send to a server, so a shared grocery list is decoded entirely on the
 * device that scanned it.
 */
export function SharePage() {
  const { type, payload } = useParams<{ type: string; payload: string }>()
  const { settings } = useSettings()
  const { toast } = useToast()
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const decoded = useMemo(() => {
    if (!payload) return { error: 'This link is missing its contents.' as const }
    try {
      return { data: decodeShare(payload) }
    } catch {
      return {
        error:
          'This link could not be read. It may have been shortened or cut off — try scanning the code again.' as const,
      }
    }
  }, [payload])

  if ('error' in decoded && decoded.error) {
    return (
      <div className="page">
        <h1 className="page-title">Shared link</h1>
        <p className={styles.error}>{decoded.error}</p>
        <Link to="/plan" className="btn btn-secondary">
          Open MealHelp
        </Link>
      </div>
    )
  }

  const shared = decoded.data
  if (!shared) return null

  if (shared.type === 'grocery' && type === 'grocery') {
    const { items, weekStart } = readGroceryPayload(shared)
    const grouped = new Map<string, typeof items>()
    for (const item of items) {
      const bucket = grouped.get(item.category) ?? []
      bucket.push(item)
      grouped.set(item.category, bucket)
    }

    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Grocery list</h1>
            <p className="page-subtitle">
              {weekStart ? formatWeekRange(weekStart) : 'Shared with you'} ·{' '}
              {items.length} items
            </p>
          </div>
        </header>

        <p className="text-sm muted">
          Ticking things off here is just for this shopping trip — it does not
          change the list on the other device.
        </p>

        {[...grouped.entries()].map(([category, categoryItems]) => (
          <section key={category}>
            <h2 className={styles.category}>{category}</h2>
            <ul className={styles.list}>
              {categoryItems.map((item) => {
                const index = items.indexOf(item)
                const isChecked = checked.has(index) || item.checked
                return (
                  <li key={`${item.name}-${index}`}>
                    <label className={styles.row}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setChecked((current) => {
                            const next = new Set(current)
                            if (next.has(index)) next.delete(index)
                            else next.add(index)
                            return next
                          })
                        }
                        className={styles.checkbox}
                      />
                      <span className={isChecked ? styles.struck : undefined}>
                        <strong>{item.quantity}</strong> {item.name}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ marginTop: 'var(--space-5)' }}
          onClick={() => {
            const weekToUse = startOfWeek(todayISO(), settings.weekStartsOn)
            void Promise.all(
              items.map((item) =>
                addManualGroceryItem(
                  weekToUse,
                  `${item.quantity} ${item.name}`.trim(),
                ),
              ),
            ).then(() => toast('Added to your own grocery list.', { tone: 'success' }))
          }}
        >
          <Check size={17} aria-hidden="true" />
          Copy into my grocery list
        </button>
      </div>
    )
  }

  if (shared.type === 'recipe' && type === 'recipe') {
    const recipe = readRecipePayload(shared)
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">{recipe.title}</h1>
            <p className="page-subtitle">
              {recipe.servings ? `${recipe.servings} servings` : 'Shared with you'}
            </p>
          </div>
        </header>

        <section>
          <h2 className="section-title">Ingredients</h2>
          <ul className={styles.plainList}>
            {recipe.ingredients.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="section-title">Directions</h2>
          <ol className={styles.steps}>
            {recipe.instructions.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
        </section>

        {recipe.notes ? (
          <section>
            <h2 className="section-title">Notes</h2>
            <p>{recipe.notes}</p>
          </section>
        ) : null}

        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 'var(--space-5)' }}
          onClick={() => {
            void saveRecipe(
              toRecipeDraft({
                title: recipe.title,
                servings: recipe.servings,
                prepTimeMinutes: recipe.prepTimeMinutes,
                cookTimeMinutes: recipe.cookTimeMinutes,
                sourceUrl: recipe.sourceUrl,
                ingredientLines: recipe.ingredients,
                instructionTexts: recipe.instructions,
                notes: recipe.notes,
              }),
            ).then(() => toast('Saved to your library.', { tone: 'success' }))
          }}
        >
          Save to my recipes
        </button>
      </div>
    )
  }

  if (shared.type === 'meal-plan' && type === 'meal-plan') {
    const { weekStart, meals } = readPlanPayload(shared)
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Meal plan</h1>
            <p className="page-subtitle">{formatWeekRange(weekStart)}</p>
          </div>
        </header>
        <ul className={styles.planList}>
          {meals.map((meal, index) => (
            <li key={`${meal.date}-${index}`} className={styles.planRow}>
              <span className={styles.planDay}>{dayName(meal.date)}</span>
              <span>
                {meal.title}
                {meal.kind === 'leftover' ? ' — leftovers' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Shared link</h1>
      <p className={styles.error}>
        This link is for something MealHelp doesn't recognise.
      </p>
      <Link to="/plan" className="btn btn-secondary">
        Open MealHelp
      </Link>
    </div>
  )
}
