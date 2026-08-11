# MealHelp

Planning food for a week normally means finding recipes across a dozen
websites, working out which of them make sense together, deciding which nights
to cook, turning all of it into one grocery list, and then reopening those same
messy websites while you cook.

MealHelp compresses that into: **choose the kind of week you want → get a
realistic plan → accept it → shop from one list → cook from recipes that all
look the same.**

It is a local-first web app. Everything lives in your browser; there is no
account, no server, and nothing is uploaded.

**Live:** https://kidsdc.org/MealHelp/

---

## What it does

**Plan my week** is the heart of it. Tell MealHelp you need five dinners but
only want to cook three times, that Friday has to be effortless, and that you
want at least one slow cooker meal — and it produces a week like this:

| Day | |
| --- | --- |
| Monday | **Slow Cooker Pulled Pork** — cook 10 servings |
| Tuesday | Pulled pork — leftovers |
| Wednesday | **Instant Pot Lentil Soup** — cook 8 servings |
| Thursday | Lentil soup — leftovers |
| Friday | **Big Batch Turkey Meatballs** |

Three cooking sessions, five dinners. Each suggestion explains itself ("great
leftovers", "only 15 min of hands-on work", "haven't cooked it in 6 weeks"), and
any meal can be locked, swapped or regenerated before you accept it. Nothing is
saved until you do.

### Everything else

- **Recipe library** — grid or list, instant search across titles, ingredients,
  tags, notes and cooking methods. Filter by quick, big-batch, freezer-friendly,
  slow cooker, never cooked, highly rated, and so on.
- **One standard recipe view** — once a recipe is in MealHelp you should never
  need the original page again. Scaling (½× to 2×), ingredient checkboxes,
  numbered directions, notes, equipment, and a link back to the source.
- **Import** — paste a link and MealHelp reads the page's structured recipe
  data. When a site refuses to share its page, it hands over to a paste box that
  parses the text instead. See [Recipe import limitations](#recipe-import-limitations).
- **Discover** — find recipes you do not have yet. Search by name, ask for a
  surprise, or tell it what is in the fridge and get recipes ranked by how many
  of your ingredients they use. Saving one turns it into an ordinary MealHelp
  recipe, source link and all. See [Discovery](#discovery).
- **Cooking mode** — full screen, big type, one step at a time, ingredient
  checklist, servings adjustment, one-tap timers detected from the steps
  ("Bake for 25 minutes" → *Start 25 min timer*), and the screen stays awake.
- **Leftovers as real things** — cooking six servings and eating two leaves four
  in the fridge. Those four can fill Tuesday, and the grocery list does not buy
  the ingredients twice.
- **Grocery list** — one list from the week's cooking. Same ingredients add up
  across recipes (1 onion + 2 onions = 3 onions; 1 tbsp + 2 tbsp olive oil =
  3 tbsp), incompatible quantities stay apart (1 bunch cilantro *and* 20 g
  cilantro), everything is sorted by aisle, and each item remembers which
  recipes wanted it. Add anything by hand — paper towels included.
- **Pantry** — the things you always have are pulled into a short "check the
  pantry" list instead of being assumed or silently dropped.
- **Ratings and history** — say how a meal went and it changes what gets
  suggested next. Repeat a good week with one button.
- **Print** — a refrigerator sheet for US Letter, with a QR code per cooked meal
  and one for the grocery list.
- **Backup** — export everything as JSON, restore by merging or replacing.
- **Installable** — works offline once loaded, on iPhone and desktop.

---

## Screens

| Screen | What it is for |
| --- | --- |
| **Today** | What you are eating tonight, what is in the fridge, what is coming, what is left to buy |
| **Plan** | The week — stacked day cards on a phone, a seven-column grid on a desktop |
| **Plan my week** | The preferences form and the plan preview, with reasons and locks |
| **Recipes** | The library, search and filters |
| **Discover** | Finding recipes you do not have yet |
| **Recipe** | The one standard layout every recipe gets |
| **Cooking** | Full-screen, step-by-step, timers |
| **Grocery** | Aisle-sorted checklist with a pantry check |
| **Print** | The refrigerator sheet |

---

## Architecture

```
src/
  app/          App shell, routing, settings context
  db/           Dexie database and one repository per domain
  models/       Recipe, MealPlan, Grocery, Pantry, Settings
  features/     One folder per screen (dashboard, recipes, planner, planning,
                cooking, grocery, pantry, import, discover, collections,
                history, print, sharing, settings)
  services/     Pure logic, no React and no database:
                  ingredientParser/    text → structured ingredient
                  unitConversion/      units, safe conversion, formatting
                  groceryAggregator/   many recipes → one list
                  recommendationEngine/  which recipe fits this slot
                  plannerEngine/       how cooking and leftovers fall across a week
                  recipeImport/        adapters, JSON-LD, paste parsing
                  recipeDiscovery/     providers, pantry-overlap ranking
                  shareCodec/          compressed share payloads
                  backup/              export, validation, restore
  components/   Shared UI
  utils/        Dates, ids, image resizing
  styles/       Design tokens, base, primitives, print
```

Two rules shape the layout. **Domain logic never lives in a component** — the
recommendation weights, the grocery maths and the planner rules are all plain
functions that can be read and tested on their own. And **the recommender and
the planner are separate**: one answers *which recipe fits this slot*, the other
answers *how should cooking and leftovers be spread across the week*. Conflating
them is how you end up recommending five unrelated meals for five nights.

React state is deliberately unremarkable: IndexedDB is the source of truth, read
live through `dexie-react-hooks`, with React context for settings and toasts.
There is no store library because nothing here has needed one.

---

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3140/MealHelp/ — the base path matters, because the
app is built to live under a repository name on GitHub Pages.

### Tests

```bash
npm test
```

The suite concentrates on the transformations that would silently corrupt
someone's week if they were wrong: ingredient parsing, unit normalisation and
conversion, grocery aggregation, serving scaling, leftover arithmetic,
recommendation scoring, weekly plan generation, recipe import parsing, share
encoding and backup validation.

### Checks

```bash
npm run typecheck
npm run lint
npm run build
```

### Icons

Icons are committed. After editing `public/favicon.svg`:

```bash
npm install --no-save sharp && npm run icons
```

---

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages

Pushing to `main` runs `.github/workflows/deploy.yml`, which type-checks, lints,
tests and builds before publishing `dist`. A failure at any step stops the
deployment, so a broken build never reaches the site.

Two details make Pages work:

- `vite.config.ts` sets `base: '/MealHelp/'`, so every asset and the service
  worker scope sit under the repository name.
- Routing is hash-based. Pages returns 404 for unknown paths, so a refresh on
  `/MealHelp/plan` would break — `#/plan` cannot. It also gives share links a
  fragment to hide their payload in.

---

## Data storage

Everything is in IndexedDB on the device that created it: recipes, meal plans,
planned meals, cook events, grocery lists, pantry items, collections, feedback
and settings. `localStorage` is not used for anything that matters.

Nothing is sent anywhere. There is no analytics, no account and no sync. The
flip side is that clearing your browser data deletes your recipes, so:

## Backup and restore

**Settings → Export backup** writes a JSON file containing every table.

**Import backup** validates the file before touching anything, then offers:

- **Merge** — keep what is here, add what is missing, overwrite matching ids.
- **Replace** — empty everything first. Confirmed explicitly, because it is the
  one action that can lose data you did not choose to delete.

The file is plain JSON on purpose: it can be read, diffed and salvaged by hand.

---

## Recipe import

MealHelp has no server, so importing a recipe means getting somebody else's page
somehow. Two separate obstacles stand in the way:

1. Browsers refuse to read another site's page unless that site opts in, and
   almost no recipe site does.
2. The largest sites — Allrecipes, Serious Eats, Simply Recipes — refuse
   anything that is not a person with a browser, whoever is asking.

No single trick beats both, so import is a ladder. Each rung is tried in turn,
and the last one always works:

| Route | Reaches | Setup |
| --- | --- | --- |
| The site directly | The few that allow it | None |
| **Your own fetcher** | Most sites | Deploy `worker/` (optional) |
| **Shared public fetchers** | Most sites | None; can be turned off |
| **The MealHelp button** | **Everything** | One-time, ~2 minutes |
| Pasted text | Everything | None |

### The MealHelp button

This is the one that always works, because it sidesteps the problem rather than
fighting it: **the page is already open in your browser**, so there is no
cross-origin request to refuse and no robot to turn away. A small script reads
the recipe out of the page and hands it to MealHelp in a link.

- **iPhone/iPad** — a Shortcut with *Run JavaScript on Web Page*, shown in the
  Share sheet. Open a recipe in Safari, tap Share, tap **Add to MealHelp**.
- **Computer** — the same script as a bookmark on the bookmarks bar.

Both are generated for you, with copy buttons, on the Import screen. Only the
recipe fields travel, which is what keeps a 700 KB page down to a link of a few
thousand characters — a real Budget Bytes recipe comes to about 6 KB.

### Your own fetcher

`worker/` holds a ~40-line Cloudflare Worker that fetches a page and returns it
with CORS headers. Deploy it, paste its URL into Settings, and MealHelp tries it
before anything public — so no third party learns which recipes you read. It is
optional, and it cannot get past the sites in (2) either; nothing on a server
can.

### Shared fetchers

Without a fetcher of your own, MealHelp falls back to shared public ones. There
are several, tried in turn, precisely so that none of them can take import down
by disappearing. The honest cost is that the *address* of the recipe passes
through a third party, which is why there is a switch for it in Settings.

Every import — whichever route it came by — is previewed and editable before it
is saved, and the original line of every ingredient is kept exactly as written.

---

## Discovery

Import assumes you already found a recipe. **Discover** is for when you have not.

Four ways in:

- **From my pantry** — pick from what MealHelp knows you keep around, add
  anything else, and get results ranked by how many of those ingredients each
  recipe actually uses. Partial matches are shown, not hidden: a recipe using
  one of your three is still worth seeing, it just sorts below one using all
  three. Staples like salt and olive oil are left out of the search, because
  they match half of everything.
- **Search** — by name, across every source at once.
- **Browse** — by kind of dish or by cuisine, for when you would rather look
  than type.
- **Surprise me** — a handful at random, for when nothing sounds good.

Opening a result shows the same preview screen the importer uses, so a
discovered recipe is checked over in exactly the same place as a pasted one
before it is saved. Recipes you already have are marked, so discovery does not
offer you your own cookbook back.

### Where results come from

Searches run across every source at once and the results are interleaved and
labelled, so one source being slow or down never empties the screen.

| Source | What it adds | Needs |
| --- | --- | --- |
| [TheMealDB](https://www.themealdb.com) | A few hundred well-organised recipes, browsable by dish type and cuisine | Nothing |
| [Wikibooks Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents) | Thousands more, CC BY-SA, run by the Wikimedia Foundation | Nothing |
| [Spoonacular](https://spoonacular.com/food-api) | Hundreds of thousands, plus ingredient search that ranks by what you are missing | A free key of your own |

The bar for being in that list: no account, no key baked into the app, the data
is offered for this sort of use, and whoever runs it is unlikely to vanish or
start charging without warning.

A Spoonacular key is yours, stays on your device, and is only ever sent to
Spoonacular. Nothing is shipped with the app, because a key baked into a static
site is a key given away to everyone who views source.

Two details worth knowing about the free sources. The Wikibooks search is
restricted to its Recipes category — a plain search for "lasagne" otherwise
offers you Basil and the Manual of Style, because those pages mention it. And
TheMealDB's cuisine list is fixed in the code rather than fetched: its own
endpoint returns 195 countries, most of which hold nothing, and checking them
at runtime would mean 195 requests against a free service that rate-limits.

Either way the original publisher's link is kept and shown; saved recipes are
yours from then on, and nothing about cooking, planning or shopping depends on
any of it being up.

**This is the only part of MealHelp that needs a connection.** When it is
unavailable you get a plain explanation and a route to the paste importer,
never a spinner or a raw network error.

---

## PWA installation

**iPhone/iPad:** open the site in Safari → Share → *Add to Home Screen*.
**Desktop Chrome/Edge:** the install icon in the address bar.

Once installed, saved recipes, the meal plan and the grocery list all work with
no connection. When a new version ships, MealHelp asks before refreshing — it
will not reload itself out from under you on step four of a recipe.

---

## Roadmap

Built and working today: everything above.

Ideas that fit the architecture but are not built:

- Saved menus and reusable weekly templates ("Cold Weather Week")
- Approximate pantry quantities, freezer inventory and expiry reminders
- Ingredient substitutions recorded per recipe
- Recipe edit history
- A serverless or extension-based importer for sites that block direct fetch
- More discovery providers behind the existing provider interface
- Optional AI behind a service interface, for parsing very messy pasted text and
  suggesting tags — never required for anything core

Deliberately out of scope: calorie counting, fitness tracking, social features,
grocery delivery, restaurant discovery, and a chatbot.

---

## Licence

Personal project. Recipes shipped with the app were written for it.
