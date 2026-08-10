import { ArrowLeft, Pencil } from 'lucide-react'
import type { RecipeDraft } from '@/models'
import { COOKING_METHOD_LABELS } from '@/models'
import { formatMinutes } from '@/utils/date'
import type { RecipeImportResult } from '@/services/recipeImport'
import styles from './ImportPreview.module.css'

interface ImportPreviewProps {
  result: RecipeImportResult
  onBack: () => void
  onSave: (draft: RecipeDraft) => void
  onEdit: (draft: RecipeDraft) => void
}

/**
 * Nothing is saved before it has been looked at. Import is a guess — showing
 * the guess, along with what the parser was unsure about, is what keeps a bad
 * parse from quietly becoming a bad recipe.
 */
export function ImportPreview({ result, onBack, onSave, onEdit }: ImportPreviewProps) {
  const { recipe, warnings } = result

  return (
    <div className="page">
      <div className={styles.topBar}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Try again
        </button>
      </div>

      <header className="page-header">
        <div>
          <p className={styles.eyebrow}>Preview</p>
          <h1 className="page-title">{recipe.title}</h1>
          {recipe.sourceName ? (
            <p className="page-subtitle">From {recipe.sourceName}</p>
          ) : null}
        </div>
      </header>

      {warnings.length ? (
        <ul className={styles.warnings}>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {recipe.image ? <img src={recipe.image} alt="" className={styles.hero} /> : null}

      <div className={styles.facts}>
        {recipe.servings ? <span className="chip">{recipe.servings} servings</span> : null}
        {recipe.prepTimeMinutes ? (
          <span className="chip">Prep {formatMinutes(recipe.prepTimeMinutes)}</span>
        ) : null}
        {recipe.cookTimeMinutes ? (
          <span className="chip">Cook {formatMinutes(recipe.cookTimeMinutes)}</span>
        ) : null}
        {recipe.cookingMethods.map((method) => (
          <span key={method} className="chip chip-accent">
            {COOKING_METHOD_LABELS[method]}
          </span>
        ))}
      </div>

      <section>
        <h2 className="section-title">
          Ingredients
          <span className="text-sm faint">{recipe.ingredients.length} lines</span>
        </h2>
        <ul className={styles.ingredients}>
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id}>
              <span>{ingredient.originalText}</span>
              {ingredient.quantity == null ? (
                <span className={styles.unparsed}>no quantity read</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-sm faint">
          Lines are stored exactly as written. The quantities MealHelp read are used
          for the grocery list and for scaling.
        </p>
      </section>

      <section>
        <h2 className="section-title">
          Directions
          <span className="text-sm faint">{recipe.instructions.length} steps</span>
        </h2>
        <ol className={styles.steps}>
          {recipe.instructions.map((step) => (
            <li key={step.id}>
              {step.text}
              {step.timerMinutes ? (
                <span className={styles.timer}>{step.timerMinutes} min timer</span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={() => onSave(recipe)}>
          Save recipe
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onEdit(recipe)}>
          <Pencil size={16} aria-hidden="true" />
          Edit before saving
        </button>
      </div>
    </div>
  )
}
