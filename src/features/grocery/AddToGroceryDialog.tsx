import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShoppingCart } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { addRecipeToGroceryList } from '@/db/grocery'
import type { Recipe } from '@/models'
import { normalizeIngredientKey } from '@/services/ingredientParser'
import { displayIngredientSections } from '@/features/recipes/ingredientDisplay'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { addDays, dayNameShort, formatWeekRange, startOfWeek, todayISO, weekDates } from '@/utils/date'
import { clearGroceryDraft, readGroceryDraft, saveGroceryDraft } from './groceryDraft'
import styles from './AddToGroceryDialog.module.css'

interface AddToGroceryDialogProps {
  open: boolean
  recipe: Recipe
  /** Where to start the servings — usually the recipe's own, at the page's current scale. */
  defaultServings?: number
  onClose: () => void
}

/**
 * Puts a recipe's ingredients on the shopping list without planning it, the
 * way Mela's "add to shopping list" does: pick how many servings, untick what
 * is already in the cupboard, add. The list itself does the merging, so a
 * recipe that shares an onion with the week's plan adds to that onion rather
 * than listing a second one.
 */
export function AddToGroceryDialog({
  open,
  recipe,
  defaultServings,
  onClose,
}: AddToGroceryDialogProps) {
  const { settings } = useSettings()
  const { toast } = useToast()
  const navigate = useNavigate()

  const thisWeek = startOfWeek(todayISO(), settings.weekStartsOn)
  const nextWeek = addDays(thisWeek, 7)

  const [week, setWeek] = useState<string>(thisWeek)
  const [servings, setServings] = useState<number>(defaultServings ?? recipe.servings ?? 0)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [resumed, setResumed] = useState(false)

  /*
   * Reopened where it was left. Unticking twenty ingredients is real work, and
   * an interruption should not cost it — see groceryDraft. Only ingredients
   * the recipe still has are carried over, so an edited recipe cannot leave a
   * draft excluding lines nobody can see.
   */
  useEffect(() => {
    if (!open) return
    const draft = readGroceryDraft(recipe.id)
    const known = new Set(recipe.ingredients.map((ingredient) => ingredient.id))
    const carried = (draft?.excluded ?? []).filter((id) => known.has(id))

    setWeek(draft?.week === nextWeek ? nextWeek : thisWeek)
    setServings(draft?.servings ?? defaultServings ?? recipe.servings ?? 0)
    setExcluded(new Set(carried))
    setResumed(Boolean(draft) && (carried.length > 0 || draft?.week === nextWeek))
    // thisWeek is derived from today; recomputing on open is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultServings, recipe.id])

  // Every change is the draft: closing the dialog is not a decision to discard.
  useEffect(() => {
    if (!open) return
    saveGroceryDraft(recipe.id, { week, servings, excluded: [...excluded] })
  }, [open, recipe.id, week, servings, excluded])

  const scalable = Boolean(recipe.servings && recipe.servings > 0)
  const scale = scalable && servings > 0 ? servings / (recipe.servings as number) : 1
  const sections = useMemo(
    () => displayIngredientSections(recipe.ingredients, scale),
    [recipe.ingredients, scale],
  )

  // Staples you said you always have are marked, not hidden: the list will
  // put them under "check the pantry" either way, and knowing which lines
  // those are makes unticking the rest quicker.
  const pantry = useLiveQuery(() => db.pantryItems.toArray(), [], [])
  const stapleKeys = useMemo(
    () => new Set(pantry.filter((item) => item.alwaysHave).map((item) => item.key)),
    [pantry],
  )
  const isStaple = (name: string) => stapleKeys.has(normalizeIngredientKey(name))

  // If the recipe is already on the chosen week's plan, its ingredients are on
  // the list from that; say so rather than letting them be bought twice unnoticed.
  const plannedDates = useLiveQuery(
    async () => {
      const dates = weekDates(week)
      const meals = await db.plannedMeals.where('date').anyOf(dates).toArray()
      return meals
        .filter((meal) => meal.recipeId === recipe.id && meal.kind === 'recipe' && !meal.isLeftover)
        .map((meal) => meal.date)
        .sort()
    },
    [week, recipe.id],
    [] as string[],
  )

  const total = recipe.ingredients.length
  const included = total - excluded.size

  const toggle = (id: string) => {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const add = async () => {
    if (included === 0) return
    setSaving(true)
    try {
      await addRecipeToGroceryList(week, recipe, {
        servings: scalable ? servings : undefined,
        excludedIngredientIds: [...excluded],
      })
      clearGroceryDraft(recipe.id)
      const label = week === thisWeek ? "this week's" : "next week's"
      toast(`Added ${recipe.title} to ${label} grocery list.`, {
        tone: 'success',
        action: {
          label: 'View list',
          run: () => navigate(week === thisWeek ? '/grocery' : `/grocery?week=${week}`),
        },
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Add to grocery list"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void add()}
            disabled={saving || included === 0}
          >
            <ShoppingCart size={17} aria-hidden="true" />
            {saving
              ? 'Adding…'
              : `Add ${included} ${included === 1 ? 'ingredient' : 'ingredients'}`}
          </button>
        </>
      }
    >
      <div className={styles.controls}>
        <div className="field">
          <span className="field-label">Which week</span>
          <div className="row-tight">
            <button
              type="button"
              className="chip chip-button"
              aria-pressed={week === thisWeek}
              onClick={() => setWeek(thisWeek)}
            >
              This week
            </button>
            <button
              type="button"
              className="chip chip-button"
              aria-pressed={week === nextWeek}
              onClick={() => setWeek(nextWeek)}
            >
              Next week
            </button>
            <span className={styles.weekRange}>{formatWeekRange(week)}</span>
          </div>
        </div>

        {scalable ? (
          <div className="field">
            <span className="field-label">Shopping for</span>
            <div className={styles.stepper}>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setServings((value) => Math.max(1, value - 1))}
                aria-label="One fewer serving"
                disabled={servings <= 1}
              >
                −
              </button>
              <span className={styles.value}>{servings}</span>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setServings((value) => Math.min(48, value + 1))}
                aria-label="One more serving"
                disabled={servings >= 48}
              >
                +
              </button>
              <span className={styles.stepperNote}>
                servings
                {recipe.servings && servings !== recipe.servings
                  ? ` · recipe makes ${recipe.servings}`
                  : ''}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {plannedDates.length ? (
        <p className={styles.plannedNote}>
          Already planned for{' '}
          {plannedDates.map((date) => dayNameShort(date)).join(', ')} that week — its
          ingredients are on the list from that. Add anyway if you are cooking it again.
        </p>
      ) : null}

      <p className={styles.hint}>
        Untick anything you already have.
        {resumed ? ' Picked up where you left off.' : ''}
      </p>

      {sections.map((section, index) => (
        <div key={section.title ?? index}>
          {section.title ? <h3 className={styles.sectionHeading}>{section.title}</h3> : null}
          <ul className={styles.list}>
            {section.items.map((item) => (
              <li key={item.id}>
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={!excluded.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span className={excluded.has(item.id) ? styles.left : undefined}>
                    {item.quantityText ? (
                      <strong className={styles.quantity}>{item.quantityText}</strong>
                    ) : null}{' '}
                    {item.name}
                    {item.optional ? <span className={styles.faint}> (optional)</span> : null}
                  </span>
                  {isStaple(item.name) ? <span className={styles.staple}>usually have</span> : null}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Modal>
  )
}
