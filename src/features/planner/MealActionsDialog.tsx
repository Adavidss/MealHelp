import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, Copy, Lock, LockOpen, Replace, Trash2 } from 'lucide-react'
import {
  deletePlannedMeal,
  duplicatePlannedMeal,
  movePlannedMeal,
  updatePlannedMeal,
} from '@/db/plans'
import type { PlannedMeal, Recipe } from '@/models'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { dayName } from '@/utils/date'
import { RecipePicker } from './RecipePicker'
import { mealTitle } from './mealTitle'
import styles from './MealActionsDialog.module.css'

interface MealActionsDialogProps {
  open: boolean
  meal: PlannedMeal | null
  recipe?: Recipe
  dates: string[]
  onClose: () => void
}

export function MealActionsDialog({
  open,
  meal,
  recipe,
  dates,
  onClose,
}: MealActionsDialogProps) {
  const { toast } = useToast()
  const [replacing, setReplacing] = useState(false)

  if (!meal) return null

  const close = () => {
    setReplacing(false)
    onClose()
  }

  const replace = async (next: Recipe) => {
    await updatePlannedMeal(meal.id, {
      kind: 'recipe',
      recipeId: next.id,
      customName: undefined,
      servings: next.servings ?? meal.servings,
      // The old explanation described a different recipe.
      reasons: undefined,
    })
    toast(`Swapped in ${next.title}.`, { tone: 'success' })
    close()
  }

  const remove = async () => {
    await deletePlannedMeal(meal.id)
    toast('Removed from the plan.')
    close()
  }

  return (
    <Modal open={open} title={mealTitle(meal, recipe)} onClose={close}>
      {replacing ? (
        <>
          <RecipePicker mealType={meal.mealType} onSelect={(next) => void replace(next)} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setReplacing(false)}
            style={{ marginTop: 'var(--space-3)' }}
          >
            Back
          </button>
        </>
      ) : (
        <>
          {meal.kind === 'recipe' && recipe ? (
            <div className={styles.primary}>
              <Link
                to={`/recipes/${recipe.id}/cook?servings=${meal.servings ?? recipe.servings ?? 4}&plannedMeal=${meal.id}`}
                className="btn btn-primary btn-block"
                onClick={close}
              >
                <ChefHat size={17} aria-hidden="true" />
                Start cooking
              </Link>
            </div>
          ) : null}

          {meal.reasons?.length ? (
            <div className={styles.reasons}>
              <p className={styles.reasonsTitle}>Why this was suggested</p>
              <ul>
                {meal.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {meal.kind === 'recipe' ? (
            <div className="field">
              <label className="field-label" htmlFor="servings">
                Servings to cook
              </label>
              <input
                id="servings"
                type="number"
                className="input"
                inputMode="numeric"
                min="1"
                value={meal.servings ?? ''}
                onChange={(event) =>
                  void updatePlannedMeal(meal.id, {
                    servings: Number(event.target.value) || undefined,
                  })
                }
              />
              <span className="field-hint">
                The grocery list scales to whatever you plan to cook.
              </span>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="move-to">
              Move to
            </label>
            <select
              id="move-to"
              className="select"
              value={meal.date}
              onChange={(event) => void movePlannedMeal(meal.id, event.target.value)}
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {dayName(date)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="meal-notes">
              Notes
            </label>
            <input
              id="meal-notes"
              className="input"
              defaultValue={meal.notes ?? ''}
              placeholder="Defrost the chicken the night before"
              onBlur={(event) =>
                void updatePlannedMeal(meal.id, {
                  notes: event.target.value.trim() || undefined,
                })
              }
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setReplacing(true)}
            >
              <Replace size={16} aria-hidden="true" />
              Replace
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void duplicatePlannedMeal(meal.id)}
            >
              <Copy size={16} aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void updatePlannedMeal(meal.id, { locked: !meal.locked })}
            >
              {meal.locked ? (
                <LockOpen size={16} aria-hidden="true" />
              ) : (
                <Lock size={16} aria-hidden="true" />
              )}
              {meal.locked ? 'Unlock' : 'Lock'}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void remove()}>
              <Trash2 size={16} aria-hidden="true" />
              Remove
            </button>
          </div>

          <p className="field-hint">
            A locked meal stays put when you regenerate the week.
          </p>
        </>
      )}
    </Modal>
  )
}
