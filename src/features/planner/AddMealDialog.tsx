import { useState } from 'react'
import { ChefHat, Refrigerator, Store, Utensils } from 'lucide-react'
import { addPlannedMeal } from '@/db/plans'
import { consumeLeftovers } from '@/db/cookEvents'
import type { CookEvent, MealType, Recipe } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { dayName, monthDay } from '@/utils/date'
import { RecipePicker } from './RecipePicker'
import styles from './AddMealDialog.module.css'

interface AddMealDialogProps {
  open: boolean
  planId: string
  date: string
  mealType: MealType
  leftovers: CookEvent[]
  usedRecipeIds: string[]
  defaultServings: number
  onClose: () => void
}

type Mode = 'choose' | 'recipe' | 'leftovers' | 'custom'

export function AddMealDialog({
  open,
  planId,
  date,
  mealType,
  leftovers,
  usedRecipeIds,
  defaultServings,
  onClose,
}: AddMealDialogProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('choose')
  const [customName, setCustomName] = useState('')

  const close = () => {
    setMode('choose')
    setCustomName('')
    onClose()
  }

  const addRecipe = async (recipe: Recipe) => {
    await addPlannedMeal({
      planId,
      date,
      mealType,
      kind: 'recipe',
      recipeId: recipe.id,
      servings: recipe.servings ?? defaultServings,
    })
    toast(`Added ${recipe.title} to ${dayName(date)}.`, { tone: 'success' })
    close()
  }

  const addLeftover = async (event: CookEvent) => {
    await addPlannedMeal({
      planId,
      date,
      mealType,
      kind: 'leftover',
      recipeId: event.recipeId,
      sourceCookEventId: event.id,
      servings: Math.min(defaultServings, event.remainingServings),
    })
    // Claiming a portion now keeps two nights from planning the same leftovers.
    await consumeLeftovers(event.id, Math.min(defaultServings, event.remainingServings))
    toast(`${event.recipeTitle} leftovers on ${dayName(date)}.`, { tone: 'success' })
    close()
  }

  const addCustom = async (kind: 'custom' | 'eating-out' | 'skip') => {
    await addPlannedMeal({
      planId,
      date,
      mealType,
      kind,
      customName:
        customName.trim() ||
        (kind === 'eating-out' ? 'Eating out' : kind === 'skip' ? 'Nothing planned' : 'Meal'),
    })
    close()
  }

  return (
    <Modal
      open={open}
      title={`${MEAL_TYPE_LABELS[mealType]} · ${dayName(date)} ${monthDay(date)}`}
      onClose={close}
    >
      {mode === 'choose' ? (
        <div className={styles.options}>
          <button
            type="button"
            className={styles.option}
            onClick={() => setMode('recipe')}
          >
            <ChefHat size={20} aria-hidden="true" />
            <span>
              <strong>Cook a recipe</strong>
              <small>Pick from your library</small>
            </span>
          </button>

          <button
            type="button"
            className={styles.option}
            onClick={() => setMode('leftovers')}
            disabled={leftovers.length === 0}
          >
            <Refrigerator size={20} aria-hidden="true" />
            <span>
              <strong>Eat leftovers</strong>
              <small>
                {leftovers.length
                  ? `${leftovers.length} thing${leftovers.length === 1 ? '' : 's'} in the fridge`
                  : 'Nothing logged as leftovers yet'}
              </small>
            </span>
          </button>

          <button
            type="button"
            className={styles.option}
            onClick={() => setMode('custom')}
          >
            <Utensils size={20} aria-hidden="true" />
            <span>
              <strong>Something else</strong>
              <small>A meal with no recipe</small>
            </span>
          </button>

          <button
            type="button"
            className={styles.option}
            onClick={() => void addCustom('eating-out')}
          >
            <Store size={20} aria-hidden="true" />
            <span>
              <strong>Eating out</strong>
              <small>Nothing to shop for</small>
            </span>
          </button>
        </div>
      ) : null}

      {mode === 'recipe' ? (
        <RecipePicker
          mealType={mealType}
          excludeIds={usedRecipeIds}
          onSelect={(recipe) => void addRecipe(recipe)}
        />
      ) : null}

      {mode === 'leftovers' ? (
        <ul className={styles.leftovers}>
          {leftovers.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className={styles.leftover}
                onClick={() => void addLeftover(event)}
              >
                <strong>{event.recipeTitle}</strong>
                <small>
                  {event.remainingServings} serving
                  {event.remainingServings === 1 ? '' : 's'} left · cooked{' '}
                  {monthDay(event.date)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mode === 'custom' ? (
        <div>
          <div className="field">
            <label className="field-label" htmlFor="custom-meal">
              What are you eating?
            </label>
            <input
              id="custom-meal"
              className="input"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Sandwiches, breakfast for dinner…"
              autoFocus
            />
          </div>
          <div className="row-tight">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void addCustom('custom')}
            >
              Add meal
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void addCustom('skip')}
            >
              Nothing planned
            </button>
          </div>
        </div>
      ) : null}

      {mode !== 'choose' ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setMode('choose')}
          style={{ marginTop: 'var(--space-3)' }}
        >
          Back
        </button>
      ) : null}
    </Modal>
  )
}
