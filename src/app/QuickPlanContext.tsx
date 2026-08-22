import { createContext, use, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Recipe } from '@/models'
import { QuickPlanBar } from '@/features/planner/QuickPlanBar'

interface QuickPlanContextValue {
  /** Start placing a meal: the day strip slides up and waits for one tap. */
  planMeal: (recipe: Recipe) => void
  cancel: () => void
  /** The meal being placed, if any — cards use it to show themselves as picked. */
  pending?: Recipe
}

const QuickPlanContext = createContext<QuickPlanContextValue | null>(null)

/**
 * Putting a meal on a day, in two taps and no screens.
 *
 * The old route was: card → dialog → choose meal type → choose day → saved.
 * Four decisions for something people do while scrolling. This keeps the
 * scrolling where it is: tap + on any meal card anywhere in the app, a strip
 * of days slides up over the tab bar, tap a day, done — with an undo in the
 * toast because a mis-tap costs one tap to fix.
 *
 * It lives at the app root so a card in Recipes, in the browser's results or
 * in tonight's hero all reach the same strip, and so the strip survives the
 * card being scrolled off screen.
 */
export function QuickPlanProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Recipe>()

  const planMeal = useCallback((recipe: Recipe) => setPending(recipe), [])
  const cancel = useCallback(() => setPending(undefined), [])

  const value = useMemo(() => ({ planMeal, cancel, pending }), [planMeal, cancel, pending])

  return (
    <QuickPlanContext value={value}>
      {children}
      {pending ? <QuickPlanBar recipe={pending} onClose={cancel} /> : null}
    </QuickPlanContext>
  )
}

export function useQuickPlan(): QuickPlanContextValue {
  const context = use(QuickPlanContext)
  if (!context) throw new Error('useQuickPlan must be used inside QuickPlanProvider')
  return context
}
