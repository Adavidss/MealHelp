import { useMemo, useState } from 'react'
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
import { SearchField } from '@/components/common/SearchField'
import { useToast } from '@/components/common/Toast'
import styles from './PantryPage.module.css'

/**
 * The pantry answers one question: which ingredients should not clutter the
 * shopping list. It is not an inventory, and MealHelp never silently decides
 * you have something — staples move to a "check the pantry" section instead.
 */
export function PantryView() {
  const items = useLiveQuery(() => db.pantryItems.orderBy('name').toArray(), [], [])
  const { toast } = useToast()
  const [name, setName] = useState('')

  const add = async () => {
    if (!name.trim()) return
    await addPantryItem(name)
    setName('')
  }

  const needle = name.trim().toLowerCase()
  const visible = useMemo(
    () => (needle ? (items ?? []).filter((item) => item.name.toLowerCase().includes(needle)) : items ?? []),
    [items, needle],
  )

  const addSuggested = async () => {
    const added = await addPantryItems(SUGGESTED_PANTRY_STAPLES)
    toast(
      added
        ? `Added ${added} staple${added === 1 ? '' : 's'}.`
        : 'Those staples are already in your pantry.',
      { tone: 'success' },
    )
  }

  const staples = visible.filter((item) => item.alwaysHave)
  const others = visible.filter((item) => !item.alwaysHave)

  return (
    <div>
      <p className={styles.lead}>
        Things you usually have. They come off the shopping list into a short
        "check the pantry" list instead of being assumed.
      </p>
      <div className={styles.addRow}>
        <SearchField
          value={name}
          onChange={setName}
          onSubmit={() => void add()}
          placeholder="Find or add — olive oil, rice…"
          label="Find or add a pantry item"
          trailing={
            name.trim() ? (
              <button type="button" className={styles.addButton} onClick={() => void add()}>
                <Plus size={15} aria-hidden="true" />
                Add
              </button>
            ) : null
          }
        />
      </div>

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
