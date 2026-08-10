import { Star } from 'lucide-react'
import styles from './StarRating.module.css'

interface StarRatingProps {
  value: number | undefined
  onChange?: (value: number | undefined) => void
  size?: number
  label?: string
}

export function StarRating({ value, onChange, size = 20, label }: StarRatingProps) {
  const readOnly = !onChange

  if (readOnly) {
    return (
      <span className={styles.row} aria-label={`${value ?? 0} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            aria-hidden="true"
            className={star <= (value ?? 0) ? styles.filled : styles.empty}
          />
        ))}
      </span>
    )
  }

  return (
    <div className={styles.row} role="group" aria-label={label ?? 'Rating'}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={styles.button}
          // Tapping the current rating clears it, so a misfire is undoable.
          onClick={() => onChange(value === star ? undefined : star)}
          aria-pressed={star <= (value ?? 0)}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            size={size}
            aria-hidden="true"
            className={star <= (value ?? 0) ? styles.filled : styles.empty}
          />
        </button>
      ))}
    </div>
  )
}
