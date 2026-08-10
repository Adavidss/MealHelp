import { Link } from 'react-router-dom'
import { Clock, Heart, Users, UtensilsCrossed } from 'lucide-react'
import type { Recipe } from '@/models'
import { COOKING_METHOD_LABELS } from '@/models'
import { formatMinutes } from '@/utils/date'
import { activeMinutes, leftoverScore } from '@/services/recipeMetrics'
import styles from './RecipeCard.module.css'

interface RecipeCardProps {
  recipe: Recipe
  view?: 'grid' | 'list'
  onToggleFavorite?: (recipe: Recipe) => void
  /** Replaces the link with a selection action, used by pickers. */
  onSelect?: (recipe: Recipe) => void
  footer?: React.ReactNode
}

export function RecipeCard({
  recipe,
  view = 'grid',
  onToggleFavorite,
  onSelect,
  footer,
}: RecipeCardProps) {
  const active = Math.round(activeMinutes(recipe))
  const leftovers = leftoverScore(recipe)
  const method = recipe.cookingMethods[0]

  const body = (
    <>
      <div className={styles.media}>
        {recipe.image ? (
          <img src={recipe.image} alt="" loading="lazy" className={styles.image} />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">
            <UtensilsCrossed size={view === 'grid' ? 28 : 20} />
          </div>
        )}
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{recipe.title}</h3>
        <div className={styles.meta}>
          {method ? (
            <span className="chip chip-accent">{COOKING_METHOD_LABELS[method]}</span>
          ) : null}
          {active ? (
            <span className={styles.metaItem}>
              <Clock size={13} aria-hidden="true" />
              {formatMinutes(active)} prep
            </span>
          ) : null}
          {recipe.servings ? (
            <span className={styles.metaItem}>
              <Users size={13} aria-hidden="true" />
              {recipe.servings}
            </span>
          ) : null}
        </div>
        {leftovers >= 4 ? (
          <p className={styles.note}>Great leftovers</p>
        ) : null}
        {footer}
      </div>
    </>
  )

  return (
    <article
      className={`${styles.card} ${view === 'list' ? styles.list : styles.grid}`}
    >
      {onSelect ? (
        <button type="button" className={styles.link} onClick={() => onSelect(recipe)}>
          {body}
        </button>
      ) : (
        <Link to={`/recipes/${recipe.id}`} className={styles.link}>
          {body}
        </Link>
      )}

      {onToggleFavorite ? (
        <button
          type="button"
          className={styles.favorite}
          onClick={() => onToggleFavorite(recipe)}
          aria-pressed={recipe.favorite}
          aria-label={
            recipe.favorite
              ? `Remove ${recipe.title} from favorites`
              : `Add ${recipe.title} to favorites`
          }
        >
          <Heart
            size={17}
            aria-hidden="true"
            className={recipe.favorite ? styles.favoriteOn : undefined}
          />
        </button>
      ) : null}
    </article>
  )
}
