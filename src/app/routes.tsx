import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'

// The planner and library are what people open the app for, so they ship in
// the entry chunk. Everything else loads when it is first visited.
import { HomePage } from '@/features/home/HomePage'
import { PlannerPage } from '@/features/planner/PlannerPage'
import { RecipeLibraryPage } from '@/features/recipes/RecipeLibraryPage'

const RecipeDetailPage = lazy(() =>
  import('@/features/recipes/RecipeDetailPage').then((m) => ({
    default: m.RecipeDetailPage,
  })),
)
const RecipeEditPage = lazy(() =>
  import('@/features/recipes/RecipeEditPage').then((m) => ({
    default: m.RecipeEditPage,
  })),
)
const CookingModePage = lazy(() =>
  import('@/features/cooking/CookingModePage').then((m) => ({
    default: m.CookingModePage,
  })),
)
const ImportPage = lazy(() =>
  import('@/features/import/ImportPage').then((m) => ({ default: m.ImportPage })),
)
const CapturePage = lazy(() =>
  import('@/features/import/CapturePage').then((m) => ({ default: m.CapturePage })),
)
const PlanWizardPage = lazy(() =>
  import('@/features/planning/PlanWizardPage').then((m) => ({
    default: m.PlanWizardPage,
  })),
)
const GroceryPage = lazy(() =>
  import('@/features/grocery/GroceryPage').then((m) => ({ default: m.GroceryPage })),
)
const CollectionDetailPage = lazy(() =>
  import('@/features/collections/CollectionDetailPage').then((m) => ({
    default: m.CollectionDetailPage,
  })),
)
const RecipePrintPage = lazy(() =>
  import('@/features/print/RecipePrintPage').then((m) => ({
    default: m.RecipePrintPage,
  })),
)
const PrintPage = lazy(() =>
  import('@/features/print/PrintPage').then((m) => ({ default: m.PrintPage })),
)
const SharePage = lazy(() =>
  import('@/features/sharing/SharePage').then((m) => ({ default: m.SharePage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
)
const MorePage = lazy(() =>
  import('@/features/settings/MorePage').then((m) => ({ default: m.MorePage })),
)
const BrowserPage = lazy(() =>
  import('@/features/browser/BrowserPage').then((m) => ({ default: m.BrowserPage })),
)

export function AppRoutes() {
  return (
    <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />

          <Route path="/plan" element={<PlannerPage />} />
          <Route path="/plan/:weekStart" element={<PlannerPage />} />
          <Route path="/plan-week" element={<PlanWizardPage />} />

          <Route path="/recipes" element={<RecipeLibraryPage />} />
          <Route path="/recipes/new" element={<RecipeEditPage />} />
          <Route path="/recipes/print" element={<RecipePrintPage />} />
          <Route path="/recipes/:id/print" element={<RecipePrintPage />} />
          <Route path="/recipes/what-can-i-make" element={<Navigate to="/recipes?tab=make" replace />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditPage />} />
          <Route path="/recipes/:id/cook" element={<CookingModePage />} />

          <Route path="/import" element={<ImportPage />} />
          <Route path="/capture/:payload" element={<CapturePage />} />
          <Route path="/browser" element={<BrowserPage />} />

          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />

          {/* The sections these used to be are now views inside others. Old
              links, bookmarks and home-screen shortcuts still arrive. */}
          <Route path="/discover" element={<Navigate to="/browser?tab=databases" replace />} />
          <Route path="/pantry" element={<Navigate to="/grocery?tab=pantry" replace />} />
          <Route path="/collections" element={<Navigate to="/recipes?tab=collections" replace />} />
          <Route path="/history" element={<Navigate to="/plan?tab=history" replace />} />
          <Route path="/nutrition" element={<Navigate to="/plan?tab=nutrition" replace />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="/print/:weekStart" element={<PrintPage />} />

          <Route path="/share/:type/:payload" element={<SharePage />} />

          <Route path="/more" element={<MorePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
  )
}
