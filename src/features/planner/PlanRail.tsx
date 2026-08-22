import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { pantryKeySet } from '@/db/pantry'
import type { Recipe } from '@/models'
import { MealCard } from '@/components/meal/MealCard'
import { SearchField } from '@/components/common/SearchField'
import { MoodChips } from '@/features/recipes/MoodChips'
import { applyMood } from '@/features/recipes/moods'
import { filterRecipes } from '@/features/recipes/filterRecipes'
import styles from './PlanRail.module.css'

interface PlanRailProps {
  /** Already on the week, so the rail stops offering them. */
  usedRecipeIds: string[]
  onPick: (recipe: Recipe) => void
}

/** Enough to scroll a while without rendering the whole library. */
const RAIL_SIZE = 30

/**
 * Discovery beside the week, on a screen wide enough for both.
 *
 * On a phone, finding a meal and planning it are two screens because there is
 * only room for one at a time. A desktop has room for both, and the whole
 * point of the board is that choosing and placing are the same gesture — so
 * the week sits on the left and the food to fill it on the right. Tapping a
 * card raises the same day strip everything else uses.
 *
 * Deliberately hidden below 1100px rather than reflowed: squeezed to half a
 * tablet it would take the week's space and give nothing back.
 */
export function PlanRail({ usedRecipeIds, onPick }: PlanRailProps) {
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[])
  const pantryKeys = useLiveQuery(() => pantryKeySet(), [], new Set<string>())
  const [query, setQuery] = useState('')
  const [mood, setMood] = useState<string>()

  const used = useMemo(() => new Set(usedRecipeIds), [usedRecipeIds])

  const shortlist = useMemo(() => {
    const searched = filterRecipes(recipes ?? [], { query }, 'recent')
    const inMood = applyMood(searched, mood, { pantryKeys })
    // What is already on the week sinks rather than disappearing: cooking the
    // same thing twice is a choice, just rarely the one being looked for.
    return [...inMood]
      .sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id)))
      .slice(0, RAIL_SIZE)
  }, [recipes, query, mood, pantryKeys, used])

  if (!recipes?.length) return null

  return (
    <aside className={styles.rail} aria-label="Recipes to add">
      <div className={styles.head}>
        <h2 className={styles.title}>Fill the week</h2>
        <Link to="/recipes" className={styles.all}>
          All recipes
        </Link>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search your recipes…"
        label="Search recipes to add"
      />

      <MoodChips value={mood} onChange={setMood} recipes={recipes} pantryKeys={pantryKeys} />

      {shortlist.length ? (
        <ul className={styles.list}>
          {shortlist.map((recipe) => (
            <li key={recipe.id}>
              <MealCard
                recipe={recipe}
                size="compact"
                onSelect={onPick}
                className={used.has(recipe.id) ? styles.alreadyOn : undefined}
              >
                {used.has(recipe.id) ? (
                  <p className={styles.onWeek}>Already on this week</p>
                ) : null}
              </MealCard>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          Nothing matched. <Link to="/browser">Find something online</Link>.
        </p>
      )}
    </aside>
  )
}
