import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardPaste, Globe, ImagePlus, Loader2, Sparkles } from 'lucide-react'
import { getRecipe, saveRecipe, updateRecipe } from '@/db/recipes'
import {
  BUDGET_LEVELS,
  COOKING_METHODS,
  COOKING_METHOD_LABELS,
  COMMON_EQUIPMENT,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
} from '@/models'
import type {
  BudgetLevel,
  CookingMethod,
  MealType,
  Recipe,
  RecipeDraft,
  Score5,
} from '@/models'
import { parseIngredientLines } from '@/services/ingredientParser'
import { buildInstructions, detectCookingMethods, parseRecipeText } from '@/services/recipeImport'
import { useToast } from '@/components/common/Toast'
import { isImageFile, resizeImageFile } from '@/utils/image'
import { newId } from '@/utils/id'
import styles from './RecipeEditPage.module.css'

interface FormState {
  title: string
  description: string
  image: string
  sourceUrl: string
  sourceName: string
  servings: string
  prepTimeMinutes: string
  cookTimeMinutes: string
  activeTimeMinutes: string
  ingredientText: string
  instructionText: string
  notes: string
  tags: string
  equipment: string[]
  cookingMethods: CookingMethod[]
  mealTypes: MealType[]
  leftoverScore?: Score5
  bulkScore?: Score5
  cleanupScore?: Score5
  freezerFriendly: boolean
  mealPrepFriendly: boolean
  reheatsWell: boolean
  costTier?: BudgetLevel
}

const EMPTY: FormState = {
  title: '',
  description: '',
  image: '',
  sourceUrl: '',
  sourceName: '',
  servings: '4',
  prepTimeMinutes: '',
  cookTimeMinutes: '',
  activeTimeMinutes: '',
  ingredientText: '',
  instructionText: '',
  notes: '',
  tags: '',
  equipment: [],
  cookingMethods: [],
  mealTypes: ['dinner'],
  freezerFriendly: false,
  mealPrepFriendly: false,
  reheatsWell: false,
}

function toForm(recipe: Recipe): FormState {
  return {
    title: recipe.title,
    description: recipe.description ?? '',
    image: recipe.image ?? '',
    sourceUrl: recipe.sourceUrl ?? '',
    sourceName: recipe.sourceName ?? '',
    servings: recipe.servings ? String(recipe.servings) : '',
    prepTimeMinutes: recipe.prepTimeMinutes ? String(recipe.prepTimeMinutes) : '',
    cookTimeMinutes: recipe.cookTimeMinutes ? String(recipe.cookTimeMinutes) : '',
    activeTimeMinutes: recipe.activeTimeMinutes ? String(recipe.activeTimeMinutes) : '',
    // Ingredients are edited as text, one per line: it is much faster to type
    // and to paste than a grid of fields, and it is re-parsed on save.
    ingredientText: recipe.ingredients.map((i) => i.originalText).join('\n'),
    instructionText: recipe.instructions.map((s) => s.text).join('\n\n'),
    notes: recipe.notes ?? '',
    tags: recipe.tags.join(', '),
    equipment: recipe.equipment,
    cookingMethods: recipe.cookingMethods,
    mealTypes: recipe.mealTypes,
    leftoverScore: recipe.leftoverScore,
    bulkScore: recipe.bulkScore,
    cleanupScore: recipe.cleanupScore,
    freezerFriendly: Boolean(recipe.freezerFriendly),
    mealPrepFriendly: Boolean(recipe.mealPrepFriendly),
    reheatsWell: Boolean(recipe.reheatsWell),
    costTier: recipe.costTier,
  }
}

