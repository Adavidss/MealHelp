# MealHelp page fetcher

A ~40-line Cloudflare Worker that fetches a recipe page and returns it with
permissive CORS headers, so MealHelp can read it.

One copy of it is deployed for the live site as `mealhelp-fetch.kidsdc.workers.dev`
and built into the app (`BUILT_IN_FETCHER` in `src/services/recipeImport/fetchPage.ts`),
answering only the origins listed in `wrangler.toml`. That is what makes import
and the built-in browser work from kidsdc.org: the shared public fetchers turned
out to be localhost-only, ten seconds slow, or gone. Redeploy with
`wrangler deploy` from this folder after changing it.

**You do not need your own.** Run one if you would rather nothing but you and
the recipe site saw which pages you read — paste its URL into Settings and it
is tried before MealHelp's. The built-in browser and its web search go through
the same fetcher, so every page you browse comes through your Worker too, and
pages over the shared fetchers' size limit (about 1 MB; some magazine sites are
bigger) open when they would not otherwise.

## Deploy

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

Then paste the resulting URL into MealHelp under **Settings → Your own page
fetcher**, as:

```
https://mealhelp-fetch.<your-subdomain>.workers.dev/?url={url}
```

`{url}` is optional — MealHelp appends `?url=…` if you leave it out.

## Households (linking two phones)

The Worker also holds one sealed blob per household, so two people can plan
together without either of them making an account:

```
GET  /household/<id>    the blob, or 404 if nobody has pushed one
PUT  /household/<id>    replaces it; ?ifWrittenAt=<iso> rejects a stale write
```

It is a shelf, not a service. The blob is encrypted on the phone and the `<id>`
in the path is a SHA-256 of the household code, which the Worker never sees —
so it holds an id it cannot reverse and bytes it cannot open. All the merging
happens in the app (`src/services/sync/`).

This needs a KV namespace. Once:

```bash
npx wrangler kv namespace create HOUSEHOLDS
```

Uncomment `[[kv_namespaces]]` in `wrangler.toml`, paste in the id it prints,
and `wrangler deploy`. Until then the Worker still fetches pages and answers
sync requests with a 501 that the app turns into a plain explanation.

Blobs expire a year after the last push, and the clock restarts on every push.
Nothing is lost when one does expire: the phones hold the real copy, and the
next sync writes it back.

## What it does and does not do

It fetches one URL and returns the HTML. It sends a normal browser User-Agent,
because many recipe sites serve nothing useful otherwise.

It will not get past sites that block datacentre traffic outright — Allrecipes
and Serious Eats among them. No fetcher can: the block is on the network the
request comes from, and a Worker is exactly that kind of network. Those sites
are what the capture button is for, since it reads the page your own browser
has already loaded.

`ALLOWED_ORIGINS` in `wrangler.toml` limits who may use your Worker. Leave it
as your MealHelp URL so it does not become an open proxy for the internet.
