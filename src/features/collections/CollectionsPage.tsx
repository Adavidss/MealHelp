import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db } from '@/db/database'
import { createCollection } from '@/db/collections'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal } from '@/components/common/Modal'
import styles from './CollectionsPage.module.css'

const SUGGESTIONS = [
  'Weeknight',
  'Slow Cooker',
  'Instant Pot',
  'Lunch Prep',
  'Freezer Meals',
  'Date Night',
  'Very Cheap',
]

export function CollectionsPage() {
  const collections = useLiveQuery(() => db.collections.toArray(), [], [])
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const create = async (collectionName: string) => {
    if (!collectionName.trim()) return
    await createCollection(collectionName)
    setName('')
    setCreating(false)
  }

  const recipeCount = (ids: string[]) =>
    ids.filter((id) => recipes?.some((recipe) => recipe.id === id)).length

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Collections</h1>
          <p className="page-subtitle">Group recipes however you like</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden="true" />
          New
        </button>
      </header>

      {collections?.length ? (
        <ul className={styles.grid}>
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link to={`/collections/${collection.id}`} className={styles.card}>
                <strong>{collection.name}</strong>
                <small>
                  {recipeCount(collection.recipeIds)} recipe
                  {recipeCount(collection.recipeIds) === 1 ? '' : 's'}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No collections yet"
          description="A collection is just a named group — a recipe can be in as many as you like."
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreating(true)}
          >
            Create one
          </button>
        </EmptyState>
      )}

      <Modal
        open={creating}
        title="New collection"
        onClose={() => setCreating(false)}
        footer={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void create(name)}
            disabled={!name.trim()}
          >
            Create
          </button>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="collection-name">
            Name
          </label>
          <input
            id="collection-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Weeknight dinners"
            autoFocus
          />
        </div>
        <div className="row-tight">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip chip-button"
              onClick={() => setName(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
