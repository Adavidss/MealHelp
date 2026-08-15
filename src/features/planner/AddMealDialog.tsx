import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChefHat, Refrigerator, Shuffle, Sparkles, Store, Utensils } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { addPlannedMeal, getOrCreatePlan } from '@/db/plans'
import { consumeLeftovers, recordRejection } from '@/db/cookEvents'
import { pantryKeySet } from '@/db/pantry'
import type { CookEvent, MealType, Recipe } from '@/models'
import { MEAL_TYPE_LABELS } from '@/models'
import { rankRecipes, type ScoredRecipe } from '@/services/recommendationEngine'
import { activeMinutes } from '@/services/recipeMetrics'
import { Modal } from '@/components/common/Modal'
import { useToast } from '@/components/common/Toast'
import { dayName, formatMinutes, monthDay } from '@/utils/date'
import { RecipePicker } from './RecipePicker'
import styles from './AddMealDialog.module.css'

interface AddMealDialogProps {
  open: boolean
  /** The week being planned. Its plan row is created on first use, not on sight. */
  weekStart: string
  date: string
  mealType: MealType
  leftovers: CookEvent[]
  usedRecipeIds: string[]
  /** What is already on the week, so a suggestion can be different from it. */
  weekRecipes?: Recipe[]
  defaultServings: number
  onClose: () => void
}

type Mode = 'choose' | 'suggest' | 'recipe' | 'leftovers' | 'custom'

export function AddMealDialog({
  open,
  weekStart,
  date,
  mealType,
  leftovers,
  usedRecipeIds,
  weekRecipes = [],
  defaultServings,
  onClose,
}: AddMealDialogProps) {
  const { toast } = useToast()
  const { settings } = useSettings()
  const [mode, setMode] = useState<Mode>('choose')
  const [customName, setCustomName] = useState('')
  /** Which of the ranked suggestions is on screen; "another" moves along. */
  const [suggestionIndex, setSuggestionIndex] = useState(0)

  const library = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const pantry = useLiveQuery(() => pantryKeySet(), [], new Set<string>())

  // Ranked the way the planner ranks a night: your defaults, your pantry and
  // equipment, what you have cooked lately, and what is already on this week
  // — so the suggestion is not something you are eating on Tuesday.
  const suggestions = useMemo<ScoredRecipe[]>(() => {
    if (mode !== 'suggest') return []
    const defaults = settings.planningDefaults
    return rankRecipes(library, {
      mealType,
      preferredMethods: defaults.preferredMethods,
      preferLeftovers: defaults.preferLeftovers,
      variety: defaults.variety,
      avoidRecentlyCooked: defaults.avoidRecentlyCooked,
      usePantryFirst: defaults.usePantryFirst,
      pantryKeys: pantry,
      equipmentOwned: settings.equipmentOwned,
      recentlyCookedHardDays: settings.recentlyCookedHardDays,
      recentlyCookedSoftDays: settings.recentlyCookedSoftDays,
      chosenRecipes: weekRecipes,
      excludeRecipeIds: new Set(usedRecipeIds),
    })
  }, [mode, library, pantry, settings, mealType, weekRecipes, usedRecipeIds])

  const suggestion = suggestions[suggestionIndex]

  const close = () => {
    setMode('choose')
    setCustomName('')
    setSuggestionIndex(0)
    onClose()
  }

  const another = () => {
    if (suggestion) void recordRejection(suggestion.recipe.id)
    if (suggestionIndex + 1 >= suggestions.length) {
      toast("That's everything that fits — starting from the top again.")
      setSuggestionIndex(0)
      return
    }
    setSuggestionIndex(suggestionIndex + 1)
  }

  const addRecipe = async (recipe: Recipe) => {
    const plan = await getOrCreatePlan(weekStart)
    await addPlannedMeal({
      planId: plan.id,
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
    const plan = await getOrCreatePlan(weekStart)
    await addPlannedMeal({
      planId: plan.id,
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
    const plan = await getOrCreatePlan(weekStart)
    await addPlannedMeal({
      planId: plan.id,
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
            className={`${styles.option} ${styles.optionSuggest}`}
            onClick={() => {
              setSuggestionIndex(0)
              setMode('suggest')
            }}
          >
            <Sparkles size={20} aria-hidden="true" />
            <span>
              <strong>Suggest something</strong>
              <small>MealHelp picks for {dayName(date)}; you say yes or next</small>
            </span>
          </button>

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

      {mode === 'suggest' ? (
        suggestion ? (
          <div className={styles.suggestion}>
            <p className={styles.suggestionEyebrow}>
              Suggestion {suggestionIndex + 1} of {suggestions.length}
            </p>
            {suggestion.recipe.image ? (
              <img src={suggestion.recipe.image} alt="" className={styles.suggestionImage} />
            ) : null}
            <h3 className={styles.suggestionTitle}>{suggestion.recipe.title}</h3>
            <p className={styles.suggestionMeta}>
              {formatMinutes(Math.round(activeMinutes(suggestion.recipe)))} active
              {suggestion.recipe.servings ? ` · makes ${suggestion.recipe.servings}` : ''}
            </p>
            {suggestion.reasons.length ? (
              <ul className={styles.reasons}>
                {suggestion.reasons.slice(0, 4).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            <div className={styles.suggestionActions}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void addRecipe(suggestion.recipe)}
              >
                Add to {dayName(date)}
              </button>
              <button type="button" className="btn btn-secondary" onClick={another}>
                <Shuffle size={16} aria-hidden="true" />
                Another
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setMode('recipe')}>
                Choose myself
              </button>
            </div>
          </div>
        ) : (
          <p className="muted text-sm">
            Nothing in your library fits this night that is not already on the week.
            Pick one yourself, or add a recipe first.
          </p>
        )
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
