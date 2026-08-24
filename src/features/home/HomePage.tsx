import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChefHat,
  Compass,
  Dices,
  Refrigerator,
  Settings as SettingsIcon,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import { useQuickPlan } from '@/app/QuickPlanContext'
import { db } from '@/db/database'
import { pantryKeySet } from '@/db/pantry'
import type { CookEvent, PlannedMeal, Recipe } from '@/models'
import { MealCard } from '@/components/meal/MealCard'
import { EmptyState } from '@/components/common/EmptyState'
import { MoodChips } from '@/features/recipes/MoodChips'
import { applyMood, moodById } from '@/features/recipes/moods'
import { OnlineIdeas } from '@/features/discover/OnlineIdeas'
import { SurpriseSheet } from '@/features/discover/SurpriseSheet'
import { moodQuery } from '@/services/recipeDiscovery'
import { StarterRecipesButton } from '@/features/recipes/StarterRecipesButton'
import { mealTitle } from '@/features/planner/mealTitle'
import { addDays, relativeDayLabel, startOfWeek, todayISO } from '@/utils/date'
import { SyncNotice } from '@/features/sharing/SyncNotice'
import styles from './HomePage.module.css'

/** How far ahead "coming up" reaches. A fortnight is a plan, not a preview. */
const LOOKAHEAD_DAYS = 6

/** Enough to scroll, not so many that the page never ends. */
const FEED_SIZE = 24

/** The mood's own word, for a heading that reads like the chip you tapped. */
function moodLabel(moodId: string): string {
  return moodById(moodId)?.label ?? 'More'
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 11) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * The food board.
 *
 * This is the front page as a wall of food rather than a dashboard: what you
 * are eating tonight at the size of a photograph, what is coming after it,
 * what is already in the fridge, and then a feed to browse and pick from. The
 * whole of Discover → Plan lives on this one screen — tap + on anything in the
 * feed and the day strip puts it on a night without leaving the page.
 */
