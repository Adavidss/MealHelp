import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Compass,
  Download,
  History as HistoryIcon,
  Library,
  Package,
  Printer,
  Refrigerator,
  Settings as SettingsIcon,
} from 'lucide-react'
import styles from './MorePage.module.css'

const LINKS = [
  {
    to: '/discover',
    label: 'Discover recipes',
    description: 'Find something new online',
    icon: Compass,
  },
  { to: '/pantry', label: 'Pantry', description: 'Things you usually have', icon: Package },
  {
    to: '/collections',
    label: 'Collections',
    description: 'Group recipes your own way',
    icon: Library,
  },
  {
    to: '/recipes/what-can-i-make',
    label: 'What can I make?',
    description: 'Match recipes to what you have',
    icon: Refrigerator,
  },
  {
    to: '/history',
    label: 'History',
    description: 'Past weeks and what you cooked',
    icon: HistoryIcon,
  },
  {
    to: '/print',
    label: 'Print this week',
    description: 'A sheet for the refrigerator',
    icon: Printer,
  },
  { to: '/import', label: 'Import a recipe', description: 'From a link or pasted text', icon: Download },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Kitchen, planning and your data',
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
