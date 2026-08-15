# MealHelp page fetcher

A ~40-line Cloudflare Worker that fetches a recipe page and returns it with
permissive CORS headers, so MealHelp can read it.

**You do not need this.** MealHelp works without it: it falls back to shared
public fetchers, and the page-capture button handles anything neither can
reach. Run it if you would rather no third party saw which recipes you look up,
or if the shared fetchers are being unreliable.

The built-in browser and its web search go through the same fetcher, so with
this deployed, every page you browse inside MealHelp comes through your own
Worker too — and pages over the shared fetchers' size limit (about 1 MB; some
magazine sites are bigger) open here when they would not otherwise.

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
