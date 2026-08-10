import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: ReactNode
  /** Changing this resets the boundary — used to recover on navigation. */
  resetKey?: string
  /** Shown instead of the standard message, for a whole-app failure. */
  fatal?: boolean
}

interface State {
  error?: Error
  shownFor?: string
}

/**
 * A crash in one screen used to unmount the entire app, leaving a white page
 * with no navigation and no way back — which is exactly what a
 * `ReadOnlyError` from the planner did. React has no recovery of its own for
 * that; a boundary is the only thing that keeps the rest of the app alive.
 *
 * Navigating away clears the error, so a bad screen is an inconvenience rather
 * than a dead end.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (state.error && state.shownFor !== undefined && state.shownFor !== props.resetKey) {
      return { error: undefined, shownFor: undefined }
    }
    if (state.error && state.shownFor === undefined) {
      return { ...state, shownFor: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // There is no error reporting service to send this to — the app has no
    // server — so the console is where a developer will find it.
    console.error('MealHelp hit an error it could not recover from:', error, info)
  }

  private reload = () => {
    window.location.reload()
  }

  private dismiss = () => {
    this.setState({ error: undefined, shownFor: undefined })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className={styles.wrap} role="alert">
        <h1 className={styles.title}>That screen ran into a problem.</h1>
        <p className={styles.body}>
          Nothing has been lost — your recipes, plans and grocery list are all
          still saved on this device.
        </p>
        <p className={styles.detail}>{error.message}</p>
        <div className={styles.actions}>
          {this.props.fatal ? null : (
            <button type="button" className="btn btn-secondary" onClick={this.dismiss}>
              Try again
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={this.reload}>
            Reload MealHelp
          </button>
        </div>
        {this.props.fatal ? null : (
          <p className={styles.hint}>
            You can also tap another tab below to carry on somewhere else.
          </p>
        )}
      </div>
    )
  }
}
