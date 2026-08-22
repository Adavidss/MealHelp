import { Link } from 'react-router-dom'
import {
  Activity,
  ChevronRight,
  Download,
  History as HistoryIcon,
  Library,
  Package,
  Printer,
  Settings as SettingsIcon,
} from 'lucide-react'
import styles from './MorePage.module.css'

const LINKS = [
  {
    to: '/plan?tab=nutrition',
    label: 'Nutrition',
    description: 'Calories and macros, per day and per week',
    icon: Activity,
  },
  {
    to: '/plan?tab=history',
    label: 'History',
    description: 'Past weeks and what you cooked',
    icon: HistoryIcon,
  },
  {
    to: '/grocery?tab=pantry',
    label: 'Pantry',
    description: 'Things you usually have',
    icon: Package,
  },
  {
    to: '/recipes?tab=collections',
    label: 'Collections',
    description: 'Group recipes your own way',
    icon: Library,
  },
  {
    to: '/import',
    label: 'Import a recipe',
    description: 'From a link, pasted text, or the MealHelp button',
    icon: Download,
  },
  {
    to: '/print',
    label: 'Print this week',
    description: 'A sheet for the refrigerator',
    icon: Printer,
  },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Themes, kitchen, planning and your data',
    icon: SettingsIcon,
  },
]

/** The phone's overflow menu. Desktop shows all of this in the sidebar instead. */
export function MorePage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">More</h1>
        </div>
      </header>

      <ul className={styles.list}>
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={styles.row}>
              <link.icon size={20} aria-hidden="true" />
              <span className={styles.text}>
                <strong>{link.label}</strong>
                <small>{link.description}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" className={styles.chevron} />
            </Link>
          </li>
        ))}
      </ul>

      <p className={styles.footer}>
        MealHelp keeps everything on this device. Export a backup from Settings if
        you want a copy.
      </p>
    </div>
  )
}
