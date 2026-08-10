import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import type { GroceryItem, GroceryList, PlannedMeal, Recipe } from '@/models'
import { formatQuantity } from '@/services/unitConversion'

/**
 * Share snapshots.
 *
 * MealHelp has no server, so a shared grocery list has to travel inside the
 * link itself. The payload is compressed and put in the URL fragment, which
 * browsers never send anywhere — the data stays on the two devices involved.
 *
 * The version field exists so a link printed today still opens in a build
 * shipped a year from now.
 */

export type ShareType = 'grocery' | 'recipe' | 'meal-plan'

export interface SharePayload {
  version: 1
  type: ShareType
  data: unknown
}

/** Compact wire shapes. Arrays instead of objects, because every byte is URL. */
interface GroceryWire {
  w?: string
  i: Array<[name: string, quantity: string, category: string, checked: 0 | 1]>
}

interface PlanWire {
  w: string
  m: Array<[date: string, mealType: string, title: string, kind: string]>
}

interface RecipeWire {
  t: string
  s?: number
  p?: number
  c?: number
  u?: string
  i: string[]
  d: string[]
  n?: string
}

/**
 * A QR code holding more than this is readable on a screen but unreliable when
 * printed and scanned across a kitchen, so MealHelp refuses to draw one.
 */
export const QR_COMFORTABLE_CHARS = 1200
export const QR_MAX_CHARS = 2200

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload)
  const compressed = deflateSync(strToU8(json), { level: 9 })
  return toBase64Url(compressed)
}

export function decodeShare(encoded: string): SharePayload {
  const bytes = fromBase64Url(encoded)
  const json = strFromU8(inflateSync(bytes))
  const parsed = JSON.parse(json) as SharePayload
  if (parsed?.version !== 1) {
    throw new Error('This link was made by a different version of MealHelp.')
  }
  return parsed
}

export function buildSharePath(payload: SharePayload): string {
  return `#/share/${payload.type}/${encodeShare(payload)}`
}

/** Absolute link, for QR codes and for copying to another device. */
export function buildShareUrl(payload: SharePayload, origin?: string): string {
  return `${appBase(origin)}${buildSharePath(payload)}`
}

function appBase(origin?: string): string {
  return (
    origin ??
    `${window.location.origin}${window.location.pathname}${window.location.search}`
  )
}

/**
 * A link straight into this installation, e.g. `#/recipes/rec_123`.
 *
 * The printed week hangs on the fridge of the household that made it, so the
 * phone scanning it already has the recipe. Pointing at it directly makes a QR
 * code of about sixty characters instead of a whole compressed recipe — the
 * difference between a code that scans across a kitchen and one that does not.
 */
export function buildAppUrl(hashPath: string, origin?: string): string {
  const path = hashPath.startsWith('#') ? hashPath : `#${hashPath}`
  return `${appBase(origin)}${path}`
}

// ---------- Grocery ----------

export function groceryPayload(
  items: GroceryItem[],
  weekStart?: string,
): SharePayload {
  const wire: GroceryWire = {
    w: weekStart,
    i: items.map((item) => [
      item.name,
      item.quantities.map(formatQuantity).filter(Boolean).join(' + '),
      item.category,
      item.checked ? 1 : 0,
    ]),
  }
  return { version: 1, type: 'grocery', data: wire }
}

export interface SharedGroceryItem {
  name: string
  quantity: string
  category: string
  checked: boolean
}

export function readGroceryPayload(payload: SharePayload): {
  weekStart?: string
  items: SharedGroceryItem[]
} {
  const wire = payload.data as GroceryWire
  return {
    weekStart: wire.w,
    items: (wire.i ?? []).map(([name, quantity, category, checked]) => ({
      name,
      quantity,
      category,
      checked: checked === 1,
    })),
  }
}

// ---------- Meal plan ----------

export function planPayload(
  weekStart: string,
  meals: Array<Pick<PlannedMeal, 'date' | 'mealType' | 'kind'> & { title: string }>,
): SharePayload {
  const wire: PlanWire = {
    w: weekStart,
    m: meals.map((meal) => [meal.date, meal.mealType, meal.title, meal.kind]),
  }
  return { version: 1, type: 'meal-plan', data: wire }
}

export interface SharedPlanMeal {
  date: string
  mealType: string
  title: string
  kind: string
}

export function readPlanPayload(payload: SharePayload): {
  weekStart: string
  meals: SharedPlanMeal[]
} {
  const wire = payload.data as PlanWire
  return {
    weekStart: wire.w,
    meals: (wire.m ?? []).map(([date, mealType, title, kind]) => ({
      date,
      mealType,
      title,
      kind,
    })),
  }
}

// ---------- Recipe ----------

export function recipePayload(recipe: Recipe): SharePayload {
  const wire: RecipeWire = {
    t: recipe.title,
    s: recipe.servings,
    p: recipe.prepTimeMinutes,
    c: recipe.cookTimeMinutes,
    u: recipe.sourceUrl,
    i: recipe.ingredients.map((ingredient) => ingredient.originalText),
    d: recipe.instructions.map((step) => step.text),
    n: recipe.notes,
  }
  return { version: 1, type: 'recipe', data: wire }
}

export interface SharedRecipe {
  title: string
  servings?: number
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  sourceUrl?: string
  ingredients: string[]
  instructions: string[]
  notes?: string
}

export function readRecipePayload(payload: SharePayload): SharedRecipe {
  const wire = payload.data as RecipeWire
  return {
    title: wire.t,
    servings: wire.s,
    prepTimeMinutes: wire.p,
    cookTimeMinutes: wire.c,
    sourceUrl: wire.u,
    ingredients: wire.i ?? [],
    instructions: wire.d ?? [],
    notes: wire.n,
  }
}

// ---------- Size checks ----------

export type ShareSize = 'ok' | 'large' | 'too-large'

export function shareSize(encodedLength: number): ShareSize {
  if (encodedLength <= QR_COMFORTABLE_CHARS) return 'ok'
  if (encodedLength <= QR_MAX_CHARS) return 'large'
  return 'too-large'
}

/** Everything the UI needs to decide whether to draw a QR code. */
export function describeShare(payload: SharePayload, origin?: string) {
  const encoded = encodeShare(payload)
  const size = shareSize(encoded.length)
  return {
    encoded,
    url: buildShareUrl(payload, origin),
    length: encoded.length,
    size,
    qrSafe: size !== 'too-large',
  }
}

/** Used when a full list will not fit: share the shopping that is still to do. */
export function unpurchasedOnly(list: GroceryList): GroceryItem[] {
  return list.items.filter((item) => !item.checked && !item.haveIt)
}
