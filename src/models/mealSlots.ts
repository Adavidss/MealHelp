import type { MealSlotConfig, MealType, Settings } from './index'
import { DEFAULT_MEAL_SLOTS, MEAL_TYPE_LABELS } from './index'

/**
 * Helpers for reading a day's slots.
 *
 * Slots replaced a plain list of meal types, so everything that used to ask
 * "which meal types are visible?" asks one of these instead. They are plain
 * functions rather than methods because settings are a data object read in
 * components, tests and the planner alike.
 */

/** Every slot that applies on a given ISO date, in eating order. */
export function slotsForDate(slots: MealSlotConfig[], date: string): MealSlotConfig[] {
  const weekday = new Date(`${date}T00:00:00`).getDay()
  return slots.filter((slot) => !slot.daysOfWeek?.length || slot.daysOfWeek.includes(weekday))
}

/** The distinct kinds in play, for screens that still group by meal type. */
export function slotMealTypes(slots: MealSlotConfig[]): MealType[] {
  return [...new Set(slots.map((slot) => slot.type))]
}

export function slotById(
  slots: MealSlotConfig[],
  id: string | undefined,
): MealSlotConfig | undefined {
  return id ? slots.find((slot) => slot.id === id) : undefined
}

/**
 * What to call a planned meal's slot.
 *
 * A meal stores its slot id, but a slot the user has since deleted must not
 * leave the week showing nothing — so the base meal type is the fallback.
 */
export function slotLabel(
  slots: MealSlotConfig[],
  meal: { slotId?: string; mealType: MealType },
): string {
  return slotById(slots, meal.slotId)?.label ?? MEAL_TYPE_LABELS[meal.mealType]
}

/** The slot a meal belongs to, matching on id first and kind as a fallback. */
export function slotForMeal(
  slots: MealSlotConfig[],
  meal: { slotId?: string; mealType: MealType },
): MealSlotConfig | undefined {
  return slotById(slots, meal.slotId) ?? slots.find((slot) => slot.type === meal.mealType)
}

/** Where a new meal goes when nothing says otherwise: the first cooking slot. */
export function defaultSlot(settings: Pick<Settings, 'mealSlots'>): MealSlotConfig {
  const slots = settings.mealSlots?.length ? settings.mealSlots : DEFAULT_MEAL_SLOTS
  return slots.find((slot) => slot.fill === 'cook') ?? slots[0]
}

/**
 * Settings written before slots existed carried a list of meal types. They
 * become one cooking slot each, in the order people eat them, so an upgrade
 * changes nothing about what the planner shows.
 */
export function slotsFromMealTypes(types: MealType[]): MealSlotConfig[] {
  const order: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
  const sorted = [...new Set(types)].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  if (!sorted.length) return DEFAULT_MEAL_SLOTS
  return sorted.map((type) => ({
    id: type,
    label: MEAL_TYPE_LABELS[type],
    type,
    // Breakfast was never really a cooking decision, but a migration must not
    // invent a routine the user never typed — so everything arrives as "cook"
    // and can be changed in Settings.
    fill: 'cook' as const,
  }))
}
