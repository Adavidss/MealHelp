import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Globe,
  LayoutGrid,
  Link2,
  List,
  PencilLine,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { db } from '@/db/database'
import { toggleFavorite } from '@/db/recipes'
import { COOKING_METHODS, COOKING_METHOD_LABELS } from '@/models'
import type { CookingMethod, Recipe } from '@/models'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal } from '@/components/common/Modal'
import { SearchField } from '@/components/common/SearchField'
import { SegmentedTabs } from '@/components/common/SegmentedTabs'
import { useSectionTab } from '@/app/useSectionTab'
import { CollectionsView } from '@/features/collections/CollectionsPage'
import { WhatCanIMakeView } from './WhatCanIMakePage'
import { AddToPlanDialog } from '@/features/planner/AddToPlanDialog'
import { BrowseRow } from './BrowseRow'
import { buildBrowseSections, sectionTotal } from './browseSections'
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
  const [addOpen, setAddOpen] = useState(false)
  const [planFor, setPlanFor] = useState<Recipe>()
  const [tab, setTab] = useSectionTab<'all' | 'collections' | 'make'>(
    ['all', 'collections', 'make'],
    'all',
  )

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

  /*
   * Shelves are for browsing, and browsing is what you are doing when you have
   * not asked for anything specific yet. The moment there is a search or a
   * filter the question has become "show me these", so they step aside.
   */
  const isBrowsing =
    !query.trim() && characteristics.length === 0 && advancedCount === 0

  const shelves = useMemo(
    () => (isBrowsing && view === 'gallery' ? buildBrowseSections(results) : []),
    [isBrowsing, view, results],
  )

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

  const addMenu = (
    <Modal open={addOpen} title="Add a recipe" onClose={() => setAddOpen(false)}>
      <div className={styles.addMenu}>
        <Link to="/browser" className={styles.addOption} onClick={() => setAddOpen(false)}>
          <Globe size={20} aria-hidden="true" />
          <span>
            <strong>Find it online</strong>
            <small>Search the web or the recipe databases, then tap Add</small>
          </span>
        </Link>
        <Link to="/import" className={styles.addOption} onClick={() => setAddOpen(false)}>
          <Link2 size={20} aria-hidden="true" />
          <span>
            <strong>Import from a link</strong>
            <small>Paste a recipe page's address</small>
          </span>
        </Link>
        <Link
          to="/recipes/new"
          state={{ paste: true }}
          className={styles.addOption}
          onClick={() => setAddOpen(false)}
        >
          <ClipboardPaste size={20} aria-hidden="true" />
          <span>
            <strong>Paste recipe text</strong>
            <small>From a message or a note — MealHelp fills the form</small>
          </span>
        </Link>
        <Link to="/recipes/new" className={styles.addOption} onClick={() => setAddOpen(false)}>
          <PencilLine size={20} aria-hidden="true" />
          <span>
            <strong>Type it in</strong>
            <small>A blank recipe</small>
          </span>
        </Link>
        <div className={styles.addStarter}>
          <StarterRecipesButton />
        </div>
      </div>
    </Modal>
  )

  const tabs = (
    <SegmentedTabs
      tabs={[
        { id: 'all', label: 'All', count: recipes.length || undefined },
        { id: 'collections', label: 'Collections' },
        { id: 'make', label: 'What can I make?' },
      ]}
      value={tab}
      onChange={setTab}
      label="Recipe views"
    />
  )

  if (tab !== 'all') {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">{tab === 'collections' ? 'Collections' : 'What can I make?'}</h1>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </header>
        <div className={styles.tabRow}>{tabs}</div>
        {tab === 'collections' ? <CollectionsView /> : <WhatCanIMakeView />}
        {addMenu}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Recipes</h1>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </header>

      <div className={styles.tabRow}>{tabs}</div>

      {recipes.length > 0 ? (
        <>
          <div className={styles.searchRow}>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search recipes, ingredients, tags…"
              label="Search recipes"
            />
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
            compact
          />

          <div className={styles.resultsBar}>
            <p className="text-sm muted">
              {results.length === recipes.length
                ? `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`
                : `${results.length} of ${recipes.length}`}
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
              {shelves.map((shelf) => (
                <BrowseRow
                  key={shelf.id}
                  section={shelf}
                  total={sectionTotal(results, shelf)}
                  onSeeAll={() => setCharacteristics(shelf.characteristics)}
                  onToggleFavorite={(r) => void toggleFavorite(r.id)}
                  onAddToPlan={setPlanFor}
                />
              ))}

              {shelves.length ? (
                <h2 className={styles.everythingHeading}>Everything</h2>
              ) : null}

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
          <Link to="/browser" className="btn btn-primary">
            Find recipes online
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

      {addMenu}

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
