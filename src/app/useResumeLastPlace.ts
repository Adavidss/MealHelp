import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { placeToResume, rememberPlace } from './lastPlace'

/**
 * Puts the app back where it was, once, on a cold start.
 *
 * Only when the app opens at the front door: arriving anywhere else — a link,
 * a scanned QR code, a reload with the route still in the address bar — means
 * somebody asked for that screen, and being redirected off it would be worse
 * than the problem this solves.
 */
export function useResumeLastPlace(): void {
  const location = useLocation()
  const navigate = useNavigate()
  const decided = useRef(false)

  useEffect(() => {
    if (!decided.current) {
      decided.current = true
      if (location.pathname === '/') {
        const place = placeToResume()
        if (place) {
          navigate(place, { replace: true })
          return
        }
      }
    }
    rememberPlace(`${location.pathname}${location.search}`)
  }, [location, navigate])
}
