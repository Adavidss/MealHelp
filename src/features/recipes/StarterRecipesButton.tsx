import { useState } from 'react'
import { db } from '@/db/database'
import { saveRecipe } from '@/db/recipes'
import { useToast } from '@/components/common/Toast'
import { STARTER_RECIPE_COUNT, starterRecipeDrafts } from './starterRecipes'

/**
 * Adds the shipped recipes. They are added, never forced: existing titles are
 * skipped so pressing this twice does not duplicate anybody's library.
 */
export function StarterRecipesButton({ label }: { label?: string }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    try {
      const existing = await db.recipes.toArray()
      const titles = new Set(existing.map((recipe) => recipe.title.toLowerCase()))
      const drafts = starterRecipeDrafts().filter(
        (draft) => !titles.has(draft.title.toLowerCase()),
      )
      for (const draft of drafts) await saveRecipe(draft)
      toast(
        drafts.length
          ? `Added ${drafts.length} starter recipe${drafts.length === 1 ? '' : 's'}.`
          : 'You already have all of the starter recipes.',
        { tone: 'success' },
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => void add()}
      disabled={busy}
    >
      {label ?? `Add ${STARTER_RECIPE_COUNT} starter recipes`}
    </button>
  )
}
