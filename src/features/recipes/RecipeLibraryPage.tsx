import { useEffect, useMemo, useState } from 'react'
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
  Dices,
  SlidersHorizontal,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { useQuickPlan } from '@/app/QuickPlanContext'
import { db } from '@/db/database'
import { pantryKeySet } from '@/db/pantry'
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
import { BrowseRow } from './BrowseRow'
import { buildBrowseSections, sectionTotal } from './browseSections'
import { METHOD_CHARACTERISTIC_IDS, filterByCharacteristics } from './characteristics'
import { FilterRail } from './FilterRail'
import { OnlineIdeas } from '@/features/discover/OnlineIdeas'
import { SurpriseSheet } from '@/features/discover/SurpriseSheet'
import { similarQuery } from '@/services/recipeDiscovery'
import { applyMood } from './moods'
import { partitionByPhoto, useBrokenImageVersion } from './photoAvailability'
import { MealCard } from '@/components/meal/MealCard'
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

/** Roughly two phone screens of cards — enough to scroll into, not enough to stall. */
const PAGE_SIZE = 60

/** The methods with no chip of their own on the rail. */
const SHEET_METHODS = COOKING_METHODS.filter(
  (method) => !METHOD_CHARACTERISTIC_IDS.has(method),
)

export function RecipeLibraryPage() {
  const { settings, update } = useSettings()
  const { planMeal } = useQuickPlan()
  const pantryKeys = useLiveQuery(() => pantryKeySet(), [], new Set<string>())
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], undefined)
  const [query, setQuery] = useState('')
  const [characteristics, setCharacteristics] = useState<string[]>([])
  const [filters, setFilters] = useState<RecipeFilters>({})
  const [sort, setSort] = useState<RecipeSort>('recent')
  const [view, setView] = useState<'gallery' | 'list'>('gallery')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [mood, setMood] = useState<string>()
  /** Which favourite the "more like this" shelf is currently asking about. */
  const [favoriteIdea, setFavoriteIdea] = useState(0)
  const [surprising, setSurprising] = useState(false)
  const [tab, setTab] = useSectionTab<'all' | 'favorites' | 'collections' | 'make'>(
    ['all', 'favorites', 'collections', 'make'],
    'all',
  )

  const favorites = useMemo(
    () => (recipes ?? []).filter((recipe) => recipe.favorite),
    [recipes],
  )

  const tags = useMemo(() => collectTags(recipes ?? []), [recipes])

  // The search and the method/tag filters narrow first; the characteristic
  // counts are then taken against what is left, so they describe what tapping
  // one would actually do right now rather than the library as a whole.
  const searched = useMemo(
    () => filterRecipes(recipes ?? [], { ...filters, query }, sort),
    [recipes, filters, query, sort],
  )

  const inMood = useMemo(
    () => applyMood(searched, mood, { pantryKeys }),
    [searched, mood, pantryKeys],
  )

  const results = useMemo(
    () => filterByCharacteristics(inMood, characteristics),
    [inMood, characteristics],
  )

  // Re-runs the split when an image turns out to be broken, so a rotted link
  // moves itself out of the picture wall instead of leaving a hole in it.
  const brokenVersion = useBrokenImageVersion()
  const { withPhotos, withoutPhotos } = useMemo(
    () => partitionByPhoto(results),
    [results, brokenVersion],
  )
  const showAll = settings.showRecipesWithoutPhotos

  /*
   * A wall of picture cards is the point of this screen, and every one of them
   * is an image the phone has to lay out and decode. A library of a dozen or
   * fifty never notices; somebody who imports enthusiastically for a year
   * would scroll five hundred, re-rendered on every keystroke of a search. So
   * the wall stops at a screenful and says how many more there are.
   */
  const [shown, setShown] = useState(PAGE_SIZE)
  // Any change to what is being asked for starts the count again.
  useEffect(() => setShown(PAGE_SIZE), [query, mood, characteristics, filters, sort, tab])

  const visiblePhotos = withPhotos.slice(0, shown)
  const hiddenByPaging = withPhotos.length - visiblePhotos.length

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
        { id: 'favorites', label: 'Favourites', count: favorites.length || undefined },
        { id: 'collections', label: 'Collections' },
        { id: 'make', label: 'What can I make?' },
      ]}
      value={tab}
      onChange={setTab}
      label="Recipe views"
    />
  )

  if (tab !== 'all') {
    const heading =
      tab === 'collections'
        ? 'Collections'
        : tab === 'favorites'
          ? 'Favourites'
          : 'What can I make?'

    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">{heading}</h1>
            {tab === 'favorites' ? (
              <p className="page-subtitle">
                The ones you keep coming back to
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </header>
        <div className={styles.tabRow}>{tabs}</div>

        {tab === 'favorites' ? (
          favorites.length ? (
            <>
              <ul className={styles.gallery}>
                {favorites.map((recipe: Recipe) => (
                  <li key={recipe.id}>
                    <MealCard
                      recipe={recipe}
                      to={`/recipes/${recipe.id}`}
                      onToggleFavorite={(entry) => void toggleFavorite(entry.id)}
                      onPlan={planMeal}
                    />
                  </li>
                ))}
              </ul>

              {/* Favourites say more about what you like than any filter can,
                  so this is the best place in the app to ask for more of it. */}
              <OnlineIdeas
                title="More like your favourites"
                blurb={`Recipes for ${similarQuery(favorites[0].title)}, from the free recipe databases`}
                query={similarQuery(favorites[favoriteIdea % favorites.length].title)}
                onAnother={() => setFavoriteIdea((current) => current + 1)}
                excludeTitles={(recipes ?? []).map((entry) => entry.title)}
              />
            </>
          ) : (
            <EmptyState
              title="Nothing favourited yet"
              description="Tap the heart on any recipe and it lands here — the shortlist you actually cook from."
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTab('all')}
              >
                Browse your recipes
              </button>
            </EmptyState>
          )
        ) : tab === 'collections' ? (
          <CollectionsView />
        ) : (
          <WhatCanIMakeView />
        )}
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
        <div className="row-tight">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSurprising(true)}
            disabled={results.length === 0}
            aria-label="Surprise me"
          >
            <Dices size={16} aria-hidden="true" />
            <span className="hide-narrow">Surprise me</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setAddOpen(true)}
            aria-label="Add a recipe"
          >
            <Plus size={16} aria-hidden="true" />
            <span className="hide-narrow">Add</span>
          </button>
        </div>
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

          {/*
            The count sits with the search rather than on a bar of its own: on
            a phone that bar cost 46px of a screen where the controls already
            took up nearly half of it before a single recipe appeared.
          */}
          {results.length !== recipes.length ? (
            <p className={styles.resultCount}>
              {results.length} of {recipes.length} recipes
            </p>
          ) : null}

          <FilterRail
            mood={mood}
            onMoodChange={setMood}
            characteristics={characteristics}
            onCharacteristicsChange={setCharacteristics}
            moodRecipes={searched}
            characteristicRecipes={inMood}
            pantryKeys={pantryKeys}
          />


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
                  setMood(undefined)
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
                  onAddToPlan={planMeal}
                />
              ))}

              {shelves.length ? (
                <h2 className={styles.everythingHeading}>Everything</h2>
              ) : null}

              {visiblePhotos.length ? (
                <ul className={styles.gallery}>
                  {visiblePhotos.map((recipe: Recipe) => (
                    <li key={recipe.id}>
                      <MealCard
                        recipe={recipe}
                        to={`/recipes/${recipe.id}`}
                        onToggleFavorite={(r) => void toggleFavorite(r.id)}
                        onPlan={planMeal}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {hiddenByPaging > 0 ? (
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.showMore}`}
                  onClick={() => setShown((count) => count + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, hiddenByPaging)} more
                  <span className={styles.showMoreCount}>
                    {hiddenByPaging} still to see
                  </span>
                </button>
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
                          <MealCard
                            recipe={recipe}
                            to={`/recipes/${recipe.id}`}
                            onToggleFavorite={(r) => void toggleFavorite(r.id)}
                            onPlan={planMeal}
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
              {results.slice(0, shown).map((recipe: Recipe) => (
                <li key={recipe.id}>
                  <MealCard
                    recipe={recipe}
                    size="compact"
                    to={`/recipes/${recipe.id}`}
                    onToggleFavorite={(r) => void toggleFavorite(r.id)}
                    onPlan={planMeal}
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
          <span className="field-label">Order</span>
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

        {/*
          Only the methods the rail does not already carry.
          Six of these — Crock-Pot, Instant Pot, one pot, sheet pan, air fryer,
          no cooking — are chips on the rail outside, filtering on exactly the
          same field. Offered in both places they were the same filter twice
          over, under two names in the slow cooker's case, each with its own
          state: turn on "Crock-Pot" out there and "Slow Cooker" in here and
          nothing happens the second time, except the sheet claiming a filter
          is active.
        */}
        <div className="field">
          <span className="field-label">How it's cooked</span>
          <div className="row-tight">
            {SHEET_METHODS.map((method) => (
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

      <SurpriseSheet
        open={surprising}
        // Whatever the search, mood and filters have left on screen: a
        // surprise drawn from a list you narrowed is still a surprise.
        pool={results}
        poolLabel={
          results.length === recipes.length ? 'your recipes' : 'what you filtered to'
        }
        onClose={() => setSurprising(false)}
      />
    </div>
  )
}
