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
                cooking, grocery, pantry, import, collections, history, print,
                sharing, settings)
  services/     Pure logic, no React and no database:
                  ingredientParser/    text → structured ingredient
                  unitConversion/      units, safe conversion, formatting
                  groceryAggregator/   many recipes → one list
                  recommendationEngine/  which recipe fits this slot
                  plannerEngine/       how cooking and leftovers fall across a week
                  recipeImport/        adapters, JSON-LD, paste parsing
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

## Recipe import limitations

MealHelp has no server, so importing a recipe means your browser asking another
site for its page. **Most recipe sites refuse cross-origin requests**, and no
amount of client-side cleverness changes that. MealHelp deliberately does not
route around it through a public CORS proxy — that would make a stranger's
server a load-bearing part of your recipe box.

So import is built as a set of adapters:

| Adapter | What it handles |
| --- | --- |
| Direct fetch | Sites that allow it — reads Schema.org JSON-LD, falls back to microdata |
| Pasted page source | HTML copied from a page, including its JSON-LD |
| Pasted text | The recipe as words, parsed by heuristics |

When a link cannot be read you get this, not a network error:

> MealHelp couldn't directly access this recipe website. Paste the recipe text
> below and MealHelp will convert it into the standard format.

The paste route produces the same result, and every import is previewed and
editable before it is saved. Adding a future adapter — a serverless importer, a
browser extension, a share-sheet target — means implementing one interface and
changing nothing else.

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
- Optional AI behind a service interface, for parsing very messy pasted text and
  suggesting tags — never required for anything core

Deliberately out of scope: calorie counting, fitness tracking, social features,
grocery delivery, restaurant discovery, and a chatbot.

---

## Licence

Personal project. Recipes shipped with the app were written for it.
