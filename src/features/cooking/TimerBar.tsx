import { useNavigate } from 'react-router-dom'
import { Timer, X } from 'lucide-react'
import { formatCountdown, useTimers } from './useTimers'
import styles from './TimerBar.module.css'

/**
 * The timers, wherever you are.
 *
 * Something on the hob does not stop mattering because you went to look at the
 * shopping list, and a countdown you cannot see is a countdown you will miss.
 * It shows only while something is running, sits above the tab bar, and taps
 * back to whatever was being cooked.
 */
export function TimerBar() {
  const { timers, dismiss } = useTimers()
  const navigate = useNavigate()

  if (!timers.length) return null

  return (
    <ul className={styles.bar} aria-label="Kitchen timers">
      {timers.map((timer) => (
        <li key={timer.id} className={timer.done ? `${styles.timer} ${styles.done}` : styles.timer}>
          <button
            type="button"
            className={styles.face}
            onClick={() => (timer.recipeId ? navigate(`/recipes/${timer.recipeId}/cook`) : undefined)}
          >
            <Timer size={16} aria-hidden="true" />
            <span className={styles.label}>{timer.label}</span>
            <strong className={styles.value}>
              {timer.done ? 'Done' : formatCountdown(timer.remainingMs)}
            </strong>
          </button>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => dismiss(timer.id)}
            aria-label={`Dismiss timer for ${timer.label}`}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
