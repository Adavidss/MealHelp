import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  CalendarPlus,
  ChefHat,
  CheckCircle2,
  Clock,
  Copy,
  CopyPlus,
  Ellipsis,
  ExternalLink,
  Globe,
  Heart,
  Library,
  Minus,
  Pencil,
  Plus,
  Printer,
  Share2,
  ShoppingCart,
  Trash2,
  Users,
  Utensils,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { deleteRecipe, duplicateRecipe, toggleFavorite, updateRecipe } from '@/db/recipes'
import { pruneRecipeFromCollections } from '@/db/collections'
import { COOKING_METHOD_LABELS } from '@/models'
import { formatMinutes, humanAgo, daysSince } from '@/utils/date'
import { totalMinutes } from '@/services/recipeMetrics'
import { findAlternatives } from '@/services/recommendationEngine'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Modal } from '@/components/common/Modal'
import { StarRating } from '@/components/common/StarRating'
import { useToast } from '@/components/common/Toast'
import { useQuickPlan } from '@/app/QuickPlanContext'
import { AddToGroceryDialog } from '@/features/grocery/AddToGroceryDialog'
import { CollectionPickerDialog } from '@/features/collections/CollectionPickerDialog'
import { FinishCookingDialog } from '@/features/cooking/FinishCookingDialog'
import { ShareRecipeDialog } from '@/features/sharing/ShareRecipeDialog'
import { NutritionPanel } from '@/features/nutrition/NutritionPanel'
import { MealCard } from '@/components/meal/MealCard'
import { OnlineIdeas } from '@/features/discover/OnlineIdeas'
import { similarQuery } from '@/services/recipeDiscovery'
import {
  SCALE_OPTIONS,
  displayIngredientSections,
  ingredientsAsText,
  scaleLabel,
} from './ingredientDisplay'
import { RecipeCostPanel } from './RecipeCostPanel'
import { rememberScale, rememberedScale } from './recipeView'
import styles from './RecipeDetailPage.module.css'

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { planMeal } = useQuickPlan()
  const { settings } = useSettings()

  const recipe = useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id])
  const library = useLiveQuery(() => db.recipes.toArray(), [], [])

  // Opened again at the scale it was left at — see recipeView.
  const [scale, setScaleState] = useState(() => rememberedScale(id) ?? 1)
  const setScale = useCallback(
    (next: number) => {
      setScaleState(next)
      rememberScale(id, next)
    },
    [id],
  )
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [groceryOpen, setGroceryOpen] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [cookedOpen, setCookedOpen] = useState(false)

  const sections = useMemo(
    () => (recipe ? displayIngredientSections(recipe.ingredients, scale) : []),
    [recipe, scale],
  )

  const alternatives = useMemo(
    () => (recipe && library ? findAlternatives(recipe, library, 4) : []),
    [recipe, library],
  )

  if (recipe === undefined) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="page">
        <p>That recipe is no longer in your library.</p>
        <Link to="/recipes" className="btn btn-secondary">
          Back to recipes
        </Link>
      </div>
    )
  }

  const total = totalMinutes(recipe)
  const scaledServings = recipe.servings
    ? Math.round(recipe.servings * scale * 10) / 10
    : undefined
  const cookedAgo = daysSince(recipe.lastCookedAt)

  const toggleChecked = (ingredientId: string) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(ingredientId)) next.delete(ingredientId)
      else next.add(ingredientId)
      return next
    })
  }

  const remove = async () => {
    await deleteRecipe(recipe.id)
    await pruneRecipeFromCollections(recipe.id)
    toast(`Deleted ${recipe.title}.`)
    navigate('/recipes')
  }

  const duplicate = async () => {
    setMoreOpen(false)
    const copy = await duplicateRecipe(recipe.id)
    if (!copy) return
    toast(`Made a copy of ${recipe.title}.`, { tone: 'success' })
    navigate(`/recipes/${copy.id}/edit`)
  }

  /** The ingredient list as plain text, at the scale on screen — for a note or a message. */
  const copyIngredients = async () => {
    setMoreOpen(false)
    try {
      await navigator.clipboard.writeText(ingredientsAsText(recipe, scale))
      toast('Ingredients copied.', { tone: 'success' })
    } catch {
      toast('Your browser blocked the clipboard.', { tone: 'error' })
    }
  }

  const rate = async (value: number | undefined) => {
    await updateRecipe(recipe.id, { rating: value })
  }

  const defaultCookServings = Math.max(
    1,
    Math.round((recipe.servings ?? settings.defaultServings) * scale),
  )

  return (
    <div className="page">
      <div className={styles.topBar}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
        <div className="row-tight">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => void toggleFavorite(recipe.id)}
            aria-pressed={recipe.favorite}
            aria-label={recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              size={19}
              aria-hidden="true"
              className={recipe.favorite ? styles.favoriteOn : undefined}
            />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setShareOpen(true)}
            aria-label="Share recipe"
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
          <Link
            to={`/recipes/${recipe.id}/edit`}
            className="btn btn-ghost btn-icon"
            aria-label="Edit recipe"
          >
            <Pencil size={18} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setMoreOpen(true)}
            aria-label="More actions"
          >
            <Ellipsis size={19} aria-hidden="true" />
          </button>
        </div>
      </div>

      <header className={styles.header}>
        {recipe.image ? (
          <img src={recipe.image} alt="" className={styles.hero} />
        ) : null}
        <h1 className={styles.title}>{recipe.title}</h1>
        {recipe.description ? (
          <p className={styles.description}>{recipe.description}</p>
        ) : null}

        <dl className={styles.facts}>
          {scaledServings ? (
            <div className={styles.fact}>
              <dt>
                <Users size={15} aria-hidden="true" /> Servings
              </dt>
              <dd>{scaledServings}</dd>
            </div>
          ) : null}
          {recipe.prepTimeMinutes ? (
            <div className={styles.fact}>
              <dt>
                <Clock size={15} aria-hidden="true" /> Prep
              </dt>
              <dd>{formatMinutes(recipe.prepTimeMinutes)}</dd>
            </div>
          ) : null}
          {recipe.cookTimeMinutes ? (
            <div className={styles.fact}>
              <dt>
                <Utensils size={15} aria-hidden="true" /> Cook
              </dt>
              <dd>{formatMinutes(recipe.cookTimeMinutes)}</dd>
            </div>
          ) : null}
          {total ? (
            <div className={styles.fact}>
              <dt>Total</dt>
              <dd>{formatMinutes(total)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="row-tight">
          {recipe.cookingMethods.map((method) => (
            <span key={method} className="chip chip-accent">
              {COOKING_METHOD_LABELS[method]}
            </span>
          ))}
          {recipe.tags.map((tag) => (
            <span key={tag} className="chip">
              {tag}
            </span>
          ))}
        </div>

        <div className={styles.actions}>
          <Link to={`/recipes/${recipe.id}/cook`} className="btn btn-primary btn-lg">
            <ChefHat size={18} aria-hidden="true" />
            Start cooking
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => planMeal(recipe)}
          >
            <CalendarPlus size={17} aria-hidden="true" />
            Add to plan
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setGroceryOpen(true)}
            disabled={recipe.ingredients.length === 0}
          >
            <ShoppingCart size={17} aria-hidden="true" />
            Grocery list
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCollectionsOpen(true)}
          >
            <Library size={17} aria-hidden="true" />
            Collections
          </button>
        </div>
      </header>

      {recipe.equipment.length ? (
        <section>
          <h2 className="section-title">Equipment</h2>
          <ul className={styles.equipment}>
            {recipe.equipment.map((item) => (
              <li key={item} className="chip">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="section-title">
          <h2>Ingredients</h2>
          <div className={styles.scaleRow} role="group" aria-label="Scale recipe">
            {SCALE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className="chip chip-button"
                aria-pressed={scale === option}
                onClick={() => setScale(option)}
              >
                {scaleLabel(option)}
              </button>
            ))}
          </div>
        </div>

        {/* Cooking for five when the recipe says four is not a multiplier
            anybody wants to work out, so the servings themselves are a dial —
            and it shows what that came to in ×, since that is the number the
            ingredient lines were multiplied by. */}
        {recipe.servings ? (
          <div className={styles.servingsDial}>
            <span className={styles.servingsLabel}>Cooking for</span>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="One fewer serving"
              disabled={(scaledServings ?? 0) <= 1}
              onClick={() => setScale(Math.max(1, Math.round(recipe.servings! * scale) - 1) / recipe.servings!)}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <strong className={styles.servingsCount}>{scaledServings}</strong>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              aria-label="One more serving"
              disabled={(scaledServings ?? 0) >= 60}
              onClick={() => setScale((Math.round(recipe.servings! * scale) + 1) / recipe.servings!)}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
            <span className={styles.servingsNote}>
              {scale === 1
                ? `as written`
                : `${scaleLabel(Math.round(scale * 10) / 10)} · as written it makes ${recipe.servings}`}
            </span>
          </div>
        ) : null}

        {sections.map((section, index) => (
          <div key={section.title ?? index}>
            {section.title ? <h3 className={styles.sectionHeading}>{section.title}</h3> : null}
            <ul className={styles.ingredients}>
              {section.items.map((item) => (
                <li key={item.id}>
                  <label className={styles.ingredient}>
                    <input
                      type="checkbox"
                      checked={checked.has(item.id)}
                      onChange={() => toggleChecked(item.id)}
                      className={styles.checkbox}
                    />
                    <span className={checked.has(item.id) ? styles.struck : undefined}>
                      {item.quantityText ? (
                        <strong className={styles.quantity}>{item.quantityText}</strong>
                      ) : null}{' '}
                      {item.name}
                      {item.preparation ? (
                        <span className={styles.preparation}>, {item.preparation}</span>
                      ) : null}
                      {item.optional ? (
                        <span className={styles.preparation}> (optional)</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Under the ingredients, because that is what it is adding up — and
            it follows the same ½×–2× scale they are shown at. */}
        <RecipeCostPanel recipe={recipe} scale={scale} />
      </section>

      <section>
        <h2 className="section-title">Directions</h2>
        <ol className={styles.steps}>
          {recipe.instructions.map((step) => (
            <li key={step.id} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {step.order}
              </span>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <NutritionPanel recipe={recipe} />

      {recipe.notes ? (
        <section>
          <h2 className="section-title">Notes</h2>
          <p className={styles.notes}>{recipe.notes}</p>
        </section>
      ) : null}

      <section className={styles.historyCard}>
        <h2 className={styles.historyTitle}>Your history</h2>
        <div className={styles.historyRow}>
          <StarRating
            value={recipe.rating}
            size={22}
            label="Rate this recipe"
            onChange={(value) => void rate(value)}
          />
          <span className="text-sm muted">
            {recipe.timesCooked > 0
              ? `Cooked ${recipe.timesCooked} time${recipe.timesCooked === 1 ? '' : 's'}`
              : 'Never cooked'}
            {cookedAgo != null ? ` · last ${humanAgo(cookedAgo)}` : ''}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setCookedOpen(true)}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            I cooked this
          </button>
        </div>
      </section>

      {recipe.sourceUrl ? (
        <p className={styles.source}>
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            View original recipe
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          {recipe.sourceName ? (
            <span className="faint text-sm"> · {recipe.sourceName}</span>
          ) : null}
          <span className="faint text-sm"> · </span>
          <Link
            to={`/browser?url=${encodeURIComponent(recipe.sourceUrl)}`}
            className="text-sm"
          >
            open in MealHelp's browser
          </Link>
        </p>
      ) : recipe.sourceName ? (
        <p className={`${styles.source} faint text-sm`}>From {recipe.sourceName}</p>
      ) : null}

      <OnlineIdeas
        title="More like this from the web"
        blurb={`Recipes for ${similarQuery(recipe.title)}, from the free recipe databases`}
        query={similarQuery(recipe.title)}
        excludeTitles={(library ?? []).map((entry) => entry.title)}
      />

      {alternatives.length ? (
        <section>
          <h2 className="section-title">Similar recipes you have</h2>
          <ul className={styles.alternatives}>
            {alternatives.map((alternative) => (
              <li key={alternative.recipe.id}>
                <MealCard
                  recipe={alternative.recipe}
                  size="compact"
                  to={`/recipes/${alternative.recipe.id}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={styles.dangerRow}>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} aria-hidden="true" />
          Delete recipe
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this recipe?"
        message={`"${recipe.title}" will be removed from your library, your collections and any weeks you have planned. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          void remove()
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <AddToGroceryDialog
        open={groceryOpen}
        recipe={recipe}
        defaultServings={recipe.servings ? Math.max(1, Math.round(recipe.servings * scale)) : undefined}
        onClose={() => setGroceryOpen(false)}
      />

      <FinishCookingDialog
        open={cookedOpen}
        recipe={recipe}
        defaultServings={defaultCookServings}
        onClose={() => setCookedOpen(false)}
        onDone={() => setCookedOpen(false)}
      />

      <Modal open={moreOpen} title={recipe.title} onClose={() => setMoreOpen(false)}>
        <div className={styles.moreMenu}>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void copyIngredients()}>
            <Copy size={17} aria-hidden="true" />
            Copy ingredients as text
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void duplicate()}>
            <CopyPlus size={17} aria-hidden="true" />
            Duplicate and edit the copy
          </button>
          <Link to={`/recipes/${recipe.id}/print`} className="btn btn-secondary btn-block" onClick={() => setMoreOpen(false)}>
            <Printer size={17} aria-hidden="true" />
            Print this recipe
          </Link>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              setMoreOpen(false)
              setShareOpen(true)
            }}
          >
            <Share2 size={17} aria-hidden="true" />
            Share
          </button>
          {recipe.sourceUrl ? (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => navigate(`/browser?url=${encodeURIComponent(recipe.sourceUrl ?? '')}`)}
            >
              <Globe size={17} aria-hidden="true" />
              Open the original in MealHelp's browser
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={() => {
              setMoreOpen(false)
              setConfirmDelete(true)
            }}
          >
            <Trash2 size={17} aria-hidden="true" />
            Delete recipe
          </button>
        </div>
      </Modal>

      <CollectionPickerDialog
        open={collectionsOpen}
        recipeId={recipe.id}
        onClose={() => setCollectionsOpen(false)}
      />

      <ShareRecipeDialog
        open={shareOpen}
        recipe={recipe}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}
