import type { Nutrition } from '@/models'
import { round } from './parseSchemaNutrition'

/**
 * Open Food Facts: the open, keyless database of packaged food. Its search
 * answers with CORS headers, so a static site can ask it directly — the
 * same endpoint the openfoodfacts-js and Grocy integrations use.
 */

export interface FoodFactsHit {
  id: string
  name: string
  brand?: string
  /** Per one serving when the product states one, otherwise per 100 g. */
  basis: 'serving' | '100g'
  servingSize?: string
  nutrition: Nutrition
}

interface RawProduct {
  code?: string
  product_name?: string
  brands?: string
  serving_size?: string
  nutriments?: Record<string, unknown>
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/** Reads a product's nutriments, preferring per-serving figures when present. */
export function nutritionFromProduct(raw: RawProduct): FoodFactsHit | undefined {
  const n = raw.nutriments ?? {}
  const name = raw.product_name?.trim()
  if (!name) return undefined

  const suffix = num(n['energy-kcal_serving']) != null ? '_serving' : '_100g'
  const basis = suffix === '_serving' ? 'serving' : '100g'
  const pick = (key: string) => num(n[`${key}${suffix}`])

  const kcal = pick('energy-kcal') ?? (pick('energy') != null ? (pick('energy') as number) / 4.184 : undefined)
  const nutrition: Nutrition = {}
  if (kcal != null) nutrition.calories = round(kcal, 0)
  const protein = pick('proteins')
  if (protein != null) nutrition.protein = round(protein)
  const carbs = pick('carbohydrates')
  if (carbs != null) nutrition.carbs = round(carbs)
  const fat = pick('fat')
  if (fat != null) nutrition.fat = round(fat)
  const saturated = pick('saturated-fat')
  if (saturated != null) nutrition.saturatedFat = round(saturated)
  const fiber = pick('fiber')
  if (fiber != null) nutrition.fiber = round(fiber)
  const sugar = pick('sugars')
  if (sugar != null) nutrition.sugar = round(sugar)
  const sodium = pick('sodium')
  if (sodium != null) nutrition.sodium = round(sodium * 1000, 0)

  if (nutrition.calories == null && nutrition.protein == null && nutrition.carbs == null) return undefined

  return {
    id: raw.code ?? name,
    name,
    brand: raw.brands?.split(',')[0]?.trim() || undefined,
    basis,
    servingSize: raw.serving_size?.trim() || undefined,
    nutrition,
  }
}

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<FoodFactsHit[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', query)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '10')
  url.searchParams.set('fields', 'code,product_name,brands,serving_size,nutriments')

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error(`Open Food Facts answered ${response.status}`)
  const body = (await response.json()) as { products?: RawProduct[] }
  return (body.products ?? [])
    .map(nutritionFromProduct)
    .filter((hit): hit is FoodFactsHit => Boolean(hit))
}
