import { Link } from 'react-router-dom'
import {
  CalendarPlus,
  ChefHat,
  Clock,
  Flame,
  Heart,
  Refrigerator,
  Snowflake,
  Soup,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import type { CookingMethod, Recipe } from '@/models'
import { formatMinutes } from '@/utils/date'
import { activeMinutes } from '@/services/recipeMetrics'
import { badgesFor, tilePalette } from './characteristics'
import { isImageBroken, markImageBroken, useBrokenImageVersion } from './photoAvailability'
import styles from './RecipeTile.module.css'

/** A picture for a recipe that has none: the method it uses, drawn large. */
const METHOD_ICON: Partial<Record<CookingMethod, typeof Soup>> = {
  'slow-cooker': Soup,
  'instant-pot': Soup,
  oven: Flame,
  'sheet-pan': Flame,
  grill: Flame,
  stovetop: ChefHat,
  'one-pot': Soup,
  'air-fryer': Flame,
  'no-cook': Refrigerator,
  microwave: Snowflake,
}

interface RecipeTileProps {
  recipe: Recipe
  onToggleFavorite?: (recipe: Recipe) => void
  onAddToPlan?: (recipe: Recipe) => void
}

/**
 * The card the browsing screen is built from.
 *
 * Deliberately picture-first and large: the point is to be able to skim a wall
 * of these and pick something, which small rows of text do not support. What a
 * recipe *is* — Crock-Pot, simple, great leftovers — sits on the card itself,
 * so choosing does not require opening each one in turn.
 */
export function RecipeTile({ recipe, onToggleFavorite, onAddToPlan }: RecipeTileProps) {
  const badges = badgesFor(recipe)
  const active = Math.round(activeMinutes(recipe))
  const Icon = METHOD_ICON[recipe.cookingMethods[0]] ?? UtensilsCrossed

  // A link that has rotted is treated as no picture at all, rather than left as
  // an empty frame — see photoAvailability. Reading the version subscribes this
  // tile, so it redraws the moment its own image gives up.
  void useBrokenImageVersion()
  const showPhoto = Boolean(recipe.image) && !isImageBroken(recipe.image)

  return (
    <article className={styles.tile}>
      <Link to={`/recipes/${recipe.id}`} className={styles.link}>
        <div
          className={`${styles.art} ${showPhoto ? '' : styles[`palette${tilePalette(recipe)}`]}`}
        >
          {showPhoto ? (
            <img
              src={recipe.image}
              alt=""
              loading="lazy"
              className={styles.image}
              onError={() => markImageBroken(recipe.image as string)}
            />
          ) : (
            <Icon size={44} aria-hidden="true" className={styles.icon} />
          )}

          {badges.length ? (
            <ul className={styles.badges}>
              {badges.map((badge) => (
                <li key={badge} className={styles.badge}>
                  {badge}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.body}>
          <h3 className={styles.title}>{recipe.title}</h3>
          <p className={styles.meta}>
            <span>
              <Clock size={13} aria-hidden="true" />
              {formatMinutes(active) ?? '—'}
            </span>
            {recipe.servings ? (
              <span>
                <Users size={13} aria-hidden="true" />
                {recipe.servings}
              </span>
            ) : null}
          </p>
        </div>
      </Link>

      <div className={styles.actions}>
        {onToggleFavorite ? (
          <button
            type="button"
            className={styles.action}
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
        {onAddToPlan ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => onAddToPlan(recipe)}
            aria-label={`Add ${recipe.title} to the plan`}
          >
            <CalendarPlus size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  )
}
