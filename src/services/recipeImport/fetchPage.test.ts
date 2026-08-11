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

  it('spots a captcha wall even behind a 200', async () => {
    mockNetwork(() => ({
      status: 200,
      body: '<!doctype html><html><body>Please complete the CAPTCHA to continue</body></html>',
    }))

    await expect(fetchRecipePage('https://example.com/recipe')).rejects.toMatchObject({
      botBlocked: true,
    })
  })

  it('does not mistake a JSON error page for a recipe page', async () => {
    mockNetwork(() => ({ status: 200, body: '{"error":"nope"}' }))

    await expect(fetchRecipePage('https://example.com/recipe')).rejects.toBeInstanceOf(
      PageFetchError,
    )
  })
})
