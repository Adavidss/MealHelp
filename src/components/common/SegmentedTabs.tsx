import type { ReactNode } from 'react'
import styles from './SegmentedTabs.module.css'

export interface SegmentedTab<T extends string> {
  id: T
  label: ReactNode
  count?: number
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  className?: string
}

/** The views inside one section, as one pill track. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div className={`${styles.track} ${className ?? ''}`} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count != null ? <span className={styles.count}>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
