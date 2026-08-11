import type { DiscoveryProvider, DiscoveryResult, RankedDiscovery } from './types'
import { DiscoveryError } from './types'
import { theMealDbProvider } from './theMealDb'
import { wikibooksProvider } from './wikibooks'
import { createSpoonacularProvider } from './spoonacular'

/**
 * Which places MealHelp will look for recipes.
 *
 * The bar for being in this list: no account, no key baked into the app, the
 * data is offered for this kind of use, and whoever runs it is unlikely to
 * disappear or start charging without warning. Wikimedia and TheMealDB both
 * clear it. Anything needing a key is opt-in and belongs to the user.
 */

export interface ProviderOptions {
  spoonacularKey?: string
}

export function activeProviders(options: ProviderOptions = {}): DiscoveryProvider[] {
  const providers: DiscoveryProvider[] = [theMealDbProvider, wikibooksProvider]
  const key = options.spoonacularKey?.trim()
  // A key of the user's own searches far more than the free sources, so it
  // leads rather than joins the end of the queue.
  if (key) providers.unshift(createSpoonacularProvider(key))
  return providers
}

export function providerById(
  id: string,
  options: ProviderOptions = {},
): DiscoveryProvider | undefined {
  return activeProviders(options).find((provider) => provider.id === id)
}

/** Human name for whichever source a result came from. */
export function providerLabel(id: string, options: ProviderOptions = {}): string {
  return providerById(id, options)?.label ?? id
}

/**
 * Searches every source at once and merges what comes back.
 *
 * One source being down, slow or rate-limited must not empty the screen, so
 * failures are collected rather than thrown — and only reported if *every*
 * source failed, which is the only case the user can do anything about.
 */
export async function searchAllProviders(
  providers: DiscoveryProvider[],
  search: (provider: DiscoveryProvider) => Promise<DiscoveryResult[]>,
): Promise<{ results: DiscoveryResult[]; failures: DiscoveryError[] }> {
  const settled = await Promise.all(
    providers.map(async (provider) => {
      try {
        return { ok: true as const, results: await search(provider) }
      } catch (error) {
        return {
          ok: false as const,
          error:
            error instanceof DiscoveryError
              ? error
              : new DiscoveryError('unreachable', `${provider.label} could not be reached.`),
        }
      }
    }),
  )

  const failures = settled.filter((entry) => !entry.ok).map((entry) => entry.error)
  const results = settled.flatMap((entry) => (entry.ok ? entry.results : []))

  return { results: interleave(providers, results), failures }
}

/**
 * Round-robins between sources so the first screenful is not simply whichever
 * one returned the most rows.
 */
function interleave(
  providers: DiscoveryProvider[],
  results: DiscoveryResult[],
): DiscoveryResult[] {
  const byProvider = new Map<string, DiscoveryResult[]>()
  for (const provider of providers) byProvider.set(provider.id, [])
  for (const result of results) {
    const existing = byProvider.get(result.providerId)
    if (existing) existing.push(result)
    else byProvider.set(result.providerId, [result])
  }

  const merged: DiscoveryResult[] = []
  const seen = new Set<string>()
  let index = 0
  let added = true

  while (added) {
    added = false
    for (const list of byProvider.values()) {
      const candidate = list[index]
      if (!candidate) continue
      added = true
      // The same dish often appears in more than one source; show it once.
      const key = candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(candidate)
    }
    index++
  }

  return merged
}

/** Attaches the source label each result should be shown with. */
export function withSourceLabels(
  ranked: RankedDiscovery[],
  options: ProviderOptions = {},
): RankedDiscovery[] {
  return ranked.map((entry) => ({
    ...entry,
    sourceLabel: providerLabel(entry.result.providerId, options),
  }))
}
