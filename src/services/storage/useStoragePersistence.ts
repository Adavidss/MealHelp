import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { persistenceAsked, rememberPersistenceAsked, requestPersistence } from './persistence'

/**
 * Asks once, when there is finally something to lose.
 *
 * Not on first paint: some browsers put a permission prompt behind this, and
 * asking a stranger to protect an empty database is how people learn to say
 * no. The first recipe is the moment the answer starts to matter.
 */
export function useStoragePersistence(): void {
  const hasRecipes = useLiveQuery(async () => (await db.recipes.count()) > 0, [], false)

  useEffect(() => {
    if (!hasRecipes || persistenceAsked()) return
    rememberPersistenceAsked()
    void requestPersistence()
  }, [hasRecipes])
}
