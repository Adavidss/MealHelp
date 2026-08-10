import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/database'
import { deleteCollection, toggleRecipeInCollection, updateCollection } from '@/db/collections'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal } from '@/components/common/Modal'
import { RecipeCard } from '@/features/recipes/RecipeCard'
import { RecipePicker } from '@/features/planner/RecipePicker'
import styles from './CollectionDetailPage.module.css'

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const collection = useLiveQuery(() => (id ? db.collections.get(id) : undefined), [id])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [])

  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (collection === undefined) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="page">
        <p>That collection no longer exists.</p>
        <Link to="/collections" className="btn btn-secondary">
          Back to collections
        </Link>
      </div>
    )
  }

  const members = collection.recipeIds
    .map((recipeId) => recipes?.find((recipe) => recipe.id === recipeId))
    .filter(Boolean)

  return (
    <div className="page">
      <div className={styles.topBar}>
        <Link to="/collections" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} aria-hidden="true" />
          Collections
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete collection"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>

      <header className="page-header">
        <div className={styles.titleField}>
          <label className="sr-only" htmlFor="collection-title">
            Collection name
          </label>
          <input
            id="collection-title"
            className={styles.titleInput}
            defaultValue={collection.name}
            onBlur={(event) => {
              const name = event.target.value.trim()
              if (name && name !== collection.name) {
                void updateCollection(collection.id, { name })
              }
            }}
          />
          <p className="page-subtitle">
            {members.length} recipe{members.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setAdding(true)}
        >
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </header>

      {members.length ? (
        <ul className={styles.list}>
          {members.map((recipe) =>
            recipe ? (
              <li key={recipe.id} className={styles.row}>
                <RecipeCard recipe={recipe} view="list" />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void toggleRecipeInCollection(collection.id, recipe.id)}
                >
                  Remove
                </button>
              </li>
            ) : null,
          )}
        </ul>
      ) : (
        <EmptyState
          title="Nothing in here yet"
          description="Add recipes from your library."
        >
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            Add recipes
          </button>
        </EmptyState>
      )}

      <Modal open={adding} title="Add to collection" onClose={() => setAdding(false)}>
        <RecipePicker
          excludeIds={collection.recipeIds}
          onSelect={(recipe) => {
            void toggleRecipeInCollection(collection.id, recipe.id)
            setAdding(false)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this collection?"
        message="The recipes in it stay in your library. Only the grouping is removed."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          void deleteCollection(collection.id)
          navigate('/collections')
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
