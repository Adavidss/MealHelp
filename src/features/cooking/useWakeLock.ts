import { useEffect, useState } from 'react'

/**
 * Keeps the screen on while cooking.
 *
 * Not every browser supports this (iOS Safari only gained it recently), so it
 * fails quietly — the alternative is nagging someone with wet hands about a
 * browser API. The lock is also re-taken when the tab becomes visible again,
 * because the platform drops it whenever the screen is locked.
 */
export function useWakeLock(enabled: boolean): { active: boolean; supported: boolean } {
  const [active, setActive] = useState(false)
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  useEffect(() => {
    if (!enabled || !supported) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void sentinel.release()
          return
        }
        setActive(true)
        sentinel.addEventListener('release', () => setActive(false))
      } catch {
        setActive(false)
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      void sentinel?.release().catch(() => undefined)
      setActive(false)
    }
  }, [enabled, supported])

  return { active, supported }
}
