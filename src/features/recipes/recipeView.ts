/**
 * How a recipe was left.
 *
 * Doubling a recipe, going to the grocery list to check something and coming
 * back to find it at 1× again is the kind of small betrayal that makes an app
 * feel unreliable — and the mistake it invites (cooking the unscaled amount)
 * is a real one. So the scale is remembered per recipe, on this device, until
 * the recipe is set back to 1×.
 */

const KEY = 'mealhelp.recipeScale'

/**
 * A week: long enough to cover the batch you are cooking through, short enough
 * that a recipe opened next month is not mysteriously still at 3×.
 */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000

interface Stored {
  [recipeId: string]: { scale: number; at: number }
}

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
    // Private mode: the scale still holds for as long as the page is open.
  }
}

export function rememberedScale(recipeId: string | undefined): number | undefined {
  if (!recipeId) return undefined
  const entry = read()[recipeId]
  if (!entry) return undefined
  if (Date.now() - entry.at > KEEP_MS) return undefined
  return entry.scale > 0 ? entry.scale : undefined
}

export function rememberScale(recipeId: string | undefined, scale: number): void {
  if (!recipeId) return
  const stored = read()
  // Back to normal is not worth remembering, and clearing keeps the list small.
  if (scale === 1) delete stored[recipeId]
  else stored[recipeId] = { scale, at: Date.now() }
  write(stored)
}