export function HomePage() {
  const { settings } = useSettings()
  const { planMeal } = useQuickPlan()
  const today = todayISO()
  const [mood, setMood] = useState<string>()
  /** Bumped by "other ideas", so asking again asks differently. */
  const [ideaAttempt, setIdeaAttempt] = useState(0)
  const [surprising, setSurprising] = useState(false)

  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const pantryKeys = useLiveQuery(() => pantryKeySet(), [], new Set<string>())

  const horizon = addDays(today, LOOKAHEAD_DAYS)
  const upcomingMeals = useLiveQuery(
    async () => {
      const meals = await db.plannedMeals
        .where('date')
        .between(today, horizon, true, true)
        .toArray()
      return meals.sort((a, b) => a.date.localeCompare(b.date) || (a.order ?? 0) - (b.order ?? 0))
    },
    [today, horizon],
    [] as PlannedMeal[],
  )

  const leftovers = useLiveQuery(
    async () =>
      (await db.cookEvents.toArray())
        .filter((event) => event.remainingServings > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    [],
    [] as CookEvent[],
  )

  const recipesById = useMemo(
    () => new Map((recipes ?? []).map((recipe) => [recipe.id, recipe])),
    [recipes],
  )

  const tonight = (upcomingMeals ?? []).filter(
    (meal) => meal.date === today && meal.kind !== 'skip',
  )
  const later = (upcomingMeals ?? []).filter((meal) => meal.date > today).slice(0, 8)

  /**
   * The feed leaves out what is already on the plan this week: a board that
   * offers you tonight's dinner again is a board that has not been read.
   */
  const plannedIds = useMemo(
    () => new Set((upcomingMeals ?? []).map((meal) => meal.recipeId).filter(Boolean) as string[]),
    [upcomingMeals],
  )

  /** Everything matching the mood — the feed shows a slice, the dice use it all. */
  const feedPool = useMemo(
    () => applyMood((recipes ?? []).filter((recipe) => !plannedIds.has(recipe.id)), mood, { pantryKeys }),
    [recipes, plannedIds, mood, pantryKeys],
  )

  const feed = useMemo(() => {
    const library = (recipes ?? []).filter((recipe) => !plannedIds.has(recipe.id))
    const chosen = applyMood(library, mood, { pantryKeys })
    // No mood means "anything" — shuffled by nothing more clever than title
    // order would put the same five recipes on top forever, so favourites and
    // things not cooked lately lead instead.
    const ordered = mood
      ? chosen
      : [...chosen].sort((a, b) => {
          const score = (recipe: Recipe) =>
            (recipe.favorite ? 2 : 0) + (recipe.timesCooked ? 0 : 1) + (recipe.rating ?? 0) / 5
          return score(b) - score(a)
        })
    return ordered.slice(0, FEED_SIZE)
  }, [recipes, plannedIds, mood, pantryKeys])

  const libraryEmpty = recipes !== undefined && recipes.length === 0
  const weekStart = startOfWeek(today, settings.weekStartsOn)

  return (
    <div className={`page ${styles.board}`}>
      <header className={styles.top}>
        <div>
          <p className={styles.greeting}>{greeting()}</p>
          <h1 className={styles.date}>{relativeDayLabel(today)}</h1>
        </div>
        <Link to="/more" className={styles.gear} aria-label="More and settings">
          <SettingsIcon size={19} aria-hidden="true" />
        </Link>
      </header>

      {/* Only ever visible when syncing has been failing for a while. */}
      <SyncNotice />

      {libraryEmpty ? (
        <EmptyState
          title="Let's fill the board"
          description="Add a few recipes and MealHelp turns them into a week, a shopping list and something to cook tonight."
        >
          <StarterRecipesButton />
          <Link to="/browser" className="btn btn-secondary">
            Find recipes online
          </Link>
        </EmptyState>
      ) : null}

      {tonight.length ? (
        <section aria-label="Tonight">
          {tonight.map((meal) => {
            const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
            if (!recipe) {
              return (
                <article key={meal.id} className={styles.plainTonight}>
                  <p className={styles.eyebrow}>Tonight</p>
                  <h2>{mealTitle(meal, undefined)}</h2>
                </article>
              )
            }
            return (
              <MealCard
                key={meal.id}
                recipe={recipe}
                size="hero"
                to={`/recipes/${recipe.id}`}
                eyebrow={meal.kind === 'leftover' ? '↻ Tonight — leftovers' : 'Tonight'}
              >
                <div className={styles.heroActions}>
                  <Link
                    to={`/recipes/${recipe.id}/cook?servings=${meal.servings ?? recipe.servings ?? 4}&plannedMeal=${meal.id}`}
                    className="btn btn-primary"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ChefHat size={17} aria-hidden="true" />
                    {meal.kind === 'leftover' ? 'Open recipe' : 'Start cooking'}
                  </Link>
                </div>
              </MealCard>
            )
          })}
        </section>
      ) : !libraryEmpty ? (
        <section className={styles.nothingTonight}>
          <div>
            <p className={styles.eyebrow}>Tonight</p>
            <h2 className={styles.nothingTitle}>Nothing planned</h2>
            <p className="text-sm muted">Pick something from the board, or let MealHelp fill the week.</p>
          </div>
          <div className="row-tight">
            <Link to={`/plan-week?week=${weekStart}&quick=1`} className="btn btn-primary">
              <Zap size={16} aria-hidden="true" />
              Plan it for me
            </Link>
          </div>
        </section>
      ) : null}

      {later.length ? (
        <section>
          <div className={styles.rowHead}>
            <h2 className={styles.rowTitle}>Coming up</h2>
            <Link to="/plan" className={styles.seeAll}>
              The week
            </Link>
          </div>
          <ul className={styles.carousel}>
            {later.map((meal) => {
              const recipe = meal.recipeId ? recipesById.get(meal.recipeId) : undefined
              return (
                <li key={meal.id} className={styles.carouselItem}>
                  {recipe ? (
                    <MealCard
                      recipe={recipe}
                      size="slot"
                      to={`/recipes/${recipe.id}`}
                      eyebrow={
                        meal.kind === 'leftover'
                          ? `↻ ${relativeDayLabel(meal.date, today)}`
                          : relativeDayLabel(meal.date, today)
                      }
                    />
                  ) : (
                    <article className={styles.plainSlot}>
                      <p className={styles.eyebrow}>{relativeDayLabel(meal.date, today)}</p>
                      <strong>{mealTitle(meal, undefined)}</strong>
                    </article>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {leftovers?.length ? (
        <section>
          <div className={styles.rowHead}>
            <h2 className={styles.rowTitle}>
              <Refrigerator size={16} aria-hidden="true" />
              In the fridge
            </h2>
          </div>
          <ul className={styles.fridge}>
            {leftovers.map((event) => (
              <li key={event.id}>
                <Link to={`/recipes/${event.recipeId}`} className={styles.fridgeChip}>
                  <span>{event.recipeTitle}</span>
                  <strong>{event.remainingServings}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!libraryEmpty ? (
        <section>
          <div className={styles.rowHead}>
            <h2 className={styles.rowTitle}>
              <Compass size={16} aria-hidden="true" />
              What sounds good?
            </h2>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.surprise}
                onClick={() => setSurprising(true)}
              >
                <Dices size={15} aria-hidden="true" />
                Surprise me
              </button>
              <Link to="/recipes" className={styles.seeAll}>
                All recipes
              </Link>
            </div>
          </div>

          <MoodChips value={mood} onChange={setMood} recipes={recipes ?? []} pantryKeys={pantryKeys} />

          {feed.length ? (
            <ul className={styles.feed}>
              {feed.map((recipe) => (
                <li key={recipe.id}>
                  <MealCard
                    recipe={recipe}
                    to={`/recipes/${recipe.id}`}
                    onPlan={planMeal}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.feedEmpty}>
              Nothing in your recipes fits that right now — have a look at what the
              recipe databases suggest.
            </p>
          )}

          {/*
            The moods narrow your own shelf; this asks the same loose question
            of the wider world. Same tap, more food — and nothing is fetched
            until it is pressed.
          */}
          <OnlineIdeas
            title={mood ? `${moodLabel(mood)} ideas from the web` : 'Ideas from the web'}
            blurb="Free recipe databases — save anything you like and it becomes yours"
            query={moodQuery(mood, ideaAttempt)}
            onAnother={() => setIdeaAttempt((current) => current + 1)}
            excludeTitles={(recipes ?? []).map((recipe) => recipe.title)}
          />
        </section>
      ) : null}

      <SurpriseSheet
        open={surprising}
        // Whatever the mood chips have narrowed to, so a surprise still
        // respects the one loose preference you did express.
        pool={feedPool}
        poolLabel={mood ? `${moodLabel(mood).toLowerCase()} recipes` : 'your recipes'}
        onClose={() => setSurprising(false)}
      />

      {!libraryEmpty ? (
        <p className={styles.footNote}>
          <Sparkles size={14} aria-hidden="true" />
          Tap <strong>+</strong> on any meal to put it on a day.
        </p>
      ) : null}
    </div>
  )
}
