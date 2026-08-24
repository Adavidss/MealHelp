/**
 * Where you had got to.
 *
 * Cooking is the one time a phone is most likely to be put down, locked,
 * splashed, or taken over by a timer app — and the one time losing your place
 * matters most, because the pot does not go back to the start with you. Step,
 * ticked ingredients and how much you are making are all kept, per recipe,
 * until the meal is finished or the day is over.
 */

const KEY = 'mealhelp.cooking'

/** Nobody is still on step four of last night's dinner. */
const KEEP_MS = 12 * 60 * 60 * 1000

export interface CookingProgress {
  step: number
  checked: string[]
  servings?: number
  at: number
}

type Stored = Record<string, CookingProgress>

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
    // Private mode: progress lasts as long as the screen stays open.
  }
}

export function readCookingProgress(recipeId: string): CookingProgress | undefined {
  const progress = read()[recipeId]
  if (!progress) return undefined
  if (Date.now() - progress.at > KEEP_MS) return undefined
  return progress
}

export function saveCookingProgress(
  recipeId: string,
  progress: Omit<CookingProgress, 'at'>,
): void {
  const stored = read()
  stored[recipeId] = { ...progress, at: Date.now() }
  write(stored)
}

export function clearCookingProgress(recipeId: string): void {
  const stored = read()
  if (!(recipeId in stored)) return
  delete stored[recipeId]
  write(stored)
}
