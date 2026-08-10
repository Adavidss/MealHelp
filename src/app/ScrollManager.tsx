import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Scroll position across navigation.
 *
 * A single-page app keeps whatever scroll position it had, so tapping
 * "Recipes" halfway down a long recipe drops you halfway down the library —
 * on a phone that reads as the app being broken. Going forward always starts
 * at the top; going *back* restores where you were, because losing your place
 * in a long list is just as annoying.
 */
export function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const previousKey = useRef<string>(location.key)

  useEffect(() => {
    const remembered = positions.current

    // Record where the page being left was scrolled to.
    const leaving = previousKey.current
    if (leaving) remembered.set(leaving, window.scrollY)
    previousKey.current = location.key

    // A URL typed in or opened from a scanned QR code arrives as a POP with no
    // history entry of its own ("default"), and restoring some other page's
    // position onto it would be worse than useless.
    const hasOwnHistoryEntry = location.key !== 'default'

    if (navigationType === 'POP' && hasOwnHistoryEntry) {
      const saved = remembered.get(location.key)
      if (saved != null) {
        // Wait for the incoming page to render tall enough to scroll into.
        requestAnimationFrame(() => window.scrollTo(0, saved))
        return
      }
    }

    window.scrollTo(0, 0)
  }, [location.key, navigationType])

  return null
}
