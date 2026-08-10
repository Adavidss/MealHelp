import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { db } from '@/db/database'
import { toggleFavorite } from '@/db/recipes'
import { COOKING_METHODS, COOKING_METHOD_LABELS } from '@/models'
import type { CookingMethod, Recipe } from '@/models'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal } from '@/components/common/Modal'
import { RecipeCard } from './RecipeCard'
import {
  RECIPE_SORTS,
  RECIPE_SORT_LABELS,
  activeFilterCount,
  collectTags,
  filterRecipes,
  type RecipeFilters,
  type RecipeSort,
} from './filterRecipes'
import { StarterRecipesButton } from './StarterRecipesButton'
import styles from './RecipeLibraryPage.module.css'

const QUICK_FILTERS: Array<{ key: keyof RecipeFilters; label: string }> = [
  { key: 'favoritesOnly', label: 'Favorites' },
  { key: 'quickOnly', label: 'Quick' },
  { key: 'bulkOnly', label: 'Big batch' },
  { key: 'leftoverFriendly', label: 'Great leftovers' },
  { key: 'neverCooked', label: 'Never cooked' },
  { key: 'highlyRated', label: 'Highly rated' },
  { key: 'freezerFriendly', label: 'Freezer' },
  { key: 'mealPrepFriendly', label: 'Meal prep' },
]

export function RecipeLibraryPage() {
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], undefined)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<RecipeFilters>({})
  const [sort, setSort] = useState<RecipeSort>('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const tags = useMemo(() => collectTags(recipes ?? []), [recipes])

  const results = useMemo(
    () => filterRecipes(recipes ?? [], { ...filters, query }, sort),
    [recipes, filters, query, sort],
  )

  const filterCount = activeFilterCount(filters)

  const toggleFilter = (key: keyof RecipeFilters) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }))
  }

  const toggleMethod = (method: CookingMethod) => {
    setFilters((current) => {
      const methods = current.methods ?? []
      return {
        ...current,
        methods: methods.includes(method)
          ? methods.filter((m) => m !== method)
          : [...methods, method],
      }
    })
  }

  const toggleTag = (tag: string) => {
    setFilters((current) => {
      const selected = current.tags ?? []
      return {
        ...current,
        tags: selected.includes(tag)
          ? selected.filter((t) => t !== tag)
          : [...selected, tag],
      }
    })
  }

  if (recipes === undefined) {
    return (
      <div className="page">
        <p className="muted">Loading your recipes…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Recipes</h1>
          <p className="page-subtitle">
            {recipes.length === 0
              ? 'Your cookbook, in one format'
              : `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="row-tight">
          <Link to="/import" className="btn btn-secondary btn-sm">
            Import
          </Link>
          <Link to="/recipes/new" className="btn btn-primary btn-sm">
            <Plus size={16} aria-hidden="true" />
            Add
          </Link>
        </div>
      </header>

      {recipes.length > 0 ? (
        <>
          <div className={styles.searchRow}>
            <div className={styles.searchField}>
              <Search size={17} aria-hidden="true" className={styles.searchIcon} />
              <input
                type="search"
                className={`input ${styles.search}`}
                placeholder="Search recipes, ingredients, tags…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search recipes"
              />
              {query ? (
                <button
                  type="button"
                  className={styles.clear}
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={() => setFiltersOpen(true)}
              aria-label={`Filters${filterCount ? `, ${filterCount} active` : ''}`}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              {filterCount ? <span className={styles.badge}>{filterCount}</span> : null}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
              aria-label={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            >
              {view === 'grid' ? (
                <List size={18} aria-hidden="true" />
              ) : (
                <LayoutGrid size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          <div className={styles.chipRow}>
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="chip chip-button"
                aria-pressed={Boolean(filters[filter.key])}
                onClick={() => toggleFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className={styles.resultsBar}>
            <p className="text-sm muted">
              {results.length} of {recipes.length}
            </p>
            <label className={styles.sortLabel}>
              <span className="sr-only">Sort by</span>
              <select
                className={`select ${styles.sort}`}
                value={sort}
                onChange={(event) => setSort(event.target.value as RecipeSort)}
              >
                {RECIPE_SORTS.map((option) => (
                  <option key={option} value={option}>
                    {RECIPE_SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {results.length === 0 ? (
            <EmptyState
              title="Nothing matched"
              description="Try a different word, or clear the filters."
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setQuery('')
                  setFilters({})
                }}
              >
                Clear search and filters
              </button>
            </EmptyState>
          ) : (
            <ul className={view === 'grid' ? styles.grid : styles.list}>
              {results.map((recipe: Recipe) => (
                <li key={recipe.id}>
                  <RecipeCard
                    recipe={recipe}
                    view={view}
                    onToggleFavorite={(r) => void toggleFavorite(r.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <EmptyState
          title="Save your first recipe"
          description="Import one from a website, add your own, or start from a handful MealHelp ships with."
        >
          <Link to="/import" className="btn btn-primary">
            Import recipe
          </Link>
          <Link to="/recipes/new" className="btn btn-secondary">
            Add manually
          </Link>
          <StarterRecipesButton />
        </EmptyState>
      )}

      <Modal
        open={filtersOpen}
        title="Filters"
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setFilters({})}
            >
              Clear all
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setFiltersOpen(false)}
            >
              Show {results.length}
            </button>
          </>
        }
      >
        <div className="field">
          <span className="field-label">How it's cooked</span>
          <div className="row-tight">
            {COOKING_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                className="chip chip-button"
                aria-pressed={filters.methods?.includes(method) ?? false}
                onClick={() => toggleMethod(method)}
              >
                {COOKING_METHOD_LABELS[method]}
              </button>
            ))}
          </div>
        </div>

        {tags.length ? (
          <div className="field">
            <span className="field-label">Tags</span>
            <div className="row-tight">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip chip-button"
                  aria-pressed={filters.tags?.includes(tag) ?? false}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="field">
          <span className="field-label">Good for</span>
          <div className="row-tight">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="chip chip-button"
                aria-pressed={Boolean(filters[filter.key])}
                onClick={() => toggleFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
