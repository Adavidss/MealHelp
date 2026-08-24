import type {
  CookingMethod,
  DayLoad,
  PlanScope,
  PlanningRequest,
  VarietyMode,
} from '@/models'

/**
 * What the wizard is holding while somebody sets a week up.
 *
 * Its own module because the wizard's sections take it as a prop, and a screen
 * of this size is only splittable if its sections do not have to import the
 * screen to know what they are given.
 */
export interface Preferences {
  mealsNeeded: number
  targetCookSessions: number
  preferLeftovers: boolean
  preferredMethods: CookingMethod[]
  requiredMethods: CookingMethod[]
  variety: VarietyMode
  usePantryFirst: boolean
  avoidRecentlyCooked: boolean
  servingsPerMeal: number
  dayLoads: Record<string, DayLoad>
  selectedDates: string[]
  useUp: string
  /** Which meals to fill in — the rest of the day is left as it is. */
  scope: PlanScope
  /** What the week has to fit inside. Any of them may be left unset. */
  budget?: number
  maxMinutesPerMeal?: number
  proteinPerDay?: number
  maxActiveTimeMinutes?: number
  preferredEffort?: PlanningRequest['preferredEffort']
  budgetPreference?: PlanningRequest['budgetPreference']
}
