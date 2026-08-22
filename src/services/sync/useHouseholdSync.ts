import { useEffect, useRef } from 'react'
import { useSettings } from '@/app/SettingsContext'
import { loadHousehold, syncNow } from './household'

/** Often enough to feel live while cooking, rare enough not to be chatter. */
const MIN_GAP_MS = 60_000

/**
 * Syncing without anybody pressing anything.
 *
 * The moments that matter are opening the app and coming back to it — one
 * person adds a recipe on the sofa, the other picks up their phone in the
 * kitchen and it is there. Failures are silent on purpose: a household that
 * cannot reach the network is a working app with slightly old data, not an
 * error worth interrupting dinner for. The Settings panel is where a sync is
 * asked for out loud, and where it reports back.
 */
export function useHouseholdSync(): void {
  const { reload } = useSettings()
  const running = useRef(false)
  const lastAt = useRef(0)

  useEffect(() => {
    const run = async () => {
      if (!loadHousehold() || running.current) return
      if (Date.now() - lastAt.current < MIN_GAP_MS) return
      running.current = true
      try {
        const outcome = await syncNow()
        lastAt.current = Date.now()
        // Meal slots and planning defaults are read through a context, so a
        // changed settings row has to be pulled back in by hand.
        if (outcome.status === 'ok' && outcome.written > 0) await reload()
      } finally {
        running.current = false
      }
    }

    void run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }
    const onOnline = () => void run()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [reload])
}
