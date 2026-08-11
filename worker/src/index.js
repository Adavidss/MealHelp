/**
 * Fetches one recipe page and hands it back with CORS headers.
 *
 * Deliberately tiny and stateless: it stores nothing, logs nothing, and exists
 * only because a browser cannot read another site's page on its own.
 */

const MAX_BYTES = 3_000_000
const TIMEOUT_MS = 12_000

// A real browser's User-Agent. Many recipe sites serve an empty shell to
// anything that identifies itself as a script.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

function corsHeaders(origin, allowed) {
  // Only answer the sites you listed, so this does not become an open proxy.
  const permitted = allowed.length === 0 || allowed.includes(origin)
  return {
    'Access-Control-Allow-Origin': permitted ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=600',
  }
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const origin = request.headers.get('Origin') ?? ''
    const headers = corsHeaders(origin, allowed)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    const target = new URL(request.url).searchParams.get('url')
    if (!target) {
      return new Response('Pass ?url=', { status: 400, headers })
    }

    let parsed
    try {
      parsed = new URL(target)
    } catch {
      return new Response('That is not a URL', { status: 400, headers })
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return new Response('Only http and https', { status: 400, headers })
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      const body = await upstream.text()
      if (body.length > MAX_BYTES) {
        return new Response('That page is too large', { status: 413, headers })
      }

      return new Response(body, {
        // The real status is passed through so MealHelp can tell a 403 (the
        // site refusing robots) from a page with no recipe on it.
        status: upstream.status,
        headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
      })
    } catch {
      return new Response('Could not reach that page', { status: 502, headers })
    }
  },
}
