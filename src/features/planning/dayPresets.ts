/**
 * Whole week, weekdays, weekend.
 *
 * A weekly planner that quietly stopped on Friday left out the two days most
 * people actually cook on, so the whole week is the default and the other two
 * are one tap. Picking a preset moves the meal count with it — asking for
 * seven days of dinners while still set to five is a form fighting itself.
 */
export const DAY_PRESETS: Array<{
  id: string
  label: string
  pick: (dates: string[]) => string[]
}> = [
  { id: 'all', label: 'Whole week', pick: (dates) => [...dates] },
  {
    id: 'weekdays',
    label: 'Weekdays',
    pick: (dates) => dates.filter((date) => ![0, 6].includes(new Date(`${date}T12:00:00`).getDay())),
  },
  {
    id: 'weekend',
    label: 'Weekend',
    pick: (dates) => dates.filter((date) => [0, 6].includes(new Date(`${date}T12:00:00`).getDay())),
  },
]
