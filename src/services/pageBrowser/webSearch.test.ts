import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WebSearchError,
  bingRssUrl,
  braveSearchUrl,
  duckDuckGoLiteUrl,
  looksOffTopic,
  parseBingRss,
  parseBraveResults,
  parseDuckDuckGoLite,
  recipeQuery,
  significantTerms,
  webSearch,
} from './webSearch'

const FEED = `<?xml version="1.0" encoding="utf-8" ?><rss version="2.0"><channel>
<title>Bing: lentil soup recipe</title>
<item><title>Best Lentil Soup - Example</title><link>https://www.example.com/lentil-soup/</link><description>A soup &amp; a story.</description></item>
<item><title>Lentil Soup Recipe</title><link>https://www.allrecipes.com/recipe/1/lentil-soup/</link><description>Hearty.</description></item>
<item><title>Duplicate</title><link>https://www.example.com/lentil-soup/</link><description>Again.</description></item>
<item><title>Lentil soup video</title><link>https://www.youtube.com/watch?v=abc</link></item>
<item><title>Not a page</title><link>ftp://files.example/soup</link></item>
</channel></rss>`

function braveSnippet(url: string, title: string, description: string): string {
  return `<div class="snippet" data-type="web" data-pos="1">
    <div class="result-wrapper"><div class="result-content">
      <a href="${url}" class="l1"><div class="site-name-wrapper"><cite>host</cite></div>
        <div class="title search-snippet-title" title="${title}">${title}</div></a>
      <div class="recipe-snippet"><div class="content">
        <div class="line-clamp-2"><span>October 4, 2024 -</span> ${description}</div>
        <div class="snippet-attributes">4.9 (1.2K) Time 00:45:00 Calories 300</div>
      </div></div>
    </div></div></div>`
}

function bravePage(snippets: string[]): string {
  return `<!doctype html><html><head><title>q - Brave Search</title></head><body>
    <div class="snippet" id="llm-snippet"><div class="content">An AI answer, not a result.</div></div>
    ${snippets.join('\n')}
    <div class="snippet" data-type="videos"><a href="https://www.youtube.com/watch?v=x"><div class="title">Video</div></a></div>
  </body></html>`
}

