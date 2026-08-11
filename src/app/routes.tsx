import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'

// The dashboard, planner and library are what people open the app for, so they
// ship in the entry chunk. Everything else loads when it is first visited.
import { TodayPage } from '@/features/dashboard/TodayPage'
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
const PantryPage = lazy(() =>
  import('@/features/pantry/PantryPage').then((m) => ({ default: m.PantryPage })),
)
const CollectionsPage = lazy(() =>
  import('@/features/collections/CollectionsPage').then((m) => ({
    default: m.CollectionsPage,
  })),
)
const CollectionDetailPage = lazy(() =>
  import('@/features/collections/CollectionDetailPage').then((m) => ({
    default: m.CollectionDetailPage,
  })),
)
const HistoryPage = lazy(() =>
  import('@/features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })),
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
const DiscoverPage = lazy(() =>
  import('@/features/discover/DiscoverPage').then((m) => ({ default: m.DiscoverPage })),
)
const WhatCanIMakePage = lazy(() =>
  import('@/features/recipes/WhatCanIMakePage').then((m) => ({
    default: m.WhatCanIMakePage,
  })),
)

function RouteFallback() {
  return (
    <div className="page">
      <p className="muted">Loading…</p>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<TodayPage />} />

          <Route path="/plan" element={<PlannerPage />} />
          <Route path="/plan/:weekStart" element={<PlannerPage />} />
          <Route path="/plan-week" element={<PlanWizardPage />} />

          <Route path="/recipes" element={<RecipeLibraryPage />} />
          <Route path="/recipes/new" element={<RecipeEditPage />} />
          <Route path="/recipes/what-can-i-make" element={<WhatCanIMakePage />} />
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeEditPage />} />
          <Route path="/recipes/:id/cook" element={<CookingModePage />} />

          <Route path="/import" element={<ImportPage />} />
          <Route path="/capture/:payload" element={<CapturePage />} />
          <Route path="/discover" element={<DiscoverPage />} />

          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/pantry" element={<PantryPage />} />

          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />

          <Route path="/history" element={<HistoryPage />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="/print/:weekStart" element={<PrintPage />} />

          <Route path="/share/:type/:payload" element={<SharePage />} />

          <Route path="/more" element={<MorePage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
