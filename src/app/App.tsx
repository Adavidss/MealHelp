import { HashRouter } from 'react-router-dom'
import { SettingsProvider } from './SettingsContext'
import { ToastProvider } from '@/components/common/Toast'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { AppRoutes } from './routes'
import { ScrollManager } from './ScrollManager'

/**
 * Hash routing, not browser routing: GitHub Pages serves 404 for unknown paths,
 * so a refresh on `/MealHelp/plan` would break. It also gives share links a
 * fragment to hide a payload in (see services/shareCodec).
 */
export function App() {
  return (
    // The outer boundary is the last resort: if the shell itself fails there is
    // no navigation left to keep, so it offers a reload rather than a blank page.
    <ErrorBoundary fatal>
      <HashRouter>
        <SettingsProvider>
          <ToastProvider>
            <ScrollManager />
            <AppRoutes />
          </ToastProvider>
        </SettingsProvider>
      </HashRouter>
    </ErrorBoundary>
  )
}
