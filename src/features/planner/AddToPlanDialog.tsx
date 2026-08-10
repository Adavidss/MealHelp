import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '@/app/SettingsContext'
import { addPlannedMeal, getOrCreatePlan } from '@/db/plans'
import type { MealType, Recipe } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { dayName, monthDay, startOfWeek, todayISO, weekDates } from '@/utils/date'
import styles from './AddToPlanDialog.module.css'

interface AddToPlanDialogProps {
  open: boolean
  recipe: Recipe
  onClose: () => void
}

/** Puts a recipe on a day, from wherever the recipe happens to be open. */
export function AddToPlanDialog({ open, recipe, onClose }: AddToPlanDialogProps) {
  const { settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()

  const today = todayISO()
  const thisWeek = weekDates(startOfWeek(today, settings.weekStartsOn))
  const nextWeek = weekDates(
    startOfWeek(today, settings.weekStartsOn),
  ).map((date) => addWeek(date))

  const [mealType, setMealType] = useState<MealType>(
    settings.visibleMealTypes[0] ?? 'dinner',
  )
  const [saving, setSaving] = useState(false)

  const add = async (date: string) => {
    setSaving(true)
    try {
      const plan = await getOrCreatePlan(startOfWeek(date, settings.weekStartsOn))
      await addPlannedMeal({
        planId: plan.id,
        date,
        mealType,
        kind: 'recipe',
        recipeId: recipe.id,
        servings: recipe.servings ?? settings.defaultServings,
      })
      toast(`Added to ${dayName(date)}.`, {
        tone: 'success',
        action: {
          label: 'View plan',
          run: () => navigate(`/plan/${startOfWeek(date, settings.weekStartsOn)}`),
        },
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Add to plan" onClose={onClose}>
      {settings.visibleMealTypes.length > 1 ? (
        <div className="field">
          <span className="field-label">Meal</span>
          <div className="row-tight">
            {settings.visibleMealTypes.map((type) => (
              <button
                key={type}
                type="button"
                className="chip chip-button"
                aria-pressed={mealType === type}
                onClick={() => setMealType(type)}
              >
                {MEAL_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="field-label">This week</p>
      <div className={styles.days}>
        {thisWeek.map((date) => (
          <button
            key={date}
            type="button"
            className={styles.day}
            onClick={() => void add(date)}
            disabled={saving}
          >
            <strong>{dayName(date).slice(0, 3)}</strong>
            <small>{monthDay(date)}</small>
          </button>
        ))}
      </div>

      <p className="field-label" style={{ marginTop: 'var(--space-4)' }}>
        Next week
      </p>
      <div className={styles.days}>
        {nextWeek.map((date) => (
          <button
            key={date}
            type="button"
            className={styles.day}
            onClick={() => void add(date)}
            disabled={saving}
          >
            <strong>{dayName(date).slice(0, 3)}</strong>
            <small>{monthDay(date)}</small>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function addWeek(date: string): string {
  const next = new Date(date)
  next.setDate(next.getDate() + 7)
  return next.toISOString().slice(0, 10)
}
