import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  ChefHat,
  Download,
  Ellipsis,
  Globe,
  Home,
  Printer,
  Settings as SettingsIcon,
  ShoppingCart,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useHouseholdSync } from '@/services/sync/useHouseholdSync'
import { UpdatePrompt } from '@/components/common/UpdatePrompt'
import styles from './AppShell.module.css'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

/**
 * Four sections and a More — the shape a recipe app settles into (Mela's tabs
 * are Recipes, Browser, Calendar, Shopping). Everything else is a view inside
 * one of them: Today sits at the top of Plan, History and Nutrition are Plan
 * views, Pantry is a Grocery view, Collections a Recipes view, and the recipe
 * databases live inside the Browser next to the web.
 */
const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/browser', label: 'Browser', icon: Globe },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/grocery', label: 'Grocery', icon: ShoppingCart },
]

/** Desktop has room for the few things More holds. */
const SECONDARY_NAV: NavItem[] = [
  { to: '/import', label: 'Import', icon: Download },
  { to: '/more', label: 'More', icon: Ellipsis },
  { to: '/print', label: 'Print week', icon: Printer },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

/**
 * Cooking mode and the print sheet take over the screen: navigation would only
 * be something to hit by accident with wet hands, or ink on the page.
 */
function isImmersive(pathname: string): boolean {
  return /\/cook$/.test(pathname) || /\/print$/.test(pathname) || pathname.startsWith('/print')
}

export function AppShell() {
  const location = useLocation()
  const immersive = isImmersive(location.pathname)
  // Before the hook order matters: a linked household catches up on open.
  useHouseholdSync()

  if (immersive) {
    return (
      <>
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
        <UpdatePrompt />
      </>
    )
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>

      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <ChefHat size={22} aria-hidden="true" />
          <span>MealHelp</span>
        </div>
        <nav aria-label="Main">
          <ul className={styles.sidebarList}>
            {[...PRIMARY_NAV.filter((i) => i.to !== '/more'), ...SECONDARY_NAV].map(
              (item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? `${styles.sidebarLink} ${styles.active}` : styles.sidebarLink
                    }
                  >
                    <item.icon size={18} aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              ),
            )}
          </ul>
        </nav>
      </aside>

      <main id="main" className={styles.main}>
        {/* Scoped to the page so a failing screen keeps the navigation below
            it usable, instead of taking the whole app down. */}
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <nav className={styles.tabBar} aria-label="Main">
        <ul className={styles.tabList}>
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
                }
              >
                <item.icon size={21} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <UpdatePrompt />
    </div>
  )
}
