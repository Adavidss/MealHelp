import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { useSettings } from '@/app/SettingsContext'
import { loadPriceBook } from '@/db/prices'
import { pantryKeySet } from '@/db/pantry'
import type { Recipe } from '@/models'
import { formatMoney, recipeCost } from '@/services/pricing'

/**
 * What a serving of this costs, for the corner of a card.
 *
 * Per serving rather than per recipe, because a card is for comparing: a pot
 * of chili costing more than a salad says nothing until you know it feeds
 * six. Undefined when too little of the recipe could be priced to be worth
 * claiming a number — a card is no place for a figure that needs a caveat.
 *
 * The price book and pantry are read live, so correcting the price of beef
 * once updates every card that uses it.
 */
export function useServingCost(recipe: Recipe): string | undefined {
  const { settings } = useSettings()
  const ownPrices = useLiveQuery(() => loadPriceBook(), [], new Map())
  const pantryKeys = useLiveQuery(() => pantryKeySet(), [], new Set<string>())

  return useMemo(() => {
    if (!recipe.ingredients?.length) return undefined
    const cost = recipeCost(recipe, { ownPrices, pantryKeys })
    // Most of it has to be priced for the number to mean anything.
    if (cost.perServing == null || cost.pricedCount < cost.lines.length * 0.7) return undefined
    return formatMoney(cost.perServing, settings.currency ?? '$')
  }, [recipe, ownPrices, pantryKeys, settings.currency])
}
