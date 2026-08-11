import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { toggleFavorite } from '@/db/recipes'
import { COOKING_METHODS, COOKING_METHOD_LABELS } from '@/models'
import type { CookingMethod, Recipe } from '@/models'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal } from '@/components/common/Modal'
import { AddToPlanDialog } from '@/features/planner/AddToPlanDialog'
import { CharacteristicFilters } from './CharacteristicFilters'
import { filterByCharacteristics } from './characteristics'
import { partitionByPhoto, useBrokenImageVersion } from './photoAvailability'
import { RecipeCard } from './RecipeCard'
import { RecipeTile } from './RecipeTile'
import {
  RECIPE_SORTS,
  RECIPE_SORT_LABELS,
  collectTags,
  filterRecipes,
  type RecipeFilters,
  type RecipeSort,
} from './filterRecipes'
import { StarterRecipesButton } from './StarterRecipesButton'
import styles from './RecipeLibraryPage.module.css'

export function RecipeLibraryPage() {
  const { settings, update } = useSettings()
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], undefined)
  const [query, setQuery] = useState('')
  const [characteristics, setCharacteristics] = useState<string[]>([])
  const [filters, setFilters] = useState<RecipeFilters>({})
  const [sort, setSort] = useState<RecipeSort>('recent')
  const [view, setView] = useState<'gallery' | 'list'>('gallery')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [planFor, setPlanFor] = useState<Recipe>()

  const tags = useMemo(() => collectTags(recipes ?? []), [recipes])

  // The search and the method/tag filters narrow first; the characteristic
  // counts are then taken against what is left, so they describe what tapping
  // one would actually do right now rather than the library as a whole.
  const searched = useMemo(
    () => filterRecipes(recipes ?? [], { ...filters, query }, sort),
    [recipes, filters, query, sort],
  )

  const results = useMemo(
    () => filterByCharacteristics(searched, characteristics),
    [searched, characteristics],
  )

  // Re-runs the split when an image turns out to be broken, so a rotted link
  // moves itself out of the picture wall instead of leaving a hole in it.
  const brokenVersion = useBrokenImageVersion()
  const { withPhotos, withoutPhotos } = useMemo(
    () => partitionByPhoto(results),
    [results, brokenVersion],
  )
  const showAll = settings.showRecipesWithoutPhotos

  const methodCount = filters.methods?.length ?? 0
  const tagCount = filters.tags?.length ?? 0
  const advancedCount = methodCount + tagCount

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
          <Link to="/discover" className="btn btn-secondary btn-sm">
            Discover
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
              aria-label={`More filters${advancedCount ? `, ${advancedCount} active` : ''}`}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              {advancedCount ? (
                <span className={styles.badge}>{advancedCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={() => setView(view === 'gallery' ? 'list' : 'gallery')}
              aria-label={
                view === 'gallery' ? 'Switch to compact list' : 'Switch to picture view'
              }
            >
              {view === 'gallery' ? (
                <List size={18} aria-hidden="true" />
              ) : (
                <LayoutGrid size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          <CharacteristicFilters
            recipes={searched}
            selected={characteristics}
            onChange={setCharacteristics}
          />

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
              description="Try a different word, or turn some filters off."
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setQuery('')
                  setFilters({})
                  setCharacteristics([])
                }}
              >
                Clear everything
              </button>
            </EmptyState>
          ) : view === 'gallery' ? (
            <>
              {withPhotos.length ? (
                <ul className={styles.gallery}>
                  {withPhotos.map((recipe: Recipe) => (
                    <li key={recipe.id}>
                      <RecipeTile
                        recipe={recipe}
                        onToggleFavorite={(r) => void toggleFavorite(r.id)}
                        onAddToPlan={setPlanFor}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {withoutPhotos.length ? (
                <section className={styles.withoutPhotos}>
                  <button
                    type="button"
                    className={styles.sectionToggle}
                    aria-expanded={showAll}
                    onClick={() =>
                      void update({ showRecipesWithoutPhotos: !showAll })
                    }
                  >
                    <span>
                      {withoutPhotos.length} without a photo
                      {withPhotos.length === 0 ? ' — everything matching' : ''}
                    </span>
                    {showAll ? (
                      <ChevronUp size={17} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={17} aria-hidden="true" />
                    )}
                  </button>

                  {showAll ? (
                    <ul className={styles.gallery}>
                      {withoutPhotos.map((recipe: Recipe) => (
                        <li key={recipe.id}>
                          <RecipeTile
                            recipe={recipe}
                            onToggleFavorite={(r) => void toggleFavorite(r.id)}
                            onAddToPlan={setPlanFor}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <ul className={styles.list}>
              {results.map((recipe: Recipe) => (
                <li key={recipe.id}>
                  <RecipeCard
                    recipe={recipe}
                    view="list"
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
          description="Find one online, import from a link, add your own, or start from a handful MealHelp ships with."
        >
          <Link to="/discover" className="btn btn-primary">
            Discover recipes
          </Link>
          <Link to="/import" className="btn btn-secondary">
            Import from a link
          </Link>
          <Link to="/recipes/new" className="btn btn-secondary">
            Add manually
          </Link>
          <StarterRecipesButton />
        </EmptyState>
      )}

      <Modal
        open={filtersOpen}
        title="More filters"
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setFilters({})}
            >
              Clear
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
            <span className="field-label">Your tags</span>
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
      </Modal>

      {planFor ? (
        <AddToPlanDialog
          open
          recipe={planFor}
          onClose={() => setPlanFor(undefined)}
        />
      ) : null}
    </div>
  )
}
