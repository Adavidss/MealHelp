import type { CookingMethod, EffortLevel, VarietyMode } from '@/models'

/**
 * The quick buttons on the planning screen.
 *
 * A preset only fills in the constraints — it never picks the meals itself. The
 * same recommendation engine still does the choosing, so a preset behaves like
 * a shortcut through the form rather than a second, hidden planner.
 */
export interface PlanPreset {
  id: string
  label: string
  description: string
  patch: {
    targetCookSessions?: number
    preferLeftovers?: boolean
    preferredMethods?: CookingMethod[]
    requiredMethods?: CookingMethod[]
    preferredEffort?: EffortLevel
    variety?: VarietyMode
    usePantryFirst?: boolean
    budgetPreference?: '$' | '$$' | '$$$'
    maxActiveTimeMinutes?: number
  }
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: 'easy-week',
    label: 'Easy week',
    description: 'Low effort, nothing fussy',
    patch: { preferredEffort: 'low', maxActiveTimeMinutes: 35, preferLeftovers: true },
  },
  {
    id: 'cheap-week',
    label: 'Cheap week',
    description: 'Keep the shop down',
    patch: { budgetPreference: '$', usePantryFirst: true, preferLeftovers: true },
  },
  {
    id: 'minimal-cooking',
    label: 'Minimal cooking',
    description: 'Cook twice, eat well all week',
    patch: { targetCookSessions: 2, preferLeftovers: true, preferredEffort: 'low' },
  },
  {
    id: 'mostly-leftovers',
    label: 'Mostly leftovers',
    description: 'Big batches, few dishes',
    patch: { targetCookSessions: 2, preferLeftovers: true },
  },
  {
    id: 'meal-prep',
    label: 'Meal prep week',
    description: 'Cook once or twice, portion it out',
    patch: { targetCookSessions: 2, preferLeftovers: true, variety: 'mostly-favorites' },
  },
  {
    id: 'crockpot',
    label: 'Crock-Pot heavy',
    description: 'Set it in the morning',
    patch: {
      preferredMethods: ['slow-cooker'],
      requiredMethods: ['slow-cooker'],
      preferLeftovers: true,
    },
  },
  {
    id: 'instant-pot',
    label: 'Instant Pot heavy',
    description: 'Fast under pressure',
    patch: {
      preferredMethods: ['instant-pot'],
      requiredMethods: ['instant-pot'],
      preferLeftovers: true,
    },
  },
  {
    id: 'use-pantry',
    label: 'Use the pantry',
    description: 'Shop as little as possible',
    patch: { usePantryFirst: true },
  },
  {
    id: 'favorites',
    label: 'Favorites only',
    description: 'Nothing new this week',
    patch: { variety: 'mostly-favorites' },
  },
]
