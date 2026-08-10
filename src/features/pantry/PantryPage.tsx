import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/database'
import {
  addPantryItem,
  addPantryItems,
  deletePantryItem,
  togglePantryStaple,
} from '@/db/pantry'
import { SUGGESTED_PANTRY_STAPLES } from '@/services/ingredientParser'
import { EmptyState } from '@/components/common/EmptyState'
import { useToast } from '@/components/common/Toast'
import styles from './PantryPage.module.css'

/**
 * The pantry answers one question: which ingredients should not clutter the
 * shopping list. It is not an inventory, and MealHelp never silently decides
 * you have something — staples move to a "check the pantry" section instead.
 */
export function PantryPage() {
  const items = useLiveQuery(() => db.pantryItems.orderBy('name').toArray(), [], [])
  const { toast } = useToast()
  const [name, setName] = useState('')

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    await addPantryItem(name)
    setName('')
  }

  const addSuggested = async () => {
    const added = await addPantryItems(SUGGESTED_PANTRY_STAPLES)
    toast(
      added
        ? `Added ${added} staple${added === 1 ? '' : 's'}.`
        : 'Those staples are already in your pantry.',
      { tone: 'success' },
    )
  }

  const staples = items?.filter((item) => item.alwaysHave) ?? []
  const others = items?.filter((item) => !item.alwaysHave) ?? []

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Pantry</h1>
          <p className="page-subtitle">Things you usually have</p>
        </div>
      </header>

      <form className={styles.addRow} onSubmit={add}>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Olive oil, salt, rice…"
          aria-label="Add a pantry item"
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Add">
          <Plus size={19} aria-hidden="true" />
        </button>
      </form>

      {!items?.length ? (
        <EmptyState
          title="Nothing in the pantry yet"
          description="Add the things you always have. They will be pulled out of the main shopping list into a short list to check before you leave."
        >
          <button type="button" className="btn btn-primary" onClick={() => void addSuggested()}>
            Add {SUGGESTED_PANTRY_STAPLES.length} common staples
          </button>
        </EmptyState>
      ) : null}

      {staples.length ? (
        <section>
          <h2 className="section-title">Usually have</h2>
          <ul className={styles.list}>
            {staples.map((item) => (
              <li key={item.id} className={styles.row}>
                <div>
                  <p className={styles.name}>{item.name}</p>
                  <p className={styles.category}>{item.category}</p>
                </div>
                <div className="row-tight">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void togglePantryStaple(item.id)}
                  >
                    Not always
                  </button>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => void deletePantryItem(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {others.length ? (
        <section>
          <h2 className="section-title">Sometimes have</h2>
          <p className="text-sm muted">
            These stay on the shopping list like anything else.
          </p>
          <ul className={styles.list}>
            {others.map((item) => (
              <li key={item.id} className={styles.row}>
                <p className={styles.name}>{item.name}</p>
                <div className="row-tight">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void togglePantryStaple(item.id)}
                  >
                    Always have
                  </button>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => void deletePantryItem(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items?.length ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void addSuggested()}
          style={{ marginTop: 'var(--space-5)' }}
        >
          Add common staples
        </button>
      ) : null}
    </div>
  )
}
