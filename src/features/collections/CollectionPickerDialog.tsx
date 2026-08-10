import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus } from 'lucide-react'
import { db } from '@/db/database'
import { createCollection, toggleRecipeInCollection } from '@/db/collections'
import { Modal } from '@/components/common/Modal'
import styles from './CollectionPickerDialog.module.css'

interface CollectionPickerDialogProps {
  open: boolean
  recipeId: string
  onClose: () => void
}

export function CollectionPickerDialog({
  open,
  recipeId,
  onClose,
}: CollectionPickerDialogProps) {
  const collections = useLiveQuery(() => db.collections.toArray(), [], [])
  const [newName, setNewName] = useState('')

  const create = async () => {
    if (!newName.trim()) return
    await createCollection(newName, { recipeIds: [recipeId] })
    setNewName('')
  }

  return (
    <Modal open={open} title="Collections" onClose={onClose}>
      {collections?.length ? (
        <ul className={styles.list}>
          {collections.map((collection) => {
            const included = collection.recipeIds.includes(recipeId)
            return (
              <li key={collection.id}>
                <button
                  type="button"
                  className={styles.row}
                  aria-pressed={included}
                  onClick={() => void toggleRecipeInCollection(collection.id, recipeId)}
                >
                  <span
                    className={included ? `${styles.box} ${styles.boxOn}` : styles.box}
                    aria-hidden="true"
                  >
                    {included ? <Check size={14} /> : null}
                  </span>
                  {collection.name}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted text-sm">No collections yet — make one below.</p>
      )}

      <form
        className={styles.createRow}
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
      >
        <input
          className="input"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New collection"
          aria-label="New collection name"
        />
        <button
          type="submit"
          className="btn btn-primary btn-icon"
          aria-label="Create collection"
          disabled={!newName.trim()}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </form>
    </Modal>
  )
}
