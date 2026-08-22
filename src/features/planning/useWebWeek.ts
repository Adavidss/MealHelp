import { useCallback, useRef, useState } from 'react'
import type { Recipe, RecipeDraft } from '@/models'
import {
  activeProviders,
  providerById,
  searchAllProviders,
  theMealDbProvider,
  type DiscoveryResult,
  type ProviderOptions,
} from '@/services/recipeDiscovery'
import { pickSurprise, rememberPick } from '@/utils/surprise'
import { newId, nowISO } from '@/utils/id'

/**
 * A shortlist of recipes nobody owns yet, ready for the planner.
 *
 * Fetching a recipe is a request per recipe, so this asks for a few more than
 * the week needs — the planner wants some choice, and a source occasionally
 * has a listing it cannot then produce — and stops as soon as it has enough.
 *
 * Nothing is saved. The recipes come back as ordinary Recipe objects with
 * provisional ids so the planner, the cards and the preview can all treat
 * them exactly like the user's own; only accepting the plan writes them to
 * the library, which is what keeps "nothing is saved until you accept" true.
 */

export const PROVISIONAL_PREFIX = 'web-'

export function isProvisional(recipeId: string | undefined): boolean {
  return Boolean(recipeId?.startsWith(PROVISIONAL_PREFIX))
}

/** A draft dressed as a recipe, so every screen can treat it like one. */
export function provisionalRecipe(draft: RecipeDraft, index: number): Recipe {
  const now = nowISO()
  return {
    ...draft,
    id: `${PROVISIONAL_PREFIX}${index}-${newId('r')}`,
    favorite: false,
    timesCooked: 0,
    createdAt: now,
    updatedAt: now,
  } as Recipe
}

export interface WebWeekState {
  busy: boolean
  /** How far along, for a wait that is measured in requests rather than ms. */
  progress?: { found: number; wanted: number }
  error?: string
}

export function useWebWeek(providerOptions: ProviderOptions) {
  const [state, setState] = useState<WebWeekState>({ busy: false })
  const inFlight = useRef<AbortController>(null)
  /** Across rolls, so "surprise me" twice does not fetch the same dinners. */
  const seen = useRef<string[]>([])

  const cancel = useCallback(() => {
    inFlight.current?.abort()
    setState({ busy: false })
  }, [])

  const gather = useCallback(
    async (queries: string[], wanted: number): Promise<Recipe[]> => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      setState({ busy: true, progress: { found: 0, wanted } })

      const providers = activeProviders(providerOptions)
      const pool: DiscoveryResult[] = []

      try {
        // Ask a few different things rather than one thing repeatedly: a week
        // of one search is a week of one dish.
        for (const query of queries.slice(0, 4)) {
          if (controller.signal.aborted) return []
          if (pool.length >= wanted * 3) break
          const { results } = await searchAllProviders(providers, (provider) =>
            provider.searchByText(query, controller.signal),
          )
          for (const result of results) {
            const key = `${result.providerId}:${result.externalId}`
            if (!pool.some((entry) => `${entry.providerId}:${entry.externalId}` === key)) {
              pool.push(result)
            }
          }
        }

        if (!pool.length) {
          setState({ busy: false, error: 'The recipe databases had nothing to offer just now.' })
          return []
        }

        const recipes: Recipe[] = []
        const asItems = pool.map((result) => ({
          id: `${result.providerId}:${result.externalId}`,
          result,
        }))

        // Pick at random rather than taking the first few: the first few are
        // the same every time, which is not a surprise.
        while (recipes.length < wanted && asItems.length) {
          if (controller.signal.aborted) return []
          const choice = pickSurprise(asItems, seen.current)
          if (!choice) break
          asItems.splice(asItems.indexOf(choice), 1)
          seen.current = rememberPick(seen.current, choice.id)

          const source =
            providerById(choice.result.providerId, providerOptions) ?? theMealDbProvider
          try {
            const draft = await source.fetchRecipe(choice.result.externalId)
            // A listing with no ingredients cannot be shopped for or cooked,
            // so it is quietly skipped rather than planned.
            if (!draft.ingredients.length) continue
            recipes.push(provisionalRecipe(draft, recipes.length))
            setState({ busy: true, progress: { found: recipes.length, wanted } })
          } catch {
            // One source failing to produce a recipe it listed is not a
            // reason to abandon the week.
            continue
          }
        }

        if (controller.signal.aborted) return []
        setState({ busy: false })
        return recipes
      } catch {
        if (controller.signal.aborted) return []
        setState({
          busy: false,
          error: 'MealHelp could not reach the recipe databases just now.',
        })
        return []
      }
    },
    [providerOptions],
  )

  return { ...state, gather, cancel }
}
