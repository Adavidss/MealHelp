import { Link } from 'react-router-dom'
import { Dices, Clock, Globe, X } from 'lucide-react'
import { STARTING_SITES, type RecentPage } from '@/services/pageBrowser'
import styles from './StartPage.module.css'

interface StartPageProps {
  recent: RecentPage[]
  onOpen: (url: string) => void
  onSearch: (query: string) => void
  /** A random dish, searched for you. */
  onSurprise: () => void
  onClearRecent: () => void
}

const SUGGESTIONS = ['weeknight chicken', 'slow cooker chili', 'one pot pasta', 'lentil soup']

/**
 * What the browser shows before you have gone anywhere: a way in for people
 * who know what they want (search), for people who know where they like to
 * cook from (sites), and for people picking up where they left off (recent).
 */
export function StartPage({
  recent,
  onOpen,
  onSearch,
  onSurprise,
  onClearRecent,
}: StartPageProps) {
  return (
    <div className={styles.start}>
      <section className={styles.section}>
        <h2 className={styles.heading}>Try searching for</h2>
        <div className={styles.chips}>
          {/* First, because "what should I even look for" is the hard part
              of an empty search box. */}
          <button
            type="button"
            className={`chip chip-button ${styles.surprise}`}
            onClick={onSurprise}
          >
            <Dices size={14} aria-hidden="true" />
            Surprise me
          </button>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip chip-button"
              onClick={() => onSearch(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {recent.length ? (
        <section className={styles.section}>
          <h2 className={styles.heading}>
            <Clock size={15} aria-hidden="true" />
            Recently viewed
            <button
              type="button"
              className={styles.clear}
              onClick={onClearRecent}
              aria-label="Clear recently viewed"
            >
              <X size={14} aria-hidden="true" />
              Clear
            </button>
          </h2>
          <ul className={styles.recentList}>
            {recent.map((page) => (
              <li key={page.url}>
                <button type="button" className={styles.recentRow} onClick={() => onOpen(page.url)}>
                  <span className={styles.recentTitle}>{page.title}</span>
                  <span className={styles.recentHost}>{page.host}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.heading}>
          <Globe size={15} aria-hidden="true" />
          Places to start
        </h2>
        <p className={styles.lead}>
          Sites that open here today. Find a recipe, then tap <strong>Add</strong>.
        </p>
        <ul className={styles.siteGrid}>
          {STARTING_SITES.map((site) => (
            <li key={site.url}>
              <button type="button" className={styles.siteCard} onClick={() => onOpen(site.url)}>
                <span className={styles.siteName}>{site.name}</span>
                <span className={styles.siteBlurb}>{site.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.footnote}>
        Pages open with scripts off — no pop-ups, no cookie walls, just the
        page. A few big publishers only answer a real browser; those open in
        yours, where the <Link to="/import">MealHelp button</Link> still works.
      </p>
    </div>
  )
}
