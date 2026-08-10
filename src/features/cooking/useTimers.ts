import { useCallback, useEffect, useRef, useState } from 'react'
import { newId } from '@/utils/id'

export interface KitchenTimer {
  id: string
  label: string
  /** Wall-clock end time, so the countdown stays right if the tab sleeps. */
  endsAt: number
  totalMs: number
  remainingMs: number
  done: boolean
}

/**
 * Several timers can run at once, because a real dinner has rice and a roast
 * going at the same time. Nothing starts by itself — a timer only ever exists
 * because someone pressed a button.
 */
export function useTimers() {
  const [timers, setTimers] = useState<KitchenTimer[]>([])
  const alerted = useRef(new Set<string>())

  useEffect(() => {
    if (!timers.length) return
    const interval = window.setInterval(() => {
      setTimers((current) =>
        current.map((timer) => {
          const remainingMs = Math.max(0, timer.endsAt - Date.now())
          return { ...timer, remainingMs, done: remainingMs === 0 }
        }),
      )
    }, 500)
    return () => window.clearInterval(interval)
  }, [timers.length])

  useEffect(() => {
    for (const timer of timers) {
      if (!timer.done || alerted.current.has(timer.id)) continue
      alerted.current.add(timer.id)
      // A short buzz is enough; a sound would be unwelcome and often muted.
      navigator.vibrate?.([200, 100, 200])
    }
  }, [timers])

  const start = useCallback((minutes: number, label: string) => {
    const totalMs = Math.round(minutes * 60_000)
    setTimers((current) => [
      ...current,
      {
        id: newId('timer'),
        label,
        endsAt: Date.now() + totalMs,
        totalMs,
        remainingMs: totalMs,
        done: false,
      },
    ])
  }, [])

  const dismiss = useCallback((id: string) => {
    setTimers((current) => current.filter((timer) => timer.id !== id))
  }, [])

  const clearAll = useCallback(() => setTimers([]), [])

  return { timers, start, dismiss, clearAll }
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
