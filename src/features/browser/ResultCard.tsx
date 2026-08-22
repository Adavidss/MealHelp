import { useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, UtensilsCrossed } from 'lucide-react'
import { useSettings } from '@/app/SettingsContext'
import {
  cachedPreviewImage,
  previewImage,
  resultTags,
  type WebSearchResult,
} from '@/services/pageBrowser'
import { TILE_PALETTES } from '@/components/meal/mealArtwork'
import styles from './ResultCard.module.css'

interface ResultCardProps {
  result: WebSearchResult
  external: boolean
  saved: boolean
  onOpen: (url: string) => void
}

/** The same deterministic wash the recipe cards use, so a result looks like a meal. */
function paletteFor(text: string): number {
  let hash = 2_166_136_261
  for (const character of text) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  hash ^= hash >>> 13
  return Math.abs(Math.imul(hash, 0x5bd1e995)) % TILE_PALETTES
}

/**
 * One search result, drawn the way MealHelp draws food.
 *
 * A recipe you have not saved yet is still a recipe, so it gets what every
 * other meal in the app gets: a picture, a name, and two or three words about
 * what it is. The picture is the page's own `og:image`, fetched only once the
 * card has been scrolled to — a results list that fetched twenty pages up
 * front would be slower than the search itself.
 */
export function ResultCard({ result, external, saved, onOpen }: ResultCardProps) {
  const { settings } = useSettings()
  const ref = useRef<HTMLLIElement>(null)
  const [image, setImage] = useState<string | null | undefined>(() =>
    cachedPreviewImage(result.url),
  )
  const tags = resultTags(result)

  useEffect(() => {
    if (image !== undefined) return
    const node = ref.current
    if (!node) return

    const controller = new AbortController()
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void previewImage(result.url, settings.importSettings, controller.signal).then(
          (found) => {
            if (!controller.signal.aborted) setImage(found)
          },
        )
      },
      // Start a little before the card arrives, so it is rarely seen empty.
      { rootMargin: '250px' },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      controller.abort()
    }
  }, [result.url, image, settings.importSettings])

  return (
    <li ref={ref}>
      <button type="button" className={styles.card} onClick={() => onOpen(result.url)}>
        <span
          className={`${styles.art} ${image ? '' : styles[`palette${paletteFor(result.title)}`]}`}
        >
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImage(null)}
            />
          ) : (
            <UtensilsCrossed size={22} aria-hidden="true" />
          )}
        </span>

        <span className={styles.body}>
          <span className={styles.host}>
            {result.host}
            {external ? (
              <span className={styles.externalBadge}>
                <ExternalLink size={11} aria-hidden="true" />
                opens in your browser
              </span>
            ) : null}
            {saved ? (
              <span className={styles.savedBadge}>
                <Check size={11} aria-hidden="true" />
                in your recipes
              </span>
            ) : null}
          </span>

          <span className={styles.title}>{result.title}</span>

          {tags.length ? (
            <span className={styles.tags}>
              {tags.map((tag) => (
                <span key={tag.id} className={styles.tag}>
                  {tag.label}
                </span>
              ))}
            </span>
          ) : null}

          {result.snippet ? <span className={styles.snippet}>{result.snippet}</span> : null}
        </span>
      </button>
    </li>
  )
}
