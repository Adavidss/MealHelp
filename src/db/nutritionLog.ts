import { db } from './database'
import type { Nutrition, NutritionLogEntry } from '@/models'
import { newId, nowISO } from '@/utils/id'

export async function listNutritionLog(dates: string[]): Promise<NutritionLogEntry[]> {
  if (!dates.length) return []
  return db.nutritionLog.where('date').anyOf(dates).toArray()
}

export async function addNutritionLogEntry(input: {
  date: string
  name: string
  quantity?: number
  nutrition: Nutrition
  source?: string
}): Promise<NutritionLogEntry> {
  const entry: NutritionLogEntry = {
    id: newId('nl'),
    date: input.date,
    name: input.name.trim() || 'Something',
    quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
    nutrition: input.nutrition,
    source: input.source,
    createdAt: nowISO(),
  }
  await db.nutritionLog.put(entry)
  return entry
}

export async function deleteNutritionLogEntry(id: string): Promise<void> {
  await db.nutritionLog.delete(id)
}
