/**
 * Telling somebody their timer finished when they are not looking at MealHelp.
 *
 * The chime only reaches a cook who still has the app in front of them, which
 * is not what a timer is for — you set one *because* you are going to do
 * something else. A notification reaches the phone's own notification screen,
 * which is where every other timer they own already speaks to them.
 *
 * What this deliberately does not do is promise more than a web app can keep.
 * There is no reliable way to schedule a notification for a page that has been
 * put to sleep, so this fires at the moment the timer finishes, from a page
 * that is still running — a backgrounded tab on a computer or an Android
 * phone. Where the page was suspended instead, the timer is found finished on
 * the way back and says how long ago, which is the honest version of the same
 * information.
 */

const ASKED_KEY = 'mealhelp.notificationsAsked'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationsAllowed(): boolean {
  return notificationsSupported() && Notification.permission === 'granted'
}

/**
 * Asked from inside the tap that starts a timer, which is the only moment a
 * browser will show the prompt and the only moment it makes sense to a cook.
 * Asked once ever: a refusal is an answer, not an invitation to ask again.
 */
export async function askToNotify(): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'default') return
  try {
    if (localStorage.getItem(ASKED_KEY)) return
    localStorage.setItem(ASKED_KEY, '1')
  } catch {
    // Private mode: asking once per session is close enough.
  }
  try {
    await Notification.requestPermission()
  } catch {
    // Refused, dismissed, or blocked at the browser level: the chime remains.
  }
}

export function notifyTimerDone(label: string, lateByMs = 0): void {
  if (!notificationsAllowed()) return
  const minutesLate = Math.round(lateByMs / 60_000)
  try {
    new Notification('Timer finished', {
      body: minutesLate >= 1 ? `${label} — finished ${minutesLate} min ago` : label,
      tag: `mealhelp-${label}`,
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
      badge: `${import.meta.env.BASE_URL}icon-192.png`,
    })
  } catch {
    // Some browsers only allow this from a service worker; the chime covers it.
  }
}
