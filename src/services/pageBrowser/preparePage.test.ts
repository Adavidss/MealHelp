import { describe, expect, it } from 'vitest'
import { preparePage } from './preparePage'

const PAGE_URL = 'https://www.example.com/recipes/lentil-soup/'

function page(body: string, head = ''): string {
  return `<!doctype html><html><head><title>Lentil soup – Example</title>${head}</head><body>${body}</body></html>`
}

describe('preparePage', () => {
  it('resolves every relative address against the page, not against MealHelp', () => {
    const prepared = preparePage(page('<img src="/img/soup.jpg">'), PAGE_URL)
    expect(prepared.html).toMatch(/<base href="https:\/\/www\.example\.com\/recipes\/lentil-soup\/">/)
    // The base tag has to come before anything that could resolve a URL.
    expect(prepared.html.indexOf('<base')).toBeLessThan(prepared.html.indexOf('<title'))
  })

  it('tells no image host where the page is being read from', () => {
    const prepared = preparePage(
      page('<p>Soup</p>', '<meta name="referrer" content="unsafe-url">'),
      PAGE_URL,
    )
    expect(prepared.html).toContain('<meta name="referrer" content="no-referrer">')
    expect(prepared.html).not.toContain('unsafe-url')
  })

  it('reads the recipe before removing the scripts it lives in', () => {
    const ld = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Lentil soup',
      recipeIngredient: ['1 cup lentils', '4 cups stock'],
      recipeInstructions: 'Simmer for 30 minutes.',
    })}</script>`
    const prepared = preparePage(page('<h1>Lentil soup</h1>', ld), PAGE_URL)

    expect(prepared.recipe?.draft.title).toBe('Lentil soup')
    expect(prepared.recipe?.draft.ingredients).toHaveLength(2)
    expect(prepared.recipe?.draft.sourceUrl).toBe(PAGE_URL)
    expect(prepared.html).not.toContain('<script')
  })

  it('drops the things that cannot work without scripts or would carry the frame away', () => {
    const prepared = preparePage(
      page(
        '<iframe src="https://ads.example/x"></iframe><object data="x.swf"></object><p>Soup</p>',
        '<meta http-equiv="refresh" content="0;url=https://elsewhere.example/">' +
          '<meta http-equiv="Content-Security-Policy" content="img-src \'none\'">' +
          '<link rel="preload" href="/big.js" as="script">' +
          '<link rel="stylesheet" href="/style.css">' +
          '<script src="/app.js"></script>',
      ),
      PAGE_URL,
    )

    expect(prepared.html).not.toContain('<iframe')
    expect(prepared.html).not.toContain('<object')
    expect(prepared.html).not.toContain('http-equiv')
    expect(prepared.html).not.toContain('preload')
    expect(prepared.html).not.toContain('<script')
    // The site's own styling is what makes it look like the site.
    expect(prepared.html).toContain('<link rel="stylesheet" href="/style.css">')
    expect(prepared.html).toContain('<p>Soup</p>')
  })

  it('gives lazily loaded pictures their real address, and lets them be seen', () => {
    const prepared = preparePage(
      page(
        '<img class="lazyload" src="data:image/gif;base64,R0lGOD" data-src="/img/real.jpg" data-srcset="/img/real-2x.jpg 2x">' +
          '<picture><source data-srcset="/img/real.webp" type="image/webp"><img data-lazy-src="/img/fallback.jpg"></picture>',
      ),
      PAGE_URL,
    )

    expect(prepared.html).toContain('src="/img/real.jpg"')
    expect(prepared.html).toContain('srcset="/img/real-2x.jpg 2x"')
    expect(prepared.html).toMatch(/<source[^>]* srcset="\/img\/real\.webp"/)
    expect(prepared.html).toContain('src="/img/fallback.jpg"')
    expect(prepared.html).toContain('class="lazyloaded"')
    expect(prepared.html).not.toContain('data:image/gif')
  })

  it('shows a noscript fallback picture once, not twice', () => {
    // A lazy loader's usual output: the placeholder, then the real thing for
    // browsers without scripts. Un-lazying the first makes the second a duplicate.
    const lazyPair =
      '<img data-src="/img/one.jpg" src="/blank.gif"><noscript><img src="/img/one.jpg"></noscript>'
    // A plain fallback with nothing lazy beside it should be kept.
    const lonely = '<p>Text</p><noscript><img src="/img/two.jpg"></noscript>'
    // Noscript blocks with no picture are usually "please enable JavaScript".
    const nag = '<noscript><div class="nag">Please enable JavaScript</div></noscript>'

    const prepared = preparePage(page(lazyPair + lonely + nag), PAGE_URL)

    // One picture element pointing at one.jpg — the un-lazied original.
    expect(prepared.html.match(/<img[^>]*src="\/img\/one\.jpg"/g)).toHaveLength(1)
    expect(prepared.html).toContain('<img src="/img/two.jpg">')
    expect(prepared.html).not.toContain('<noscript')
    expect(prepared.html).not.toContain('Please enable JavaScript')
  })

  it('removes tracking pixels and click beacons', () => {
    const prepared = preparePage(
      page(
        '<img src="https://www.facebook.com/tr?id=1&ev=PageView" width="1" height="1">' +
          '<img src="/img/photo.jpg" alt="Soup">' +
          '<a href="/next" ping="https://tracker.example/p">Next</a>',
      ),
      PAGE_URL,
    )

    expect(prepared.html).not.toContain('facebook.com/tr')
    expect(prepared.html).toContain('/img/photo.jpg')
    expect(prepared.html).not.toContain('ping=')
    expect(prepared.html).toContain('href="/next"')
  })

  it('reports the title and canonical address', () => {
    const prepared = preparePage(
      page('<p>Soup</p>', '<link rel="canonical" href="/recipes/lentil-soup/">'),
      'https://www.example.com/recipes/lentil-soup/?utm_source=x',
    )
    expect(prepared.title).toBe('Lentil soup – Example')
    expect(prepared.canonicalUrl).toBe(PAGE_URL)
  })

  it('falls back to the hostname when a page has no title', () => {
    const prepared = preparePage('<html><body><p>Hi</p></body></html>', PAGE_URL)
    expect(prepared.title).toBe('example.com')
    expect(prepared.html).toContain('<base href=')
  })

  it('turns masks off, since a cross-origin mask hides the picture it was meant to shape', () => {
    const prepared = preparePage(page('<img src="/img/round.jpg" style="mask-image:url(/circle.svg)">'), PAGE_URL)
    expect(prepared.html).toContain('mask-image: none !important')
  })

  it('says whether the words read like a recipe, for pages with no markup', () => {
    const plain = preparePage(
      page('<h1>Lentil soup</h1><h2>Ingredients</h2><ul><li>lentils</li></ul><h2>Method</h2><p>Simmer.</p>'),
      PAGE_URL,
    )
    expect(plain.recipe).toBeUndefined()
    expect(plain.readsLikeRecipe).toBe(true)

    const index = preparePage(page('<h1>All recipes</h1><a href="/a">Soup</a><a href="/b">Stew</a>'), PAGE_URL)
    expect(index.readsLikeRecipe).toBe(false)
  })

  it('stops videos from playing themselves', () => {
    const prepared = preparePage(page('<video autoplay muted src="/clip.mp4"></video>'), PAGE_URL)
    expect(prepared.html).not.toContain('autoplay')
    expect(prepared.html).toContain('preload="none"')
  })
})
