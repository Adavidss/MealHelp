/**
 * Picking something at random, in the way people actually mean it.
 *
 * Used for recipes and for the browser's random dish ideas alike, which is
 * why it knows nothing about either: anything with an id can be surprised.
 *
 * "Surprise me" pressed twice must not offer the same thing twice — true
 * randomness does that roughly one time in however many recipes you own, and
 * on a small library it happens constantly, which reads as the button being
 * broken. So the last few picks are remembered and skipped until the pool
 * runs out, at which point it starts again rather than refusing.
 */

export interface Identified {
  id: string
}

/** How many recent picks to avoid before allowing repeats again. */
export const SURPRISE_MEMORY = 5

export function pickSurprise<T extends Identified>(
  items: readonly T[],
  recentIds: readonly string[] = [],
  random: () => number = Math.random,
): T | undefined {
  if (!items.length) return undefined
  if (items.length === 1) return items[0]

  const recent = new Set(recentIds.slice(-SURPRISE_MEMORY))
  const fresh = items.filter((item) => !recent.has(item.id))

  /*
   * Everything has been seen lately, so the memory is spent — except for the
   * very last pick, which is the one repeat anybody would notice.
   */
  const pool = fresh.length
    ? fresh
    : items.filter((item) => item.id !== recentIds[recentIds.length - 1])

  const usable = pool.length ? pool : items
  return usable[Math.floor(random() * usable.length) % usable.length]
}

/** The running memory, capped so it cannot grow for ever. */
export function rememberPick(recentIds: readonly string[], id: string): string[] {
  return [...recentIds, id].slice(-SURPRISE_MEMORY)
}
