/**
 * A half-finished "add to grocery list".
 *
 * Going through a long ingredient list unticking what is already in the
 * cupboard is real work, and it is exactly the moment somebody gets
 * interrupted — a text arrives, the kettle boils, they go and check whether
 * there is any rice left. Coming back to a blank list and starting again is
 * the sort of thing that stops people using the feature at all.
 *
 * So the draft is kept, per recipe, until it is either added or the recipe's
 * ingredients change underneath it.
 */

const KEY = 'mealhelp.groceryDraft'

/** A draft older than this is a different shop. */
const KEEP_MS = 3 * 24 * 60 * 60 * 1000

export interface GroceryDraft {
  week: string
  servings: number
  excluded: string[]
  at: number
}

type Stored = Record<string, GroceryDraft>

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : {}
  } catch {
    return {}
  }
}

function write(value: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Private mode: the draft lasts as long as the dialog stays open.
  }
}

export function readGroceryDraft(recipeId: string): GroceryDraft | undefined {
  const draft = read()[recipeId]
  if (!draft) return undefined
  if (Date.now() - draft.at > KEEP_MS) return undefined
  return draft
}

export function saveGroceryDraft(
  recipeId: string,
  draft: Omit<GroceryDraft, 'at'>,
): void {
  const stored = read()
  stored[recipeId] = { ...draft, at: Date.now() }
  write(stored)
}

/** Added, or cancelled deliberately: either way there is nothing left to resume. */
export function clearGroceryDraft(recipeId: string): void {
  const stored = read()
  if (!(recipeId in stored)) return
  delete stored[recipeId]
  write(stored)
}
