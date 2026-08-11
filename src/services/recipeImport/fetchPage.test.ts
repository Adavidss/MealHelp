import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageFetchError, fetchRecipePage } from './fetchPage'

const HTML = '<!doctype html><html><head></head><body>recipe</body></html>'

/** Stands in for the network, recording who was asked and in what order. */
function mockNetwork(responder: (url: string) => { status: number; body: string } | null) {
  const asked: string[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input)
    asked.push(url)
    const answer = responder(url)
    if (!answer) throw new TypeError('Failed to fetch')
    return new Response(answer.body, { status: answer.status })
  })
  return asked
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchRecipePage', () => {
  it('asks the site itself first, and stops there when it answers', async () => {
    const asked = mockNetwork(() => ({ status: 200, body: HTML }))

    const page = await fetchRecipePage('https://example.com/recipe')

    expect(page.via).toBe('direct')
    expect(asked).toEqual(['https://example.com/recipe'])
  })

  it("uses the user's own fetcher before any shared one", async () => {
    const asked = mockNetwork((url) =>
      url.includes('my-worker') ? { status: 200, body: HTML } : null,
    )

    const page = await fetchRecipePage('https://example.com/recipe', {
      proxyUrl: 'https://my-worker.example/?url={url}',
      useSharedFetchers: true,
    })

    expect(page.via).toBe('own-proxy')
    expect(asked[1]).toContain('my-worker')
    // Nothing shared was consulted, because the user's own fetcher worked.
    expect(asked.some((url) => url.includes('corsproxy'))).toBe(false)
  })

  it('appends the url when the template does not say where it goes', async () => {
    const asked = mockNetwork((url) =>
      url.includes('my-worker') ? { status: 200, body: HTML } : null,
    )

    await fetchRecipePage('https://example.com/recipe', {
      proxyUrl: 'https://my-worker.example/fetch',
      useSharedFetchers: false,
    })

    expect(asked[1]).toBe(
      'https://my-worker.example/fetch?url=https%3A%2F%2Fexample.com%2Frecipe',
    )
  })

  it('moves on to the next shared fetcher when one is down', async () => {
    const asked = mockNetwork((url) =>
      url.includes('allorigins') ? { status: 200, body: HTML } : null,
    )

    const page = await fetchRecipePage('https://example.com/recipe')

    expect(page.via).toBe('shared')
    expect(asked.length).toBeGreaterThan(2)
  })

  it('never uses a shared fetcher when the user has turned them off', async () => {
    const asked = mockNetwork(() => null)

    await expect(
      fetchRecipePage('https://example.com/recipe', { useSharedFetchers: false }),
    ).rejects.toBeInstanceOf(PageFetchError)

    expect(asked).toEqual(['https://example.com/recipe'])
  })

  /**
   * The distinction that matters: a site refusing robots needs the capture
   * button, while a site that is merely down needs trying again later.
   */
  it('recognises a site that turns robots away', async () => {
    mockNetwork(() => ({ status: 403, body: 'Access denied' }))

    await expect(fetchRecipePage('https://example.com/recipe')).rejects.toMatchObject({
      botBlocked: true,
      reason: 'blocked',
    })
  })

  it('spots a wall served behind a cheerful 200', async () => {
    mockNetwork(() => ({
      status: 200,
      body: '<!doctype html><html><head><title>Attention Required!</title></head><body>Please verify you are human.</body></html>',
    }))

    await expect(fetchRecipePage('https://example.com/recipe')).rejects.toMatchObject({
      botBlocked: true,
    })
  })

  /**
   * A real BBC Good Food recipe carries the word "captcha" in a consent script.
   * Reading the raw markup for block-page words flagged it as a wall and broke
   * a site that had been importing fine, so only the page's visible words count.
   */
  it('does not mistake a script mentioning captcha for a block page', async () => {
    mockNetwork(() => ({
      status: 200,
      body: `<!doctype html><html><head><title>Easy classic lasagne recipe | Good Food</title>
        <script>window.recaptchaSettings={captcha:'v3'}</script>
        <script type="application/ld+json">{"@type":"Recipe","name":"Lasagne"}</script>
        </head><body><article>A proper recipe page.</article></body></html>`,
    }))

    const page = await fetchRecipePage('https://example.com/recipe')
    expect(page.via).toBe('direct')
  })

  it('does not mistake a JSON error page for a recipe page', async () => {
    mockNetwork(() => ({ status: 200, body: '{"error":"nope"}' }))

    await expect(fetchRecipePage('https://example.com/recipe')).rejects.toBeInstanceOf(
      PageFetchError,
    )
  })
})
