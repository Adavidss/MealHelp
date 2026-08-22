import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { Recipe } from '@/models'
import { displayIngredientSections } from '@/features/recipes/ingredientDisplay'
import { formatMinutes } from '@/utils/date'
import { activeMinutes } from '@/services/recipeMetrics'
import styles from './RecipePeek.module.css'

interface RecipePeekProps {
  recipe: Recipe
  /** What the plan intends to cook, which is often not the recipe's own yield. */
  servings?: number
}

/**
 * The recipe itself, inside the plan.
 *
 * Accepting a week means committing to cook seven things, and deciding that
 * from seven titles is guesswork — "Sheet Pan Chicken" could be twenty minutes
 * or an hour, four ingredients or fifteen. Opening each one in turn loses the
 * plan, so the whole recipe is here: scaled to the servings the plan actually
 * intends, which is the number that decides whether it is worth cooking.
 */
export function RecipePeek({ recipe, servings }: RecipePeekProps) {
  // The planner cooks a bigger batch to cover leftover nights, so the
  // quantities shown are the ones you would actually be shopping for.
  const scale = servings && recipe.servings ? servings / recipe.servings : 1
  const sections = displayIngredientSections(recipe.ingredients, scale)

  return (
    <div className={styles.peek}>
      <p className={styles.facts}>
        {formatMinutes(Math.round(activeMinutes(recipe)))} hands-on
        {recipe.cookTimeMinutes ? ` · ${formatMinutes(recipe.cookTimeMinutes)} cooking` : ''}
        {servings ? ` · makes ${servings}` : ''}
        {scale !== 1 ? (
          <span className={styles.scaled}> (scaled from {recipe.servings})</span>
        ) : null}
      </p>

      <div className={styles.columns}>
        <div>
          <h4 className={styles.heading}>Ingredients</h4>
          {sections.map((section, index) => (
            <ul key={section.title ?? index} className={styles.ingredients}>
              {section.title ? (
                <li className={styles.sectionTitle}>{section.title}</li>
              ) : null}
              {section.items.map((item) => (
                <li key={item.id}>
                  {item.quantityText ? <strong>{item.quantityText} </strong> : null}
                  {item.name}
                </li>
              ))}
            </ul>
          ))}
        </div>

        <div>
          <h4 className={styles.heading}>Directions</h4>
          <ol className={styles.steps}>
            {recipe.instructions.map((step) => (
              <li key={step.id}>{step.text}</li>
            ))}
          </ol>
        </div>
      </div>

      <Link to={`/recipes/${recipe.id}`} className={styles.open}>
        Open the full recipe
        <ExternalLink size={13} aria-hidden="true" />
      </Link>
    </div>
  )
}
