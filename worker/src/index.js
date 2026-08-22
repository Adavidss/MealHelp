/**
 * Two jobs, both deliberately small.
 *
 *   GET  /?url=…                 fetches one recipe page and hands it back
 *                                with CORS headers, because a browser cannot
 *                                read another site's page on its own.
 *
 *   GET  /household/<id>         hands back one household's sealed blob
 *   PUT  /household/<id>         replaces it
 *
 * The household half is a shelf, not a service. The blob is encrypted on the
 * phone with a code this Worker never sees — the id in the path is a hash of
 * that code — so the most it can hold is bytes it cannot open. It does no
 * merging and knows nothing about recipes.
 */

const MAX_BYTES = 3_000_000
const TIMEOUT_MS = 12_000

// A real browser's User-Agent. Many recipe sites serve an empty shell to
// anything that identifies itself as a script.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

// A household blob is a whole kitchen: a few hundred recipes with notes runs
// to a couple of megabytes at the outside.
const MAX_HOUSEHOLD_BYTES = 4_000_000

// Long enough that a household is not lost over a quiet summer, and every push
// starts the clock again. The phones hold the real copy regardless.
const HOUSEHOLD_TTL_SECONDS = 60 * 60 * 24 * 365

function corsHeaders(origin, allowed) {
  // Only answer the sites you listed, so this does not become an open proxy.
  const permitted = allowed.length === 0 || allowed.includes(origin)
  return {
    'Access-Control-Allow-Origin': permitted ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=600',
  }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    // A household blob is never cached: the whole point is reading what the
    // other phone wrote a moment ago.
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 * One household, read or replaced.
 *
 * The write is guarded by `?ifWrittenAt=`, which rejects a push built from a
 * copy the other phone has already replaced. KV has no true compare-and-swap,
 * so this narrows the race rather than closing it — and a push that slips
 * through anyway loses nothing permanently, because the phone whose records
 * were overwritten still holds them and re-sends them on its next sync.
 */
async function household(request, env, headers, id) {
  if (!env.HOUSEHOLDS) {
    return json({ error: 'This Worker has no household store bound' }, 501, headers)
  }
  if (!/^[a-f0-9]{64}$/.test(id)) {
    return json({ error: 'Not a household id' }, 400, headers)
  }

  const key = `household:${id}`

  if (request.method === 'GET') {
    const stored = await env.HOUSEHOLDS.get(key)
    if (!stored) return json({ error: 'No such household yet' }, 404, headers)
    return new Response(stored, {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  if (request.method !== 'PUT') {
    return json({ error: 'GET or PUT' }, 405, headers)
  }

  const body = await request.text()
  if (body.length > MAX_HOUSEHOLD_BYTES) {
    return json({ error: 'That household is too large to sync' }, 413, headers)
  }

  let sealed
  try {
    sealed = JSON.parse(body)
  } catch {
    return json({ error: 'That is not JSON' }, 400, headers)
  }
  // The Worker cannot read the contents, but it can insist on the envelope.
  if (!sealed || typeof sealed.iv !== 'string' || typeof sealed.data !== 'string') {
    return json({ error: 'That is not a sealed snapshot' }, 400, headers)
  }

  const ifWrittenAt = new URL(request.url).searchParams.get('ifWrittenAt')
  if (ifWrittenAt) {
    const current = await env.HOUSEHOLDS.get(key)
    const currentWrittenAt = current ? (JSON.parse(current).writtenAt ?? null) : null
    if (currentWrittenAt !== ifWrittenAt) {
      return json({ error: 'Someone else synced first', writtenAt: currentWrittenAt }, 409, headers)
    }
  }

  const writtenAt = new Date().toISOString()
  await env.HOUSEHOLDS.put(key, JSON.stringify({ sealed, writtenAt }), {
    expirationTtl: HOUSEHOLD_TTL_SECONDS,
  })
  return json({ writtenAt }, 200, headers)
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

    const path = new URL(request.url).pathname
    if (path.startsWith('/household/')) {
      return household(request, env, headers, path.slice('/household/'.length))
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
          // What a browser sends. XML is in there for the built-in browser's
          // web search, which reads a results feed rather than a page.
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
