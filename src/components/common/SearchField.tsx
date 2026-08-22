import { forwardRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import styles from './SearchField.module.css'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  /** Called on Enter, for fields that also *do* something (add an item, run a search). */
  onSubmit?: (value: string) => void
  /** Controls drawn inside the pill on the right, after the clear button. */
  trailing?: ReactNode
  autoFocus?: boolean
  className?: string
}

/**
 * The compact search field every section shares — the same pill whether it
 * is filtering your recipes, finding a grocery item or searching the web.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, placeholder, label, onSubmit, trailing, autoFocus, className },
  ref,
) {
  return (
    <form
      className={`${styles.field} ${className ?? ''}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.(value.trim())
      }}
    >
      <Search size={16} aria-hidden="true" className={styles.icon} />
      <input
        ref={ref}
        className={styles.input}
        type="text"
        inputMode="search"
        enterKeyHint={onSubmit ? 'go' : 'search'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
      />
      {value ? (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Clear">
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
    </form>
  )
})
