/**
 * Coming back to what you were reading.
 *
 * Installed to a home screen, MealHelp is relaunched rather than resumed: iOS
 * and Android are free to throw the page away while you are in a timer app or
 * answering a message, and what comes back is a cold start at the front door.
 * Mid-recipe — hands wet, half the onions chopped — that is the app losing
 * your place at the exact moment it mattered.
 *
 * So a recipe stays open until it is closed. Only screens somebody is *in the
 * middle of* count: leaving a recipe for the library is closing it, and the
 * library is not somewhere you resume.
 */

const KEY = 'mealhelp.lastPlace'

/** Long enough for a night's cooking, short enough that yesterday is over. */
const KEEP_MS = 12 * 60 * 60 * 1000

/** A recipe being read, or a recipe being cooked. Nothing else. */
const RESUMABLE = /^\/recipes\/[^/]+(\/cook)?$/

interface Place {
  path: string
  at: number
}

export function rememberPlace(path: string): void {
  try {
    if (!RESUMABLE.test(path.split('?')[0])) {
      // Somewhere else entirely: whatever was open has been closed.
      localStorage.removeItem(KEY)
      return
    }
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() } satisfies Place))
  } catch {
    // Private mode: the app simply starts at the front door, as it used to.
  }
}

export function placeToResume(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return undefined
    const place = JSON.parse(raw) as Place
    if (!place?.path || Date.now() - place.at > KEEP_MS) return undefined
    return RESUMABLE.test(place.path.split('?')[0]) ? place.path : undefined
  } catch {
    return undefined
  }
}
