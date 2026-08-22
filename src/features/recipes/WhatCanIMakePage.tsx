import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { db } from '@/db/database'
import { matchByIngredients } from '@/services/recommendationEngine'
import { EmptyState } from '@/components/common/EmptyState'
import { MealCard } from '@/components/meal/MealCard'
import styles from './WhatCanIMakePage.module.css'

/**
 * Ranks the library by how much of each recipe you already have. Full coverage
 * is never required — one missing spice should not hide a recipe you could
 * happily cook tonight.
 */
export function WhatCanIMakeView() {
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [])
  const pantry = useLiveQuery(() => db.pantryItems.toArray(), [], [])

  const [ingredients, setIngredients] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [includePantry, setIncludePantry] = useState(true)

  const available = useMemo(() => {
    const staples = includePantry
      ? (pantry ?? []).filter((item) => item.alwaysHave).map((item) => item.key)
      : []
    return [...ingredients, ...staples]
  }, [ingredients, pantry, includePantry])

  const matches = useMemo(
    () =>
      ingredients.length
        ? matchByIngredients(recipes ?? [], available, { minCoverage: 0.25 })
        : [],
    [recipes, available, ingredients.length],
  )

  const add = (event: React.FormEvent) => {
    event.preventDefault()
    const value = draft.trim().toLowerCase()
    if (!value || ingredients.includes(value)) {
      setDraft('')
      return
    }
    setIngredients((current) => [...current, value])
    setDraft('')
  }

  return (
    <div>

      <form className={styles.addRow} onSubmit={add}>
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="chicken, spinach, rice…"
          aria-label="Add an ingredient you have"
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Add ingredient">
          <Plus size={19} aria-hidden="true" />
        </button>
      </form>

      {ingredients.length ? (
        <div className="row-tight">
          {ingredients.map((ingredient) => (
            <button
              key={ingredient}
              type="button"
              className="chip chip-button"
              onClick={() =>
                setIngredients((current) => current.filter((item) => item !== ingredient))
              }
              aria-label={`Remove ${ingredient}`}
            >
              {ingredient}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      {pantry?.length ? (
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <button
            type="button"
            className="chip chip-button"
            aria-pressed={includePantry}
            onClick={() => setIncludePantry((current) => !current)}
          >
            Also count my pantry staples
          </button>
        </div>
      ) : null}

      {!ingredients.length ? (
        <EmptyState
          title="Add what's in the fridge"
          description="Two or three things is usually enough to get a useful answer."
        />
      ) : matches.length === 0 ? (
        <EmptyState
          title="Nothing close enough"
          description="None of your recipes use much of that — but MealHelp can look for new ones that do."
        >
          <Link to="/browser" className="btn btn-primary">
            Search online instead
          </Link>
          <Link to="/import" className="btn btn-secondary">
            Import a recipe
          </Link>
        </EmptyState>
      ) : (
        <ul className={styles.results}>
          {matches.map((match) => (
            <li key={match.recipe.id}>
              <MealCard
                recipe={match.recipe}
                size="compact"
                to={`/recipes/${match.recipe.id}`}
              >
                  <p className={styles.coverage}>
                    {Math.round(match.coverage * 100)}% of the ingredients
                    {match.missing.length ? (
                      <span className={styles.missing}>
                        {' '}
                        · missing {match.missing.slice(0, 3).join(', ')}
                        {match.missing.length > 3 ? ` +${match.missing.length - 3}` : ''}
                      </span>
                    ) : null}
                  </p>
              </MealCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
