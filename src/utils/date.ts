/**
 * Dates in MealHelp are calendar days, not instants: "Monday's dinner" means
 * the same thing whatever the clock says. Everything is therefore stored as a
 * YYYY-MM-DD string and converted through local midnight, never through UTC
 * parsing (`new Date('2026-08-10')` is UTC and shifts the day for anyone west
 * of Greenwich).
 */

export type ISODate = string

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = fromISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = fromISODate(from).getTime()
  const b = fromISODate(to).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Whole days since an ISO *timestamp*, used for "cooked 6 weeks ago". */
export function daysSince(isoTimestamp: string | undefined): number | undefined {
  if (!isoTimestamp) return undefined
  const then = new Date(isoTimestamp)
  if (Number.isNaN(then.getTime())) return undefined
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86_400_000))
}

export function startOfWeek(iso: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  const date = fromISODate(iso)
  const day = date.getDay()
  const diff = (day - weekStartsOn + 7) % 7
  date.setDate(date.getDate() - diff)
  return toISODate(date)
}

export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

const DAY_LONG = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const DAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const MONTH_DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const MONTH_DAY_LONG = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
})

export function dayName(iso: ISODate): string {
  return DAY_LONG.format(fromISODate(iso))
}

export function dayNameShort(iso: ISODate): string {
  return DAY_SHORT.format(fromISODate(iso))
}

export function monthDay(iso: ISODate): string {
  return MONTH_DAY.format(fromISODate(iso))
}

/** "August 10–16" — the heading on the planner and the printed sheet. */
export function formatWeekRange(weekStart: ISODate): string {
  const end = addDays(weekStart, 6)
  const startDate = fromISODate(weekStart)
  const endDate = fromISODate(end)
  const sameMonth = startDate.getMonth() === endDate.getMonth()
  const left = MONTH_DAY_LONG.format(startDate)
  const right = sameMonth
    ? String(endDate.getDate())
    : MONTH_DAY_LONG.format(endDate)
  return `${left}–${right}`
}

/** "Today", "Tomorrow", "Yesterday", else "Wednesday". */
export function relativeDayLabel(iso: ISODate, today: ISODate = todayISO()): string {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return dayName(iso)
}

/** "45 min", "1 hr", "1 hr 30 min" — never "0 min". */
export function formatMinutes(minutes: number | undefined): string | undefined {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return undefined
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded} min`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  const hourPart = `${hours} hr`
  return rest ? `${hourPart} ${rest} min` : hourPart
}

/** "6 weeks ago", used in recommendation explanations. */
export function humanAgo(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `${weeks} weeks ago`
  const months = Math.round(days / 30)
  return months < 2 ? 'last month' : `${months} months ago`
}
