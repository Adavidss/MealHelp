import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './UpdatePrompt.module.css'

/**
 * A new service worker waits rather than taking over, because reloading the app
 * out from under someone on step 4 of a recipe is the worst possible moment.
 * The refresh happens only when they say so.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className={styles.bar} role="status">
      <span>MealHelp update available.</span>
      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => void updateServiceWorker(true)}
        >
          Refresh
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
      </div>
    </div>
  )
}
