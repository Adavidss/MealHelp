import { ChevronRight } from 'lucide-react'
import type { Recipe } from '@/models'
import { RecipeTile } from './RecipeTile'
import type { BrowseSection } from './browseSections'
import styles from './BrowseRow.module.css'

interface BrowseRowProps {
  section: BrowseSection
  /** How many there are in total, when more than the row shows. */
  total: number
  onSeeAll: () => void
  onToggleFavorite?: (recipe: Recipe) => void
  onAddToPlan?: (recipe: Recipe) => void
}

/**
 * One shelf: a heading and a row of tiles you push sideways.
 *
 * Horizontal rather than a grid on purpose — a shelf is a sample, and stacking
 * three full grids would push the rest of the library off the bottom of the
 * screen. "See all" turns the shelf into the ordinary filtered gallery.
 */
export function BrowseRow({
  section,
  total,
  onSeeAll,
  onToggleFavorite,
  onAddToPlan,
}: BrowseRowProps) {
  const hasMore = total > section.recipes.length

  return (
    <section className={styles.row} aria-labelledby={`shelf-${section.id}`}>
      <header className={styles.header}>
        <div className={styles.headingText}>
          <h2 id={`shelf-${section.id}`} className={styles.title}>
            {section.title}
          </h2>
          <p className={styles.blurb}>{section.blurb}</p>
        </div>
        <button type="button" className={styles.seeAll} onClick={onSeeAll}>
          {hasMore ? `All ${total}` : 'See all'}
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </header>

      <ul className={styles.scroller}>
        {section.recipes.map((recipe) => (
          <li key={recipe.id} className={styles.item}>
            <RecipeTile
              recipe={recipe}
              onToggleFavorite={onToggleFavorite}
              onAddToPlan={onAddToPlan}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
