import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Printer } from 'lucide-react'
import { db } from '@/db/database'
import type { Recipe } from '@/models'
import { COOKING_METHOD_LABELS, NUTRIENTS } from '@/models'
import { formatNutrient, hasNutrition } from '@/services/nutrition'
import { buildAppUrl } from '@/services/shareCodec'
import { formatMinutes } from '@/utils/date'
import { totalMinutes } from '@/services/recipeMetrics'
import { QRCode } from '@/components/common/QRCode'
import { displayIngredientSections, SCALE_OPTIONS, scaleLabel } from '@/features/recipes/ingredientDisplay'
import styles from './RecipePrintPage.module.css'

/**
 * A recipe on paper.
 *
 * One recipe, or a whole collection's worth (?ids=…), each starting on its
 * own page. The layout is the one standard recipe view squared up for US
 * Letter: facts across the top, ingredients down the left, directions down
 * the right, notes and nutrition under, and a QR code that brings a phone
 * back to the recipe in MealHelp. The controls above the sheet never print.
 */
export function RecipePrintPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const ids = useMemo(() => {
    if (id) return [id]
    return (params.get('ids') ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
  }, [id, params])

  const recipes = useLiveQuery(
    async () => {
      const rows = await db.recipes.bulkGet(ids)
      return rows.filter((row): row is Recipe => Boolean(row))
    },
    [ids],
  )

  const [scale, setScale] = useState(1)
  const [withPhoto, setWithPhoto] = useState(true)
  const [largeText, setLargeText] = useState(false)
  const [withQr, setWithQr] = useState(true)

  if (recipes === undefined) {
    return (
      <div className="page">
        <p className="muted">Getting the recipe ready…</p>
      </div>
    )
  }

  if (!recipes.length) {
    return (
      <div className="page">
        <p>There is nothing to print — the recipe may have been deleted.</p>
        <Link to="/recipes" className="btn btn-secondary">
          Back to recipes
        </Link>
      </div>
    )
  }

  const backTo = recipes.length === 1 ? `/recipes/${recipes[0].id}` : '/recipes?tab=collections'

  return (
    <div className={`${styles.screen} ${largeText ? styles.large : ''}`}>
      <div className={`${styles.controls} no-print`}>
        <Link to={backTo} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </Link>
        <div className={styles.options}>
          <div className="row-tight" role="group" aria-label="Scale">
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
          <div className="row-tight">
            <button type="button" className="chip chip-button" aria-pressed={withPhoto} onClick={() => setWithPhoto((v) => !v)}>
              Photo
            </button>
            <button type="button" className="chip chip-button" aria-pressed={largeText} onClick={() => setLargeText((v) => !v)}>
              Large text
            </button>
            <button type="button" className="chip chip-button" aria-pressed={withQr} onClick={() => setWithQr((v) => !v)}>
              QR code
            </button>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={17} aria-hidden="true" />
          Print {recipes.length > 1 ? `${recipes.length} recipes` : ''}
        </button>
      </div>

      {recipes.map((recipe) => (
        <RecipeSheet key={recipe.id} recipe={recipe} scale={scale} withPhoto={withPhoto} withQr={withQr} />
      ))}
    </div>
  )
}

function RecipeSheet({
  recipe,
  scale,
  withPhoto,
  withQr,
}: {
  recipe: Recipe
  scale: number
  withPhoto: boolean
  withQr: boolean
}) {
  const sections = displayIngredientSections(recipe.ingredients, scale)
  const servings = recipe.servings ? Math.round(recipe.servings * scale * 10) / 10 : undefined
  const total = totalMinutes(recipe)
  const nutrition = hasNutrition(recipe.nutrition) ? recipe.nutrition : undefined

  return (
    <article className={styles.sheet}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{recipe.title}</h1>
          {recipe.description ? <p className={styles.description}>{recipe.description}</p> : null}
          <dl className={styles.facts}>
            {servings ? (
              <div>
                <dt>Serves</dt>
                <dd>{servings}</dd>
              </div>
            ) : null}
            {recipe.prepTimeMinutes ? (
              <div>
                <dt>Prep</dt>
                <dd>{formatMinutes(recipe.prepTimeMinutes)}</dd>
              </div>
            ) : null}
            {recipe.cookTimeMinutes ? (
              <div>
                <dt>Cook</dt>
                <dd>{formatMinutes(recipe.cookTimeMinutes)}</dd>
              </div>
            ) : null}
            {total ? (
              <div>
                <dt>Total</dt>
                <dd>{formatMinutes(total)}</dd>
              </div>
            ) : null}
            {recipe.cookingMethods.length ? (
              <div>
                <dt>Method</dt>
                <dd>{recipe.cookingMethods.map((m) => COOKING_METHOD_LABELS[m]).join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        {withPhoto && recipe.image ? (
          <img src={recipe.image} alt="" className={styles.photo} />
        ) : null}
      </header>

      <div className={styles.columns}>
        <section className={styles.ingredients}>
          <h2 className={styles.h2}>Ingredients</h2>
          {sections.map((section, index) => (
            <div key={section.title ?? index}>
              {section.title ? <h3 className={styles.h3}>{section.title}</h3> : null}
              <ul className={styles.ingredientList}>
                {section.items.map((item) => (
                  <li key={item.id}>
                    <span className={styles.tick} aria-hidden="true" />
                    <span>
                      {item.quantityText ? <strong>{item.quantityText} </strong> : null}
                      {item.name}
                      {item.preparation ? `, ${item.preparation}` : ''}
                      {item.optional ? ' (optional)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {recipe.equipment.length ? (
            <p className={styles.equipment}>
              <strong>Equipment:</strong> {recipe.equipment.join(', ')}
            </p>
          ) : null}
        </section>

        <section className={styles.directions}>
          <h2 className={styles.h2}>Directions</h2>
          <ol className={styles.steps}>
            {recipe.instructions.map((step) => (
              <li key={step.id}>{step.text}</li>
            ))}
          </ol>
          {recipe.notes ? (
            <div className={styles.notes}>
              <h2 className={styles.h2}>Notes</h2>
              <p>{recipe.notes}</p>
            </div>
          ) : null}
        </section>
      </div>

      <footer className={styles.foot}>
        {nutrition ? (
          <p className={styles.nutrition}>
            <strong>Per serving:</strong>{' '}
            {NUTRIENTS.filter((n) => nutrition[n.key] != null)
              .map((n) => `${n.label} ${formatNutrient(n.key, nutrition[n.key])}${n.unit === 'kcal' ? ' kcal' : ''}`)
              .join(' · ')}
            {recipe.nutritionSource === 'estimate' ? ' (estimated)' : ''}
          </p>
        ) : null}
        <div className={styles.footRow}>
          <p className={styles.source}>
            {recipe.sourceName ? `From ${recipe.sourceName}` : 'MealHelp'}
            {recipe.sourceUrl ? ` · ${recipe.sourceUrl}` : ''}
          </p>
          {withQr ? (
            <div className={styles.qr}>
              <QRCode value={buildAppUrl(`/recipes/${recipe.id}`)} size={64} />
              <small>Open in MealHelp</small>
            </div>
          ) : null}
        </div>
      </footer>
    </article>
  )
}