function feedOf(titles: string[]): string {
  return `<?xml version="1.0"?><rss><channel>${titles
    .map((t, i) => `<item><title>${t}</title><link>https://s${i}.example/r</link></item>`)
    .join('')}</channel></rss>`
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recipeQuery', () => {
  it('adds the word recipe, because that is always what is meant here', () => {
    expect(recipeQuery('chicken tikka masala')).toBe('chicken tikka masala recipe')
  })

  it('never doubles it, and never removes what was typed', () => {
    expect(recipeQuery('easy lasagne recipe')).toBe('easy lasagne recipe')
    expect(recipeQuery('best pancake recipes ever')).toBe('best pancake recipes ever')
    expect(recipeQuery('  two   words ')).toBe('two words recipe')
  })
})

describe('engine addresses', () => {
  it('asks Bing for the feed with spaces as %20, since a plus is read as a plus', () => {
    expect(bingRssUrl('lentil soup recipe')).toBe(
      'https://www.bing.com/search?q=lentil%20soup%20recipe&format=rss',
    )
    expect(bingRssUrl('soup', 10)).toContain('first=11')
    expect(bingRssUrl('soup', 0)).not.toContain('first=')
    expect(bingRssUrl('soup', 0, '496000')).toContain('_=496000')
  })

  it('asks Brave for its web results page, by page number', () => {
    expect(braveSearchUrl('lentil soup recipe')).toBe(
      'https://search.brave.com/search?q=lentil+soup+recipe&source=web',
    )
    expect(braveSearchUrl('soup', 2)).toContain('offset=2')
  })
})

describe('parseBraveResults', () => {
  it('reads web results only, keeping the description and not the date or the ratings row', () => {
    const results = parseBraveResults(
      bravePage([
        braveSnippet('https://cookieandkate.com/best-lentil-soup-recipe/', 'Best Lentil Soup Recipe', 'Seasonal vegetables and pantry staples.'),
        braveSnippet('https://www.facebook.com/x/posts/1', 'A post', 'Social.'),
        braveSnippet('https://www.recipetineats.com/lentil-soup/', 'Lentil Soup', 'Thick and hearty.'),
      ]),
    )
    expect(results.map((r) => r.host)).toEqual(['cookieandkate.com', 'recipetineats.com'])
    expect(results[0]).toMatchObject({
      title: 'Best Lentil Soup Recipe',
      snippet: 'Seasonal vegetables and pantry staples.',
    })
  })

  it('drops the relative dates descriptions open with', () => {
    const page = bravePage([braveSnippet('https://a.example/x', 'Chili', 'Brown the beef.')]).replace(
      'October 4, 2024 -',
      '4 days ago -',
    )
    expect(parseBraveResults(page)[0].snippet).toBe('Brown the beef.')
  })

  it('returns nothing rather than throwing on a page that is not results', () => {
    expect(parseBraveResults('<html><body><h1>Are you a robot?</h1></body></html>')).toEqual([])
  })
})

describe('parseDuckDuckGoLite', () => {
  const LITE = `<html><body><table>
    <tr><td><a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.cookingclassy.com%2Fslow%2Dcooker%2Dchili%2F&amp;rut=abc" class="result-link">Easy Slow Cooker Chili - Cooking Classy</a></td></tr>
    <tr><td class="result-snippet">This Easy Slow Cooker Chili is one of my most popular recipes.</td></tr>
    <tr><td><a rel="nofollow" href="https://natashaskitchen.com/slow-cooker-chili-recipe/" class="result-link">Slow Cooker Chili Recipe</a></td></tr>
    <tr><td class="result-snippet">Learn how to make the best slow cooker chili.</td></tr>
  </table></body></html>`

  it('unwraps the redirect links and pairs each link with its snippet', () => {
    const results = parseDuckDuckGoLite(LITE)
    expect(results.map((r) => r.url)).toEqual([
      'https://www.cookingclassy.com/slow-cooker-chili/',
      'https://natashaskitchen.com/slow-cooker-chili-recipe/',
    ])
    expect(results[1].snippet).toBe('Learn how to make the best slow cooker chili.')
  })

  it('asks for the lite page by query', () => {
    expect(duckDuckGoLiteUrl('lentil soup recipe')).toBe(
      'https://lite.duckduckgo.com/lite/?q=lentil+soup+recipe',
    )
  })
})

describe('parseBingRss', () => {
  it('reads title, link, host and snippet, skipping duplicates, videos and non-web links', () => {
    const results = parseBingRss(FEED)
    expect(results.map((r) => r.url)).toEqual([
      'https://www.example.com/lentil-soup/',
      'https://www.allrecipes.com/recipe/1/lentil-soup/',
    ])
    expect(results[0]).toMatchObject({
      title: 'Best Lentil Soup - Example',
      host: 'example.com',
      snippet: 'A soup & a story.',
    })
  })

  it('returns nothing rather than throwing on a page that is not a feed', () => {
    expect(parseBingRss('<html><body>Robot check</body></html>')).toEqual([])
    expect(parseBingRss('not xml at all')).toEqual([])
  })
})

describe('looksOffTopic', () => {
  const about = (titles: string[]) =>
    titles.map((title) => ({ title, url: 'https://x.example/', host: 'x.example' }))

  it('picks out the words that matter', () => {
    expect(significantTerms('easy chicken tikka masala recipe')).toEqual(['chicken', 'tikka', 'masala'])
    expect(significantTerms("Natasha's best soup")).toEqual(['natasha', 'soup'])
  })

  it('recognises an answer about the first word only', () => {
    expect(
      looksOffTopic('slow cooker chili recipe', about([
        'SLOW Definition & Meaning - Merriam-Webster',
        's l o w r o a d s',
        'SLOW | English meaning - Cambridge Dictionary',
        'SLOW Synonyms: 503 Similar and Opposite Words',
      ])),
    ).toBe(true)
  })

  it('accepts an answer that is about the question', () => {
    expect(
      looksOffTopic('chicken tikka masala recipe', about([
        'Chicken Tikka Masala Recipe - Food Network',
        'Authentic Chicken Tikka Masala',
        'Easy Chicken Tikka Masala',
        'Slow Cooker Butter Chicken',
      ])),
    ).toBe(false)
  })

  it('has no opinion on one-word searches or empty answers', () => {
    expect(looksOffTopic('lasagne recipe', about(['Chicken - Wikipedia']))).toBe(false)
    expect(looksOffTopic('chicken tikka masala', [])).toBe(false)
  })
})

describe('webSearch', () => {
  /** Answers each engine by its address; anything else is unreachable. */
  function network(answers: {
    brave?: string | null
    duckduckgo?: string | null
    bing?: string | (() => string) | null
  }) {
    const asked: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      asked.push(url)
      const decoded = decodeURIComponent(url)
      const body = decoded.includes('search.brave.com')
        ? answers.brave
        : decoded.includes('duckduckgo.com')
          ? answers.duckduckgo
          : decoded.includes('bing.com')
            ? typeof answers.bing === 'function'
              ? answers.bing()
              : answers.bing
            : null
      if (body == null) throw new TypeError('Failed to fetch')
      return new Response(body, { status: 200 })
    })
    return asked
  }

  const LITE_PAGE = `<html><body><table>
    <tr><td><a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fa.example%2Flentil" class="result-link">Lentil Soup</a></td></tr>
    <tr><td class="result-snippet">Good.</td></tr>
  </table></body></html>`

  it('asks Brave first and stops there when it answers well', async () => {
    const asked = network({
      brave: bravePage([
        braveSnippet('https://a.example/lentil-soup', 'Lentil Soup', 'Good.'),
        braveSnippet('https://b.example/lentil-soup', 'Red Lentil Soup', 'Better.'),
      ]),
      bing: FEED,
    })

    const found = await webSearch('lentil soup', { useSharedFetchers: true }, { now: 3_600_000 * 5 })

    expect(found.query).toBe('lentil soup recipe')
    expect(found.engine).toBe('brave')
    expect(found.results.map((r) => r.host)).toEqual(['a.example', 'b.example'])
    expect(decodeURIComponent(asked[0])).toContain('search.brave.com/search?q=lentil+soup+recipe&source=web&_=5')
    expect(asked.some((url) => url.includes('bing'))).toBe(false)
  })

  it('falls back to DuckDuckGo when Brave cannot be reached, with no second page on offer', async () => {
    const asked = network({ brave: null, duckduckgo: LITE_PAGE, bing: FEED })

    const found = await webSearch('lentil soup', { useSharedFetchers: true })

    expect(found.engine).toBe('duckduckgo')
    expect(found.results.map((r) => r.url)).toEqual(['https://a.example/lentil'])
    expect(found.nextOffset).toBeUndefined()
    // Brave was tried by every route first; Bing was never needed.
    expect(asked.filter((url) => decodeURIComponent(url).includes('brave')).length).toBeGreaterThan(0)
    expect(asked.some((url) => url.includes('bing'))).toBe(false)
  })

  it('falls back to Bing when neither of the others answers, and pages with the engine that answered', async () => {
    const asked = network({
      brave: null,
      duckduckgo: null,
      bing: feedOf(Array.from({ length: 10 }, (_, i) => `Lentil soup ${i}`)),
    })

    const found = await webSearch('lentil soup', { useSharedFetchers: true })

    expect(found.engine).toBe('bing')
    expect(found.results).toHaveLength(10)
    expect(found.nextOffset).toBe(10)

    const more = await webSearch('lentil soup', { useSharedFetchers: true }, { offset: 10, engine: 'bing' })
    expect(more.engine).toBe('bing')
    expect(asked.slice(-1)[0]).toContain('first=11')
  })

  it('does not take a Bing answer about the first word only; it asks again, then keeps the better one', async () => {
    let calls = 0
    network({
      brave: null,
      duckduckgo: null,
      bing: () =>
        ++calls === 1
          ? feedOf(['SLOW Definition', 's l o w r o a d s', 'SLOW meaning', 'SLOW synonyms'])
          : feedOf(['Slow Cooker Chili Recipe', 'Easy Slow Cooker Chili', 'Best Slow Cooker Chili', 'Crockpot Chili']),
    })

    const found = await webSearch('slow cooker chili', { useSharedFetchers: true }, { now: 42 })

    expect(calls).toBe(2)
    expect(found.results[0].title).toBe('Slow Cooker Chili Recipe')
  })

  it('explains itself when nothing can reach any engine', async () => {
    network({ brave: null, duckduckgo: null, bing: null })

    await expect(
      webSearch('soup', { useSharedFetchers: false }),
    ).rejects.toBeInstanceOf(WebSearchError)
  })
})
