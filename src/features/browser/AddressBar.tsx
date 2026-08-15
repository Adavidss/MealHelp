import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Ellipsis, RotateCw, Search, X } from 'lucide-react'
import styles from './AddressBar.module.css'

interface AddressBarProps {
  /** What the field shows when it is not being edited: an address, or a query. */
  display: string
  loading: boolean
  canBack: boolean
  onSubmit: (text: string) => void
  onBack: () => void
  onReload: () => void
  onStop: () => void
  onMore: () => void
}

/**
 * One field for both jobs, like every browser since 2008: an address goes
 * there, anything else is searched for. Editing starts with the whole value
 * selected, so typing replaces rather than appends.
 */
export function AddressBar({
  display,
  loading,
  canBack,
  onSubmit,
  onBack,
  onReload,
  onStop,
  onMore,
}: AddressBarProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(display)
  const inputRef = useRef<HTMLInputElement>(null)

  // A new page or search replaces whatever was in the field, unless the user
  // is in the middle of typing.
  useEffect(() => {
    if (!editing) setDraft(display)
  }, [display, editing])

  const submit = (event?: React.SyntheticEvent) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text) return
    inputRef.current?.blur()
    setEditing(false)
    onSubmit(text)
  }

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onBack}
        disabled={!canBack}
        aria-label="Back"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </button>

      <form className={styles.field} onSubmit={submit} role="search">
        <Search size={16} aria-hidden="true" className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => {
            setEditing(true)
            event.target.select()
          }}
          onBlur={() => {
            setEditing(false)
            setDraft(display)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(display)
              inputRef.current?.blur()
            }
            // Explicit, rather than relying on the form's implicit submission,
            // which some on-screen keyboards and automation never trigger.
            if (event.key === 'Enter') submit(event)
          }}
          placeholder="Search recipes or enter a site"
          aria-label="Search recipes or enter a site"
          type="text"
          inputMode="search"
          enterKeyHint="go"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
        />
        {loading ? (
          <button
            type="button"
            className={styles.inlineButton}
            onClick={onStop}
            aria-label="Stop loading"
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : display ? (
          <button
            type="button"
            className={styles.inlineButton}
            onClick={onReload}
            aria-label="Reload"
          >
            <RotateCw size={16} aria-hidden="true" />
          </button>
        ) : null}
      </form>

      <button type="button" className={styles.iconButton} onClick={onMore} aria-label="More">
        <Ellipsis size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
