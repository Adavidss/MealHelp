import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { db } from '@/db/database'
import type { MealType, Recipe } from '@/models'
import { filterRecipes } from '@/features/recipes/filterRecipes'
import { rankRecipes } from '@/services/recommendationEngine'
import { RecipeCard } from '@/features/recipes/RecipeCard'
import { EmptyState } from '@/components/common/EmptyState'
import styles from './RecipePicker.module.css'

interface RecipePickerProps {
  onSelect: (recipe: Recipe) => void
  mealType?: MealType
  /** Recipes already used this week, shown but pushed down the list. */
  excludeIds?: string[]
}

/**
 * The picker leads with suggestions rather than an alphabetical wall: the point
 * of MealHelp is that it has an opinion about what to cook.
 */
export function RecipePicker({ onSelect, mealType, excludeIds = [] }: RecipePickerProps) {
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const library = recipes ?? []
    if (query.trim()) return filterRecipes(library, { query }, 'recent')

    const excluded = new Set(excludeIds)
    const ranked = rankRecipes(library, { mealType, preferLeftovers: true })
    return ranked
      .map((scored) => scored.recipe)
      .sort((a, b) => Number(excluded.has(a.id)) - Number(excluded.has(b.id)))
  }, [recipes, query, mealType, excludeIds])

  if (!recipes?.length) {
    return (
      <EmptyState
        title="No recipes yet"
        description="Add or import a recipe first, then it can go on the plan."
      />
    )
  }

  return (
    <div>
      <div className={styles.searchField}>
        <Search size={16} aria-hidden="true" className={styles.searchIcon} />
        <input
          type="search"
          className={`input ${styles.search}`}
          placeholder="Search your recipes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search recipes"
        />
      </div>

      {results.length === 0 ? (
        <p className="muted text-sm">Nothing matched "{query}".</p>
      ) : (
        <ul className={styles.list}>
          {results.slice(0, 40).map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} view="list" onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
