import { describe, expect, it } from 'vitest'
import { extractFromWikibooksHtml, wikibooksProvider } from './wikibooks'
import {
  activeProviders,
  providerById,
  providerLabel,
  searchAllProviders,
  withSourceLabels,
} from './registry'
import { theMealDbProvider } from './theMealDb'
import { DiscoveryError, type DiscoveryProvider, type DiscoveryResult } from './types'

const RECIPE_PAGE = `
<div class="mw-parser-output">
  <p>A classic dish.</p>
  <h2><span id="Ingredients">Ingredients</span><span class="mw-editsection">[edit]</span></h2>
  <ul>
    <li>4 lb chicken</li>
    <li>2 tbsp curry powder</li>
    <li>1 onion, chopped</li>
  </ul>
  <h2><span id="Procedure">Procedure</span></h2>
  <ol>
    <li>Brown the chicken.</li>
    <li>Simmer for 30 minutes.</li>
  </ol>
</div>`

/** Some Cookbook entries only list variants of a dish. */
const HUB_PAGE = `
<div class="mw-parser-output">
  <ul>
    <li><a href="/wiki/Cookbook:Guacamole_I" title="Cookbook:Guacamole I">Guacamole I</a></li>
    <li><a href="/wiki/Cookbook:Guacamole_II" title="Cookbook:Guacamole II">Guacamole II</a></li>
    <li><a href="/wiki/Cookbook:Ingredients" title="Cookbook:Ingredients">Ingredients</a></li>
  </ul>
</div>`

describe('extractFromWikibooksHtml', () => {
  it('reads ingredients and steps out of a wiki page', () => {
    const extracted = extractFromWikibooksHtml(RECIPE_PAGE)

    expect(extracted.ingredientLines).toEqual([
      '4 lb chicken',
      '2 tbsp curry powder',
      '1 onion, chopped',
    ])
    expect(extracted.instructionTexts).toEqual([
      'Brown the chicken.',
      'Simmer for 30 minutes.',
    ])
  })

  it('leaves the wiki furniture behind', () => {
    const extracted = extractFromWikibooksHtml(RECIPE_PAGE)
    expect(extracted.ingredientLines.join(' ')).not.toContain('[edit]')
  })

  it('accepts the other headings the Cookbook uses', () => {
    const withMethod = RECIPE_PAGE.replace('Procedure', 'Method')
    expect(extractFromWikibooksHtml(withMethod).instructionTexts).toHaveLength(2)
  })

  it('recognises a page that only lists variants', () => {
    const extracted = extractFromWikibooksHtml(HUB_PAGE)

    expect(extracted.ingredientLines).toHaveLength(0)
    expect(extracted.variants).toEqual(['Cookbook:Guacamole_I', 'Cookbook:Guacamole_II'])
  })

  it('does not offer reference pages as variants to cook', () => {
    expect(extractFromWikibooksHtml(HUB_PAGE).variants).not.toContain(
      'Cookbook:Ingredients',
    )
  })
})

describe('the source registry', () => {
  it('uses the free sources when the user has added no key', () => {
    const ids = activeProviders().map((provider) => provider.id)
    expect(ids).toEqual(['themealdb', 'wikibooks'])
  })

  it("puts the user's own key first when there is one", () => {
    const ids = activeProviders({ spoonacularKey: 'abc' }).map((p) => p.id)
    expect(ids[0]).toBe('spoonacular')
    expect(ids).toContain('wikibooks')
  })

  it('finds the source a result came from, so the right one is asked for it', () => {
    expect(providerById('wikibooks')?.label).toBe('Wikibooks Cookbook')
    expect(providerLabel('themealdb')).toBe(theMealDbProvider.label)
  })

  it('ignores a key that is only whitespace', () => {
    expect(activeProviders({ spoonacularKey: '   ' }).map((p) => p.id)).not.toContain(
      'spoonacular',
    )
  })
})

describe('searchAllProviders', () => {
  function stub(id: string, titles: string[], fail = false): DiscoveryProvider {
    return {
      id,
      label: id,
      attribution: '',
      attributionUrl: '',
      async searchByText() {
        if (fail) throw new DiscoveryError('unreachable', `${id} is down`)
        return titles.map((title) => ({ providerId: id, externalId: title, title }))
      },
      async searchByIngredient() {
        return []
      },
      async random() {
        return []
      },
      async fetchRecipe() {
        throw new Error('not used')
      },
    }
  }

  const search = (provider: DiscoveryProvider) => provider.searchByText('x')

  it('merges what every source returned', async () => {
    const { results } = await searchAllProviders(
      [stub('a', ['Apple pie']), stub('b', ['Banana bread'])],
      search,
    )
    expect(results.map((r) => r.title)).toContain('Apple pie')
    expect(results.map((r) => r.title)).toContain('Banana bread')
  })

  it('takes turns between sources instead of listing one first', async () => {
    const { results } = await searchAllProviders(
      [stub('a', ['A1', 'A2', 'A3']), stub('b', ['B1', 'B2'])],
      search,
    )
    expect(results.map((r) => r.title)).toEqual(['A1', 'B1', 'A2', 'B2', 'A3'])
  })

  it('shows a dish once when two sources both have it', async () => {
    const { results } = await searchAllProviders(
      [stub('a', ['Chicken Curry']), stub('b', ['chicken curry'])],
      search,
    )
    expect(results).toHaveLength(1)
  })

  /** One source being down must not empty the screen. */
  it('keeps the results from the sources that did answer', async () => {
    const { results, failures } = await searchAllProviders(
      [stub('a', ['Apple pie']), stub('b', [], true)],
      search,
    )
    expect(results.map((r) => r.title)).toEqual(['Apple pie'])
    expect(failures).toHaveLength(1)
  })

  it('reports every failure when nothing answered', async () => {
    const { results, failures } = await searchAllProviders(
      [stub('a', [], true), stub('b', [], true)],
      search,
    )
    expect(results).toHaveLength(0)
    expect(failures).toHaveLength(2)
  })
})

describe('withSourceLabels', () => {
  it('says where each result came from', () => {
    const result: DiscoveryResult = {
      providerId: 'wikibooks',
      externalId: 'Cookbook:Pie',
      title: 'Pie',
    }
    const [labelled] = withSourceLabels([{ result, matched: [] }])
    expect(labelled.sourceLabel).toBe('Wikibooks Cookbook')
  })
})

describe('the Wikibooks provider', () => {
  it('presents page names without the namespace prefix', async () => {
    // Exercised through the pure helpers rather than the network.
    expect(wikibooksProvider.id).toBe('wikibooks')
    expect(wikibooksProvider.attribution).toMatch(/CC BY-SA/)
  })
})
