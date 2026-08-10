import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  children?: ReactNode
}

/** Empty screens are a place to start, not a dead end. */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {description ? <p>{description}</p> : null}
      {children ? <div className="empty-actions">{children}</div> : null}
    </div>
  )
}
