import { useCallback, useSyncExternalStore } from 'react'
import { newId } from '@/utils/id'
import { buzz, playChime, primeChime } from './chime'
import { askToNotify, notifyTimerDone } from './notifications'

export interface KitchenTimer {
  id: string
  label: string
  /** Wall-clock end time, so the countdown stays right if the tab sleeps. */
  endsAt: number
  totalMs: number
  remainingMs: number
  done: boolean
  /** So the bar can take you back to the pot this belongs to. */
  recipeId?: string
}

/**
 * The kitchen's timers, which belong to the kitchen and not to a screen.
 *
 * They used to live inside the cooking page, so stepping out to look at the
 * whole recipe — or a phone deciding to reload the page while it sat on the
 * counter — silently threw away the twenty minutes somebody was counting on.
 * Now they are one store: shared by every screen that shows them, written down
 * as they change, and restored by end time so a timer that survives a reload
 * is still right to the second.
 */

const STORAGE_KEY = 'mealhelp.timers'

/** An alarm nobody dismissed within the hour has served its purpose. */
const STALE_MS = 60 * 60 * 1000

function tick(timers: KitchenTimer[]): KitchenTimer[] {
  return timers.map((timer) => {
    const remainingMs = Math.max(0, timer.endsAt - Date.now())
    return { ...timer, remainingMs, done: remainingMs === 0 }
  })
}

function load(): KitchenTimer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const stored = JSON.parse(raw) as KitchenTimer[]
    return tick(stored.filter((timer) => Date.now() - timer.endsAt < STALE_MS))
  } catch {
    return []
  }
}

function save(timers: KitchenTimer[]): void {
  try {
    if (timers.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(timers))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode: timers last as long as the app is open, as they used to.
  }
}

let timers: KitchenTimer[] = load()
const listeners = new Set<() => void>()

/*
 * A timer already finished when the app opened does not chime on arrival: the
 * cook was not there to hear it, and what they came back for is the countdown,
 * not the alarm.
 */
const alerted = new Set<string>(timers.filter((timer) => timer.done).map((timer) => timer.id))

let interval: number | undefined

function publish(next: KitchenTimer[]): void {
  timers = next
  save(next)
  for (const listener of listeners) listener()
}

function running(): void {
  if (interval != null || !timers.length) return
  interval = window.setInterval(() => {
    const next = tick(timers)
    for (const timer of next) {
      if (!timer.done || alerted.has(timer.id)) continue
      alerted.add(timer.id)
      playChime()
      buzz()
      /*
       * Only when they are not looking. A cook watching the screen has the
       * chime and the countdown; adding a notification to that is noise on the
       * lock screen for something they already know.
       */
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        notifyTimerDone(timer.label, Date.now() - timer.endsAt)
      }
    }
    publish(next)
    if (!next.length) stop()
  }, 500)
}

function stop(): void {
  if (interval == null) return
  window.clearInterval(interval)
  interval = undefined
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  running()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) stop()
  }
}

/**
 * Several timers can run at once, because a real dinner has rice and a roast
 * going at the same time. Nothing starts by itself — a timer only ever exists
 * because someone pressed a button.
 */
export function useTimers() {
  const current = useSyncExternalStore(
    subscribe,
    () => timers,
    () => timers,
  )

  const start = useCallback((minutes: number, label: string, recipeId?: string) => {
    // Unlocking audio here, inside the tap that starts the timer, is what lets
    // iOS play the chime when it finishes minutes later — and the same tap is
    // the only moment a browser will show the notification prompt.
    primeChime()
    void askToNotify()
    const totalMs = Math.round(minutes * 60_000)
    publish([
      ...timers,
      {
        id: newId('timer'),
        label,
        endsAt: Date.now() + totalMs,
        totalMs,
        remainingMs: totalMs,
        done: false,
        recipeId,
      },
    ])
    running()
  }, [])

  const dismiss = useCallback((id: string) => {
    publish(timers.filter((timer) => timer.id !== id))
  }, [])

  const clearAll = useCallback(() => publish([]), [])

  return { timers: current, start, dismiss, clearAll }
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
