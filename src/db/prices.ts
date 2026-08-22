import { db } from './database'
import type { PriceBookEntry } from '@/models'
import { nowISO } from '@/utils/id'

/**
 * The shopper's own prices.
 *
 * The built-in table is a typical price in a typical shop, which is the wrong
 * number for everybody in particular. Anyone who corrects one should never
 * have to correct it again, so corrections are stored by ingredient key and
 * used for every list from then on — including next week's.
 */

export async function loadPriceBook(): Promise<Map<string, { price: number; unit: string }>> {
  const entries = await db.priceBook.toArray()
  return new Map(entries.map((entry) => [entry.key, { price: entry.price, unit: entry.unit }]))
}

export async function setOwnPrice(
  key: string,
  price: number,
  unit: string,
): Promise<void> {
  const entry: PriceBookEntry = { key, price, unit, updatedAt: nowISO() }
  await db.priceBook.put(entry)
}

export async function clearOwnPrice(key: string): Promise<void> {
  await db.priceBook.delete(key)
}
