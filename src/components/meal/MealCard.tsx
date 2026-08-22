import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ChefHat,
  Clock,
  Flame,
  Heart,
  Plus,
  Refrigerator,
  Snowflake,
  Soup,
  UtensilsCrossed,
} from 'lucide-react'
import type { CookingMethod, Recipe } from '@/models'
import { activeMinutes } from '@/services/recipeMetrics'
import { mealBadges } from '@/features/recipes/mealBadges'
import { markImageBroken, useBrokenImageVersion } from '@/features/recipes/photoAvailability'
import { formatMinutes } from '@/utils/date'
import { useServingCost } from './useServingCost'
import { mealArt } from './mealArtwork'
import styles from './MealCard.module.css'

/** The drawing that stands in for a photograph: the method, large. */
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

/**
 * How much room the card has, which is the only thing that changes between
 * them — the picture, the name, the time, the cost and two or three badges are
 * the same everywhere, so a meal looks like itself wherever it turns up.
 *
 * hero    — tonight, one to a screen, text over the photograph
 * feed    — the browsing grid and the discovery rows
 * slot    — a day of the week
 * compact — a row in a picker, picture still first but small
 */
export type MealCardSize = 'hero' | 'feed' | 'slot' | 'compact'

export interface MealCardProps {
  recipe: Recipe
  size?: MealCardSize
  /** Where tapping the card goes. Omit to make the card inert (a picker handles it). */
  to?: string
  onSelect?: (recipe: Recipe) => void
  /** The one-tap "put this on a day" affordance. */
  onPlan?: (recipe: Recipe) => void
  onToggleFavorite?: (recipe: Recipe) => void
  /** Small line above the title: "Tonight", "Wednesday", "↻ From Monday". */
  eyebrow?: ReactNode
  /** Anything the caller wants in the corner of the picture. */
  corner?: ReactNode
  /** Extra content under the meta line — servings, a leftover link, actions. */
  children?: ReactNode
  className?: string
}

/**
 * One meal, as a picture you can choose from.
 *
 * Everything about this is in service of skimming: the photograph is the card,
 * the words sit on or under it in a fixed order, and what a recipe *is* — 20
 * min, One pan, Great leftovers — is on the face so that choosing between ten
 * of them does not mean opening ten of them.
 */
export function MealCard({
  recipe,
  size = 'feed',
  to,
  onSelect,
  onPlan,
  onToggleFavorite,
  eyebrow,
  corner,
  children,
  className,
}: MealCardProps) {
  // Subscribing to the broken-image tally makes a card redraw as generated
  // artwork the moment its own photograph gives up — see photoAvailability.
  void useBrokenImageVersion()
  const art = mealArt(recipe)
  const badges = mealBadges(recipe, size === 'compact' || size === 'slot' ? 2 : 3)
  const Icon = METHOD_ICON[art.method as CookingMethod] ?? UtensilsCrossed
  const minutes = formatMinutes(Math.round(activeMinutes(recipe)))
  const perServing = useServingCost(recipe)

  const picture = (
    <div
      className={`${styles.art} ${art.kind === 'photo' ? '' : styles[`palette${art.palette}`]}`}
    >
      {art.kind === 'photo' ? (
        <img
          src={art.src}
          alt=""
          loading="lazy"
          className={styles.image}
          onError={() => markImageBroken(art.src as string)}
        />
      ) : (
        <Icon size={size === 'compact' ? 26 : size === 'hero' ? 64 : 40} aria-hidden="true" className={styles.icon} />
      )}
      {corner ? <div className={styles.corner}>{corner}</div> : null}
      {size === 'hero' ? <div className={styles.scrim} aria-hidden="true" /> : null}
    </div>
  )

  const text = (
    <div className={styles.body}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h3 className={styles.title}>{recipe.title}</h3>
      <p className={styles.meta}>
        <span className={styles.metaItem}>
          <Clock size={13} aria-hidden="true" />
          {minutes ?? '—'}
        </span>
        {/*
          What it costs to cook, per serving — the figure worth comparing two
          recipes on. Falls back to the recipe's own $/$$/$$$ when the
          ingredients are not ones the price table knows.
        */}
        {perServing != null ? (
          <span className={styles.cost} title="Estimated cost a serving">
            {perServing} a serving
          </span>
        ) : recipe.costTier ? (
          <span className={styles.cost} title="Roughly what it costs">
            {recipe.costTier}
          </span>
        ) : null}
      </p>
      {badges.length ? (
        <ul className={styles.badges}>
          {badges.map((badge) => (
            <li key={badge.id} className={`${styles.badge} ${styles[badge.tone]}`}>
              {badge.label}
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  )

  const inner = (
    <>
      {picture}
      {text}
    </>
  )

  return (
    <article className={`${styles.card} ${styles[size]} ${className ?? ''}`}>
      {to ? (
        <Link to={to} className={styles.face}>
          {inner}
        </Link>
      ) : onSelect ? (
        <button type="button" className={styles.face} onClick={() => onSelect(recipe)}>
          {inner}
        </button>
      ) : (
        <div className={styles.face}>{inner}</div>
      )}

      {onToggleFavorite ? (
        <button
          type="button"
          className={`${styles.action} ${onPlan ? styles.actionSecond : ''}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleFavorite(recipe)
          }}
          aria-pressed={recipe.favorite}
          aria-label={
            recipe.favorite
              ? `Remove ${recipe.title} from favourites`
              : `Add ${recipe.title} to favourites`
          }
        >
          <Heart
            size={16}
            aria-hidden="true"
            className={recipe.favorite ? styles.favoriteOn : undefined}
          />
        </button>
      ) : null}

      {onPlan ? (
        <button
          type="button"
          className={`${styles.action} ${styles.plan}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onPlan(recipe)
          }}
          aria-label={`Put ${recipe.title} on a day`}
          title="Put this on a day"
        >
          <Plus size={17} aria-hidden="true" />
        </button>
      ) : null}
    </article>
  )
}
