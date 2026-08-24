import { Link } from 'react-router-dom'
import { CloudOff } from 'lucide-react'
import { syncHealth } from '@/services/sync/household'
import styles from './SyncNotice.module.css'

/**
 * Said once, quietly, when syncing has stopped working.
 *
 * A single failed sync deserves silence — a phone out of signal is a working
 * app with slightly old data, not an error worth interrupting dinner for. A
 * run of them is different: two people go on planning against copies that have
 * quietly stopped agreeing, and the only place that admitted it was a Settings
 * panel neither had opened since they linked.
 */
export function SyncNotice() {
  const health = syncHealth()
  if (!health.failing) return null

  const since = health.lastSyncedAt
    ? new Date(health.lastSyncedAt).toLocaleDateString(undefined, {
        weekday: 'long',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'never'

  return (
    <p className={styles.notice}>
      <CloudOff size={15} aria-hidden="true" />
      <span>
        Not syncing with your household. Last synced {since}. Anything either of
        you changes since then is only on the phone it was changed on.
      </span>
      <Link to="/settings" className={styles.link}>
        Check it
      </Link>
    </p>
  )
}