export function RecipeEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  // The import preview hands its draft over through router state.
  const importedDraft = (location.state as { draft?: RecipeDraft } | null)?.draft

  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string>()
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    if (!id) {
      if (importedDraft) setForm(toForm(importedDraft as Recipe))
      return
    }
    let cancelled = false
    void getRecipe(id).then((recipe) => {
      if (cancelled) return
      if (recipe) setForm(toForm(recipe))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id, importedDraft])

  const parsedIngredients = useMemo(
    () => parseIngredientLines(form.ingredientText),
    [form.ingredientText],
  )

  // What the words on the page say about how it is cooked, offered — never
  // applied — because a suggestion the user has to tap is one they can see.
  const suggestedMethods = useMemo(() => {
    const detected = detectCookingMethods(
      form.title,
      form.instructionText.split(/\n+/).filter(Boolean),
      form.equipment.join(' '),
    )
    return detected.filter((method) => !form.cookingMethods.includes(method))
  }, [form.title, form.instructionText, form.equipment, form.cookingMethods])

  /**
   * A whole recipe pasted in one go — from a message, a note, a photo's text —
   * read the way Import reads pasted text, and poured into whichever fields
   * are still empty. Nothing already typed is overwritten.
   */
  const fillFromPaste = () => {
    const text = pasteText.trim()
    if (!text) return
    const { draft } = parseRecipeText(text)
    setForm((current) => ({
      ...current,
      title: current.title.trim() || draft.title,
      description: current.description.trim() || draft.description || '',
      servings: current.servings.trim() && current.servings !== '4' ? current.servings : draft.servings ? String(draft.servings) : current.servings,
      prepTimeMinutes: current.prepTimeMinutes || (draft.prepTimeMinutes ? String(draft.prepTimeMinutes) : ''),
      cookTimeMinutes: current.cookTimeMinutes || (draft.cookTimeMinutes ? String(draft.cookTimeMinutes) : ''),
      ingredientText:
        current.ingredientText.trim() || draft.ingredients.map((i) => i.originalText).join('\n'),
      instructionText:
        current.instructionText.trim() || draft.instructions.map((s) => s.text).join('\n\n'),
      cookingMethods: current.cookingMethods.length ? current.cookingMethods : draft.cookingMethods,
      tags: current.tags.trim() || draft.tags.join(', '),
    }))
    setPasteText('')
    setPasteOpen(false)
    toast(
      draft.ingredients.length
        ? `Read ${draft.ingredients.length} ingredients and ${draft.instructions.length} steps. Check them over.`
        : 'Read what it could — check the fields it filled.',
      { tone: 'success' },
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const handleImage = async (file: File) => {
    if (!isImageFile(file)) {
      setError('That file is not an image.')
      return
    }
    setImageBusy(true)
    setError(undefined)
    try {
      const resized = await resizeImageFile(file)
      set('image', resized.dataUrl)
    } catch {
      setError('MealHelp could not read that image. Try a different photo.')
    } finally {
      setImageBusy(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setError('Give the recipe a name so you can find it later.')
      return
    }

    setSaving(true)
    setError(undefined)
    try {
      const draft: RecipeDraft = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        image: form.image.trim() || undefined,
        sourceUrl: form.sourceUrl.trim() || undefined,
        sourceName: form.sourceName.trim() || undefined,
        servings: toNumber(form.servings),
        prepTimeMinutes: toNumber(form.prepTimeMinutes),
        cookTimeMinutes: toNumber(form.cookTimeMinutes),
        activeTimeMinutes: toNumber(form.activeTimeMinutes),
        ingredients: parsedIngredients.map((parsed) => ({ id: newId('ing'), ...parsed })),
        instructions: buildInstructions(
          form.instructionText.split(/\n{2,}|\n/).filter(Boolean),
        ),
        notes: form.notes.trim() || undefined,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        categories: [],
        equipment: form.equipment,
        cookingMethods: form.cookingMethods,
        mealTypes: form.mealTypes.length ? form.mealTypes : ['dinner'],
        leftoverScore: form.leftoverScore,
        bulkScore: form.bulkScore,
        cleanupScore: form.cleanupScore,
        freezerFriendly: form.freezerFriendly || undefined,
        mealPrepFriendly: form.mealPrepFriendly || undefined,
        reheatsWell: form.reheatsWell || undefined,
        costTier: form.costTier,
      }

      if (id) {
        await updateRecipe(id, draft as Partial<Recipe>)
        toast('Recipe updated.', { tone: 'success' })
        navigate(`/recipes/${id}`)
      } else {
        const saved = await saveRecipe(draft)
        toast('Recipe saved.', { tone: 'success' })
        navigate(`/recipes/${saved.id}`)
      }
    } catch {
      setError('MealHelp could not save that recipe. Your data is still here — try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  return (
    <form className="page" onSubmit={submit}>
      <div className={styles.topBar}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : id ? 'Save changes' : 'Save recipe'}
        </button>
      </div>

      <h1 className="page-title">{id ? 'Edit recipe' : 'New recipe'}</h1>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {!id ? (
        <section className={styles.smartStart}>
          {pasteOpen ? (
            <>
              <label className="field-label" htmlFor="paste-recipe">
                Paste a recipe and MealHelp will fill the form
              </label>
              <textarea
                id="paste-recipe"
                className={`textarea ${styles.pasteBox}`}
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={
                  'Slow Cooker Chicken Curry\n\nServes 6\nPrep 20 minutes\n\nIngredients\n2 lbs chicken thighs\n1 can coconut milk\n\nInstructions\n1. Put everything in the slow cooker.\n2. Cook on low for 6 hours.'
                }
                autoFocus
              />
              <div className="row-tight">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={fillFromPaste}
                  disabled={!pasteText.trim()}
                >
                  <Sparkles size={15} aria-hidden="true" />
                  Fill the form
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPasteOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className={styles.smartRow}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPasteOpen(true)}
              >
                <ClipboardPaste size={15} aria-hidden="true" />
                Paste a recipe to fill this in
              </button>
              <span className="text-sm faint">
                From a message, a note, anywhere — MealHelp sorts out the ingredients and
                steps.
              </span>
            </div>
          )}
        </section>
      ) : null}

      <div className="field">
        <label className="field-label" htmlFor="title">
          Name
        </label>
        <input
          id="title"
          className="input"
          value={form.title}
          onChange={(event) => set('title', event.target.value)}
          placeholder="Slow Cooker Chicken Curry"
          required
        />
        {!id && form.title.trim().length >= 3 && !form.ingredientText.trim() ? (
          <span className="field-hint">
            Know it from a website?{' '}
            <Link to={`/browser?q=${encodeURIComponent(form.title.trim())}`}>
              <Globe size={13} aria-hidden="true" /> Find “{form.title.trim()}” online
            </Link>{' '}
            and add it from the page instead of typing.
          </span>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="description">
          Description
        </label>
        <input
          id="description"
          className="input"
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder="One line about why you make this"
        />
      </div>

      <div className={styles.threeUp}>
        <div className="field">
          <label className="field-label" htmlFor="servings">
            Servings
          </label>
          <input
            id="servings"
            className="input"
            type="number"
            inputMode="numeric"
            min="1"
            value={form.servings}
            onChange={(event) => set('servings', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="prep">
            Prep (min)
          </label>
          <input
            id="prep"
            className="input"
            type="number"
            inputMode="numeric"
            min="0"
            value={form.prepTimeMinutes}
            onChange={(event) => set('prepTimeMinutes', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cook">
            Cook (min)
          </label>
          <input
            id="cook"
            className="input"
            type="number"
            inputMode="numeric"
            min="0"
            value={form.cookTimeMinutes}
            onChange={(event) => set('cookTimeMinutes', event.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="ingredients">
          Ingredients
        </label>
        <span className="field-hint">
          One per line. Paste a whole list and MealHelp will split it up.
        </span>
        <textarea
          id="ingredients"
          className={`textarea ${styles.tall}`}
          value={form.ingredientText}
          onChange={(event) => set('ingredientText', event.target.value)}
          placeholder={'1 lb chicken thighs\n1 can coconut milk\n2 tbsp curry paste\n2 cups spinach'}
        />
        {parsedIngredients.length ? (
          <p className="field-hint">
            {parsedIngredients.length} ingredient
            {parsedIngredients.length === 1 ? '' : 's'} · MealHelp read{' '}
            {parsedIngredients.filter((i) => i.quantity != null).length} quantit
            {parsedIngredients.filter((i) => i.quantity != null).length === 1
              ? 'y'
              : 'ies'}{' '}
            for the grocery list. The lines are saved exactly as you typed them.
          </p>
        ) : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="instructions">
          Directions
        </label>
        <span className="field-hint">One step per line.</span>
        <textarea
          id="instructions"
          className={`textarea ${styles.tall}`}
          value={form.instructionText}
          onChange={(event) => set('instructionText', event.target.value)}
          placeholder={'Brown the chicken.\nAdd everything else and simmer for 20 minutes.'}
        />
      </div>

      <div className="field">
        <span className="field-label">How it's cooked</span>
        <div className="row-tight">
          {COOKING_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              className="chip chip-button"
              aria-pressed={form.cookingMethods.includes(method)}
              onClick={() => set('cookingMethods', toggleIn(form.cookingMethods, method))}
            >
              {COOKING_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
        {suggestedMethods.length ? (
          <span className={`field-hint ${styles.suggestRow}`}>
            <Sparkles size={13} aria-hidden="true" />
            Reads like{' '}
            {suggestedMethods.map((method) => COOKING_METHOD_LABELS[method]).join(' · ')}.
            <button
              type="button"
              className={styles.suggestApply}
              onClick={() =>
                set('cookingMethods', [...form.cookingMethods, ...suggestedMethods])
              }
            >
              Use {suggestedMethods.length === 1 ? 'that' : 'those'}
            </button>
          </span>
        ) : null}
      </div>

      <div className="field">
        <span className="field-label">Meal</span>
        <div className="row-tight">
          {MEAL_TYPES.map((mealType) => (
            <button
              key={mealType}
              type="button"
              className="chip chip-button"
              aria-pressed={form.mealTypes.includes(mealType)}
              onClick={() => set('mealTypes', toggleIn(form.mealTypes, mealType))}
            >
              {MEAL_TYPE_LABELS[mealType]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="tags">
          Tags
        </label>
        <input
          id="tags"
          className="input"
          value={form.tags}
          onChange={(event) => set('tags', event.target.value)}
          placeholder="easy, cheap, bulk"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          className="textarea"
          value={form.notes}
          onChange={(event) => set('notes', event.target.value)}
          placeholder="Use less salt next time. Works better at 8 hours on low."
        />
      </div>

      <div className="field">
        <span className="field-label">Photo</span>
        <div className={styles.imageRow}>
          {form.image ? (
            <img src={form.image} alt="" className={styles.thumb} />
          ) : null}
          <div className={styles.imageControls}>
            <label className="btn btn-secondary btn-sm">
              {imageBusy ? (
                <Loader2 size={15} aria-hidden="true" />
              ) : (
                <ImagePlus size={15} aria-hidden="true" />
              )}
              {imageBusy ? 'Processing…' : 'Choose photo'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleImage(file)
                }}
              />
            </label>
            {form.image ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => set('image', '')}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <span className="field-hint">
          Photos are resized before they are saved, so a large one is fine.
        </span>
      </div>

      <button
        type="button"
        className={styles.advancedToggle}
        onClick={() => setShowAdvanced((open) => !open)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? 'Hide' : 'Show'} planning details
      </button>

      {showAdvanced ? (
        <div className={styles.advanced}>
          <p className="field-hint">
            MealHelp guesses all of this from the recipe. Fill anything in and your
            answer is used instead.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="active">
              Hands-on minutes
            </label>
            <input
              id="active"
              className="input"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.activeTimeMinutes}
              onChange={(event) => set('activeTimeMinutes', event.target.value)}
              placeholder="20"
            />
            <span className="field-hint">
              A slow cooker meal takes six hours but twenty minutes of work.
            </span>
          </div>

          <ScoreField
            label="Leftover quality"
            value={form.leftoverScore}
            onChange={(value) => set('leftoverScore', value)}
          />
          <ScoreField
            label="Good for big batches"
            value={form.bulkScore}
            onChange={(value) => set('bulkScore', value)}
          />
          <ScoreField
            label="Easy cleanup"
            value={form.cleanupScore}
            onChange={(value) => set('cleanupScore', value)}
          />

          <div className="field">
            <span className="field-label">Also true of this recipe</span>
            <div className="row-tight">
              <button
                type="button"
                className="chip chip-button"
                aria-pressed={form.freezerFriendly}
                onClick={() => set('freezerFriendly', !form.freezerFriendly)}
              >
                Freezes well
              </button>
              <button
                type="button"
                className="chip chip-button"
                aria-pressed={form.mealPrepFriendly}
                onClick={() => set('mealPrepFriendly', !form.mealPrepFriendly)}
              >
                Good for meal prep
              </button>
              <button
                type="button"
                className="chip chip-button"
                aria-pressed={form.reheatsWell}
                onClick={() => set('reheatsWell', !form.reheatsWell)}
              >
                Reheats well
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Roughly what it costs</span>
            <div className="row-tight">
              {BUDGET_LEVELS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className="chip chip-button"
                  aria-pressed={form.costTier === tier}
                  onClick={() => set('costTier', form.costTier === tier ? undefined : tier)}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Equipment</span>
            <div className="row-tight">
              {COMMON_EQUIPMENT.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="chip chip-button"
                  aria-pressed={form.equipment.includes(item)}
                  onClick={() => set('equipment', toggleIn(form.equipment, item))}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="sourceUrl">
              Original recipe link
            </label>
            <input
              id="sourceUrl"
              className="input"
              type="url"
              value={form.sourceUrl}
              onChange={(event) => set('sourceUrl', event.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
      ) : null}

      <div className={styles.footer}>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={saving}>
          {saving ? 'Saving…' : id ? 'Save changes' : 'Save recipe'}
        </button>
      </div>
    </form>
  )
}

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string
  value: Score5 | undefined
  onChange: (value: Score5 | undefined) => void
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="row-tight">
        {([1, 2, 3, 4, 5] as Score5[]).map((score) => (
          <button
            key={score}
            type="button"
            className="chip chip-button"
            aria-pressed={value === score}
            onClick={() => onChange(value === score ? undefined : score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}

function toNumber(value: string): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
