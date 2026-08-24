import { useCallback, useEffect, useState } from 'react'
import { HardDrive, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useToast } from '@/components/common/Toast'
import { BACKUP_EVENT, daysSinceBackup } from '@/services/storage/backupRecord'
import {
  rememberPersistenceAsked,
  requestPersistence,
  storageStatus,
  type StorageStatus,
} from '@/services/storage/persistence'
import styles from './StoragePanel.module.css'

/**
 * "Is my stuff safe here?", answered on the screen.
 *
 * The honest answer has two halves and the app used to give neither. Whether
 * the browser has agreed to keep the data is something it will tell you if
 * asked, and whether there is a backup is something only this device knows.
 * Both are stated plainly, including when the answer is no.
 */
export function StoragePanel({ onExport }: { onExport?: () => void }) {
  const { toast } = useToast()
  const [status, setStatus] = useState<StorageStatus>()
  const [asking, setAsking] = useState(false)
  // Re-read when a backup is taken, by either of the two buttons that take one.
  const [days, setDays] = useState(daysSinceBackup)

  useEffect(() => {
    const onBackup = () => setDays(daysSinceBackup())
    window.addEventListener(BACKUP_EVENT, onBackup)
    return () => window.removeEventListener(BACKUP_EVENT, onBackup)
  }, [])

  const refresh = useCallback(async () => {
    setStatus(await storageStatus())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ask = async () => {
    setAsking(true)
    try {
      rememberPersistenceAsked()
      const granted = await requestPersistence()
      await refresh()
      toast(
        granted
          ? 'Your browser has agreed to keep MealHelp’s data.'
          : 'Your browser would not promise to keep it. Export a backup instead.',
        { tone: granted ? 'success' : 'error' },
      )
    } finally {
      setAsking(false)
    }
  }

  const backupLine =
    days == null
      ? 'No backup taken on this device.'
      : days === 0
        ? 'Backed up today.'
        : days === 1
          ? 'Backed up yesterday.'
          : days < 30
            ? `Backed up ${days} days ago.`
            : `Backed up ${Math.round(days / 30)} months ago.`

  return (
    <div className={styles.panel}>
      <p className={styles.row}>
        {status?.persisted ? (
          <ShieldCheck size={16} className={styles.good} aria-hidden="true" />
        ) : (
          <ShieldAlert size={16} className={styles.warn} aria-hidden="true" />
        )}
        <span>
          {status?.persisted === true
            ? 'Your browser has agreed to keep this data even when space runs short.'
            : status?.persisted === false
              ? 'Your browser treats this data as disposable and may clear it if you do not open MealHelp for a while.'
              : 'This browser will not say whether it keeps the data.'}
        </span>
        {status?.persisted === false ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void ask()}
            disabled={asking}
          >
            {asking ? 'Asking…' : 'Ask it to keep it'}
          </button>
        ) : null}
      </p>

      <p className={styles.row}>
        <HardDrive size={16} className={days == null || days >= 30 ? styles.warn : styles.good} aria-hidden="true" />
        <span>
          {backupLine}
          {days == null || days >= 30
            ? ' A backup is the only thing that survives a lost phone.'
            : ''}
        </span>
        {(days == null || days >= 30) && onExport ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onExport}>
            Export one now
          </button>
        ) : null}
      </p>

      {status?.usage != null ? (
        <p className={styles.usage}>
          Using {formatBytes(status.usage)}
          {status.quota ? ` of about ${formatBytes(status.quota)} available` : ''}.
        </p>
      ) : null}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
