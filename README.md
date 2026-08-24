# MealHelp

Planning food for a week normally means finding recipes across a dozen
websites, working out which of them make sense together, deciding which nights
to cook, turning all of it into one grocery list, and then reopening those same
messy websites while you cook.

MealHelp compresses that into: **look at food → put it on a day → shop from
one list → cook from recipes that all look the same.**

It is a local-first web app. Everything lives in your browser; there is no
account, no server, and nothing is uploaded.

**Live:** https://kidsdc.org/MealHelp/

---

## What it looks like

It is a board of food, not a calendar. **Home** opens on tonight's meal at the
size of a photograph, what is coming after it, what is already in the fridge,
and then a feed to browse: mood chips — *comforting, fresh, very easy, big
batch, cheap, good for leftovers, use what I have, something different* — and a
wall of picture cards under them.

The twelve recipes MealHelp ships with come with nutrition already estimated
from their own ingredients, so the nutrition page is useful in the first week
rather than after twelve trips to twelve recipe pages. They also come with real
photographs of the food
— freely licensed pictures from Wikimedia Commons, bundled with the app rather
than linked, so they work offline and no photo site learns what you are
cooking. Credits are in **Settings → Photo credits** and below.

Every meal, everywhere in the app, is the same card: the photograph is the
card, with its name, its hands-on time, a cost mark and at most three badges
that would actually change your mind (`20 min`, `One pan`, `Slow cooker`,
`Great leftovers`, `Freezer friendly`, `High protein`, `Budget`, `Easy
cleanup`). Recipes without a picture get generated artwork drawn from the
title, so a typed-in library still looks like a shelf of different books.

**Adding a meal to the week is two taps and no screens.** Tap **+** on any card
— on the home feed, in the library, on a recipe page — and a strip of seven
days slides up over the tab bar, marking the days that already have something.
Tap a day; it is done, with an undo in the confirmation.

The week is seven pictures, not a spreadsheet: a carousel on a phone, a row of
cards on a desktop, today outlined and days gone by faded. Leftovers are drawn
rather than explained — the night that cooks says *↻ Feeds Fri*, and Friday
carries the same photograph behind a dashed edge marked *↻ From Thu*. Drag a
card to another day, or tap it to open what it can do. Breakfast and lunch only
split a day into rows when you have turned them on.

The grocery list connects back the same way: every line carries small pictures
of the meals that wanted it, so *Onions ×3* answers "what is this for?" without
a tap.

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

**Weekends included.** The days to plan are yours to pick, with *Whole week*,
*Weekdays* and *Weekend* a tap away — and the whole week is the default, since
a planner that quietly stops on Friday leaves out the two days most people
actually cook on.

**And it is one tap.** *Plan it for me* — on Today, on the planner, on an empty
week — builds the week from your saved defaults the moment your library is in,
with no form in the way; *Customise* is the same screen with the form open. The
presets (Easy week, Cheap week, Crock-Pot heavy…) build a week the moment you
tap them too. On the preview, every cooking night has a **Try another** button:
the next-best recipe for that night, ranked against the rest of the week as it
stands, with whatever you have already turned down for that night kept out —
and if that night feeds the leftover nights after it, they follow, and the batch
is sized for all of them.

**Or let it surprise you with a week you have never cooked.** *Surprise me* on
the planning screen asks the recipe databases rather than your library, in the
words of the preferences already on screen — what you want to use up, the
appliances you leaned towards, budget, effort — and plans the week from what
comes back, for whichever meals the scope covers. Nothing is saved until you
accept, and then the new recipes join your library with their sources.

**Brainstorm a week that fits.** Say what it has to fit inside — a budget for
the week, the longest hands-on night you will accept, a protein goal — and the
plan is measured against all three the moment it is built: *This week $85 of
$45*, *Longest night 25 min of 20*, *Protein 76 g of 90*. The two people
actually act on come with a way to act: **Make it cheaper** leans the planner
towards budget recipes and the pantry, **Make it quicker** puts a ceiling under
the longest night. Figures the app could not count in full are shown as a floor
— "at least 76 g" — and never judged against a goal, because telling someone
they missed a target you did not measure is worse than saying nothing.

**You choose how much of the day gets planned.** *Just dinners*, *dinners +
lunches*, or *every meal* — a kitchen can have breakfast, lunch, dinner and a
snack set up and still only want this week's dinners decided. Whatever is out
of scope is left exactly as it was, and the choice is remembered.

**The day is yours to describe.** Settings → Your day lists the meals you
actually eat, in order, each with a rule for how it gets filled: *cook
something* (the planner decides, N times a week), *the same thing every day*
(write it once — "a bowl of Kellogg's Strawberry Special K" — and it fills
every morning, with what it needs from the shop added to the list once for the
week, not seven times), *leftovers from earlier*, or *leave it to me*. Add as
many as you like, name them what you call them, set how many people each feeds
and which days it happens on — a big weekend breakfast is a different slot from
a weekday one.

Planning then covers the whole day rather than dinner alone. A recipe written
for dinner will happily fill a lunch — yesterday's dinner is today's lunch, and
almost nobody tags recipes as lunches — while one written for the meal wins
when there is one. Breakfast stands alone, because a chili at eight in the
morning is not a near miss, and when the library has no breakfasts the plan
says so once and points at the web rather than leaving five silent gaps. Each cooking slot
gets its own rhythm, and a leftovers slot eats from cooking earlier in the week
— which means the cooking is *sized* for it: cook Monday's chili for the
Tuesday and Wednesday lunches too, and the plan says so ("Cooks 16 servings —
enough to eat again later in the week"). It will not serve a portion twice, and
it will not offer Monday's lunch the leftovers of Monday's dinner.

A standing meal can carry its own numbers — calories, protein, carbs, fat, off
the packet — because a routine has no recipe to read them from. Without that a
day of cereal, leftovers and dinner reported two thirds of what was eaten.

**And you can read the recipes before you commit to them.** Every meal in the
plan preview is a photograph, and *Look at it* opens the whole recipe in
place — ingredients scaled to the servings the plan actually intends, the
directions, and a link to the full page — so accepting a week is not a decision
made from seven titles.

The same brain fills a single night. **Add → Suggest something** on any day of
the planner ranks your library the way the planner does — your defaults, your
pantry and equipment, what you cooked lately, what is already on the week — and
offers one pick with its reasons: *Add*, *Another*, or *Choose myself*.

### Everything else

- **Cooking together** — two phones, one kitchen. **Settings → Cook together →
  Start a household** makes a code; *Send an invite* texts the other person a
  link that joins them in a tap. From then on both phones see the same recipes,
  the same planned week and the same shopping list — tick something off in the
  shop and it goes for them too. Nothing to sign into, and no data of yours on
  anybody's server in a readable form: see [Cooking together](#cooking-together).
- **Favourites** — tap the heart on anything and it lands in its own tab: the
  shortlist you actually cook from, with a shelf of ideas from the recipe
  databases underneath, because what you favourite says more about your taste
  than any filter does.
- **Surprise me** — for the evening when no mood fits either. One meal,
  picked at random from whatever is on screen (so a surprise still respects
  the mood you tapped), with *Put it on a day*, *Another* and *Cook it now*.
  It remembers the last few picks and refuses to repeat them, because true
  randomness on a library of a dozen shows the same dinner twice often enough
  to read as broken. When your own shelf has nothing, it rolls the recipe
  databases instead. The browser has the same dice — in the toolbar and on its
  start page — where it asks the web a question you would not have thought to
  ask ("tomato and butter bean stew"), and the recipe databases have one that
  works in a single tap.
- **Discovery without the effort** — the mood chips (*comforting, fresh, very
  easy, cheap…*) narrow your own shelf and then ask the same loose question of
  the free recipe databases: **"Comforting ideas from the web"** sits under the
  feed, one tap, with *Other ideas* for a different answer. Every recipe page
  carries the same shelf — **more like this from the web**, searched for the
  dish rather than the appliance, so "Slow Cooker Chicken Curry" finds chicken
  curry. Nothing is fetched until you press it.
- **Recipe library** — opens on shelves worth browsing: *Easy Crock-Pot meals*,
  *Easy Instant Pot meals*, *One pot meals*. Under them, mood chips and a wall
  of picture cards. Narrow by mood first — that is how people actually choose —
  then by what a recipe *is*: Crock-Pot, Simple, Hands off, Big batch, Great
  leftovers, each with a live count so a dead end is visible before you tap it.
  Photographs lead; recipes without one fold into a section with a visible
  count. Plus instant search across titles, ingredients, tags, notes and
  cooking methods, and a compact list view when you would rather scan names.
- **What a recipe costs** — on the card, per serving, so two recipes can be
  compared at a glance; and on its own page, under the ingredients: about
  £19.70, £3.29 a serving, with every line priced. It follows the ½×–4× scale,
  so doubling the batch doubles the total and leaves the per-serving figure
  alone. Costed as the *amount used* — two tablespoons of oil are two
  tablespoons of a bottle, not a bottle — which is the same rule the week's
  shop uses, so a recipe and the list it lands on can never tell different
  stories. Things you said you always have are counted separately, because
  "what will this cost me" is not the same question as "what does this
  contain". Tap any line to use your price instead, and it is remembered.
- **One standard recipe view** — once a recipe is in MealHelp you should never
  need the original page again. Scaling — ½× to 4×, or set the servings
  themselves for the times you are cooking for five and the recipe says four —
  and it stays scaled when you come back to it. Counted things stay countable:
  three times one onion is *3 onions*, not 3.17 onion. Ingredient checkboxes,
  numbered directions, notes, equipment, and a link back to the source. And
  everything you would want to *do* with a recipe is a tap away: start cooking,
  add it to a day, **add its ingredients to the grocery list** (pick the
  servings, untick what you already have, and pick it back up where you left it
  if something interrupts), put it in a collection, rate it,
  log that you cooked it, favourite, share, duplicate, copy the ingredients as
  text, open the original in the built-in browser, edit, delete.
- **Import** — paste a link and MealHelp reads the page's structured recipe
  data. When a site refuses to share its page, it hands over to a paste box that
  parses the text instead. See [Recipe import limitations](#recipe-import-limitations).
- **A recipe editor that reads what you type** — paste a whole recipe from a
  message or a note and it fills the form (only the fields still empty); as you
  write, it says how the recipe reads ("Reads like Slow Cooker · One Pot — use
  those") rather than making you tick appliances; and if you type a name you know
  from a website, it offers to find it in the built-in browser instead.
- **Recipe databases** (Browser → Recipe databases) — find recipes you do not
  have yet. Search by name, ask for a surprise, or tell it what is in the
  fridge and get recipes ranked by how many of your ingredients they use.
  Saving one turns it into an ordinary MealHelp recipe, source link and all.
  See [Discovery](#discovery).
- **Browser** — a web browser inside MealHelp, the way Mela has one. Search the
  web or open a recipe site, read the page as itself, and when the page has a
  recipe on it an **Add** button appears. Results are drawn as cards, not blue
  links: each carries the picture the page publishes for people who link to it,
  and two or three tags read out of its own title — *Crock-Pot*, *One pan*,
  *30 min*, *Budget*. Pictures are fetched only for results you scroll to, two
  at a time, and never invented: a title that claims nothing gets no tags. Nothing to set up, nothing leaves the
  device but the page request. See [The built-in browser](#the-built-in-browser).
- **Cooking mode** — full screen, big type, one step at a time, and the screen
  stays awake. Each step carries **the amounts it is talking about**: "brown
  the beef with the onion" comes with *2 lbs ground beef* and *1 yellow onion*
  under it, tickable, with the rest a tap away — no going back to the list with
  wet hands. Swipe or tap between steps, tap **Step 3 of 9** for the whole
  method and jump anywhere in it, and start a timer from any step that names a
  time ("simmer 20 minutes" → *Start 20 min timer*), whether or not the recipe
  came with one.
- **It keeps your place** — where you were in a recipe, which ingredients you
  had ticked and how much you were making all survive the phone locking, the
  page reloading, or the app being closed and reopened mid-cook. Timers survive
  it too, and follow you around the app: start one in the kitchen and it is
  still counting on the shopping list.
- **Leftovers as real things** — cooking six servings and eating two leaves four
  in the fridge. Those four can fill Tuesday, and the grocery list does not buy
  the ingredients twice.
- **Grocery list** — one list from the week's cooking. Same ingredients add up
  across recipes (1 onion + 2 onions = 3 onions; 1 tbsp + 2 tbsp olive oil =
  3 tbsp), incompatible quantities stay apart (1 bunch cilantro *and* 20 g
  cilantro), everything is sorted by aisle, and each item remembers which
  recipes wanted it. Add anything by hand — paper towels included — or add a
  whole recipe from its page without planning it: it shows up as "also
  shopping for", its quantities merge with the plan's, and it survives the
  list being rebuilt.
- **Send the list to whoever is going** — *Share* → **Send as a text** puts the
  whole list, by aisle, into a message, with a link to the tickable version
  underneath. Whoever is in the shop can read it without installing anything;
  if they have MealHelp too, link phones instead and their ticks come back.
- **Pantry** — the things you always have are pulled into a short "check the
  pantry" list instead of being assumed or silently dropped.
- **Meal ideas from the trolley** — the grocery list has its own *Surprise me*,
  which answers the question that page actually raises: not "what shall I eat
  this week" but "I am buying all this anyway, what else could it be". It ranks
  your recipes by how much of them the list already covers and picks from those.
- **What the shop will cost** — the grocery list totals itself, broken down by
  aisle so it is obvious what is driving it, with every line priced. The
  built-in prices are typical US supermarket prices and the panel says so;
  correct any line and MealHelp uses your price for that ingredient for ever
  after. It reads a shopping line the way a recipe site writes one — the size
  out of the brackets in "1 (14-ounce) package tofu", "freshly grated Parmesan"
  as parmesan, an inch of ginger as a piece of ginger — because the app's own
  starters priced cleanly long before an imported recipe did, which is exactly
  how a gap like that stays invisible. Where a recipe quantity cannot honestly be converted into a shopping
  one it shows a dash rather than a number, and the total says how much of the
  list it covers.
- **Ratings and history** — say how a meal went and it changes what gets
  suggested next. Repeat a good week with one button.
- **Print** — a refrigerator sheet for US Letter, with a QR code per cooked meal
  and one for the grocery list. And any recipe, or a whole collection, as a
  printable page: facts across the top, tick-box ingredients down the left,
  directions down the right, nutrition and a QR code back to the recipe under,
  with scale, photo, large-text and QR switches above the sheet.
- **Nutrition** — per-serving nutrition on every recipe, and a daily overview
  that adds the week up. See [Nutrition](#nutrition).
- **Backup** — export everything as JSON, restore by merging or replacing.
- **Installable** — works offline once loaded, on iPhone and desktop.

---

## Sections

Five, the way a recipe app settles down (Mela's tabs are Recipes, Browser,
Calendar, Shopping). Everything else is a view inside one of them, reachable
by a pill of tabs at the top of the section, and every old address still
lands in the right place.

| Section | Views inside it |
| --- | --- |
| **Recipes** | All · Collections · What can I make? — and one **Add** menu: find it online, import a link, paste text, type it in, starter recipes |
| **Browser** | Web · Recipe databases (TheMealDB, Wikibooks, Spoonacular) — the built-in browser is a main section, as in Mela |
| **Plan** | Week (with *Tonight* at the top on the current week) · Nutrition · History |
| **Grocery** | List · Pantry |
| **More** | Nutrition, History, Pantry, Collections, Import, Print this week, Settings |

Plus the full-screen views: a recipe, cooking mode, the plan wizard, the
refrigerator sheet and the printable recipe.

### Searching

Every section has the same compact search pill — the icon in its own column
so it never overlaps what you type, a clear button, 44px tall, and nothing
else. In Recipes the filters are one scrolling row of chips with a count on
each plus a single Filters sheet; in the databases the "how" is a select
rather than four tabs; in Grocery and Pantry one field both finds what is on
the list and, on Enter, adds what you typed.

### Themes

Settings → Appearance. Twelve palettes — White, Paper, Sage, Ocean, Plum,
Citrus, Slate, Graphite, Rose, Forest, High contrast and the dark-only
Midnight — each drawn in miniature with its own colours so you can see it
before you tap, and applied the moment you do. The choice is kept in the
database and mirrored to localStorage so the first paint after a reload is
already the right colour.

Light and dark is a separate choice, and **light is the default**. Following
the system sounds tidier and was not: somebody who had just chosen a white
theme still got a dark kitchen after sunset, which reads as the choice not
having stuck. *Follow system* is still one tap away in the same row, and a
phone that was already on it is moved to light exactly once — choosing it
again afterwards sticks.

---

## Architecture

```
src/
  app/          App shell, routing, settings context
  db/           Dexie database and one repository per domain
  models/       Recipe, MealPlan, Grocery, Pantry, Settings
  features/     One folder per section or view (home, recipes, browser, planner,
                planning, cooking, grocery, pantry, import, discover,
                collections, history, nutrition, print, sharing, settings)
  services/     Pure logic, no React and no database:
                  ingredientParser/    text → structured ingredient
                  unitConversion/      units, safe conversion, formatting
                  groceryAggregator/   many recipes → one list
                  recommendationEngine/  which recipe fits this slot
                  plannerEngine/       how cooking and leftovers fall across a week
                  recipeImport/        adapters, JSON-LD, paste parsing, the fetch ladder
                  recipeDiscovery/     providers, pantry-overlap ranking
                  pageBrowser/         page preparation for the frame, web search, known sites
                  shareCodec/          compressed share payloads
                  backup/              export, validation, restore
  components/   Shared UI, including meal/MealCard — the one card every meal
                is drawn as, at four sizes (hero, feed, slot, compact)
  utils/        Dates, ids, image resizing
  styles/       Design tokens, base, primitives, print
```

One card, everywhere. A meal in the home feed, a day of the week, a row in a
picker and tonight's hero are the same component at different sizes, so a meal
looks like itself wherever it turns up and a change to how food is presented
happens in one file. What goes on a card — the badges, and which mood a recipe
belongs to — is plain, tested logic in `features/recipes/mealBadges.ts` and
`moods.ts`, next to the rest of the "what is this recipe like" judgements.

Two rules shape the layout. **Domain logic never lives in a component** — the
recommendation weights, the grocery maths and the planner rules are all plain
functions that can be read and tested on their own. And **the recommender and
the planner are separate**: one answers *which recipe fits this slot*, the other
answers *how should cooking and leftovers be spread across the week*. Conflating
them is how you end up recommending five unrelated meals for five nights.

React state is deliberately unremarkable: IndexedDB is the source of truth, read
live through `dexie-react-hooks`, with React context for settings and toasts.
There is no store library because nothing here has needed one.

### Recipes without a photograph

Most recipes people type in have no picture, so the gallery has to have an
answer for that. Three prior art approaches, and what MealHelp took from each:

- **Mealie** listens for the image's own `error` event and swaps in an icon.
  This is the important one: a URL is not proof of a picture, and imported
  recipes point at somebody else's server whose links rot. MealHelp does the
  same, and a recipe whose image fails moves itself out of the photo section.
- **Tandoor** ships one static placeholder SVG. Simple, but a wall of identical
  placeholders is not browsable, so MealHelp generates artwork instead — a warm
  wash picked deterministically from the title, with the cooking method drawn
  large.
- **Paprika** never hides a recipe; it offers a photo grid and a condensed list
  and lets you switch. MealHelp keeps that principle: the ones without photos
  are folded, never hidden, and their count is always on screen.

The approaches were read and reimplemented, not copied — those projects are
Vue, Django and closed-source respectively, and none of their code is here.

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

There is no analytics and no account. Nothing is sent anywhere unless you link
a household (below), and even then it goes up encrypted. The flip side of local
storage is that clearing your browser data deletes your recipes, so:

## Backup and restore

**Settings → Export backup** writes a JSON file containing every table.

**Import backup** validates the file before touching anything, then offers:

- **Merge** — keep what is here, add what is missing, overwrite matching ids.
- **Replace** — empty everything first. Confirmed explicitly, because it is the
  one action that can lose data you did not choose to delete.

The file is plain JSON on purpose: it can be read, diffed and salvaged by hand.

---

## Cooking together

Two people planning the same week need the same data on two phones, and
MealHelp has no accounts and no server. What it does have is the Worker in
`worker/` — so a household is a shared key into that Worker's store, and
everything else happens on the phones.

**Settings → Cook together.** One phone taps *Start a household* and gets a
code (`5vjj-5dux-nkcq-nw4w`). *Send an invite* opens a text with a link that
joins the other phone in a tap, or they type the code in by hand. Syncing then
happens whenever either of you opens MealHelp, and *Sync now* is there for the
moment in the shop when you want it this second.

### What is shared, and what is not

Shared: recipes, plans, planned meals, cook history, grocery lists, the pantry,
collections, feedback and the kitchen half of settings — meal slots, servings,
equipment, budget.

Not shared: your theme, light or dark, your own page fetcher, and your
nutrition log. A shared kitchen is not a shared screen, and your calories are
not your partner's.

### How it settles disagreements

Every record carries `updatedAt`, so the newest edit wins. Nothing is merged
field by field: two people editing one recipe in the same minute is rare, and a
merge producing a recipe neither of them wrote is worse than one of them
redoing an edit.

Deletions travel as tombstones. Without them, a recipe one person deletes comes
back the next time the other syncs — for ever. A tombstone loses to a record
edited *after* it was deleted, which is how "I deleted it" and "no, I changed
it" are told apart without asking anybody.

A phone always pulls and merges before it pushes, so a sync never throws away
what the other one just said.

### What the Worker can see

Nothing. The blob is encrypted on the phone with AES-GCM before it leaves, and
the household is filed under a SHA-256 of the code rather than the code itself.
The Worker holds an id it cannot reverse and bytes it cannot open.

Which leaves the code as the whole of the security: **anyone with it can read
and change your kitchen**. Send it the way you would a spare key. The invite
link keeps it in the URL fragment, so it never reaches a web server — not even
the one serving MealHelp — and the app removes it from the address bar the
moment it has been used.

Unlinking is per-phone and deletes nothing: both devices keep everything they
had.

### Setting up the sync store

The live Worker's namespace is already made and bound, so this works on
kidsdc.org as it stands. Running your own copy takes one command from
`worker/`:

```bash
npx wrangler kv namespace create HOUSEHOLDS
```

Put the id it prints in the `[[kv_namespaces]]` block in `wrangler.toml`, then
`wrangler deploy`. Without the binding the Worker still fetches pages and
simply says so when asked to sync.

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
| **Your own fetcher** | Most sites | Deploy `worker/` yourself (optional) |
| **MealHelp's fetcher** | Most sites | None — the same Worker, run for the site |
| **Shared public fetchers** | Most sites, slowly | None; can be turned off |
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

### MealHelp's fetcher, and your own

`worker/` holds a ~40-line Cloudflare Worker that fetches a page and returns it
with CORS headers. One copy of it is deployed for the live site
(`mealhelp-fetch.kidsdc.workers.dev`, answering only MealHelp's own origins) and
built into the app as the rung after "the site itself" — so import and the
built-in browser work from the live site with no setup, at Worker speed, with
no size cap. It cannot get past the sites in (2); nothing on a server can.

If you would rather nothing but you and the site saw what you read, deploy the
same Worker to your own account and paste its URL into Settings: yours is tried
before MealHelp's.

### Shared fetchers

After both of those, MealHelp falls back to shared public ones. There are
several, tried in turn, precisely so that none of them can take import down by
disappearing — and disappearing is what they do: checked from the live site,
corsproxy.io answers only from localhost, allorigins takes ten seconds or more,
and codetabs was down. They remain as a last resort. The honest cost is that
the *address* of the recipe passes through a third party, which is why there is
a switch for them in Settings.

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

## The built-in browser

Import assumes you have a link. Discover searches a few curated databases. The
**Browser** is for the rest of the web: the blog you like, the magazine site,
the thing a friend mentioned. It works the way the browser in Mela does — you
search or type an address, you read the page as itself, and when the page has a
recipe on it an **Add** button appears. Add shows the same preview screen as
Import, and saving keeps you on the page so you can carry on browsing.

Three things make it a browser rather than a picture of a page:

- **It searches.** Type words instead of an address and MealHelp searches the
  web with "recipe" added to what you typed, and draws the results itself.
  Three engines are tried in turn, because which one answers depends on which
  fetcher the request went through: Brave Search (good results, but it
  rate-limits Cloudflare's addresses, so from the live site it usually
  declines), DuckDuckGo's lite page (answers the Worker; one page of ten), and
  Bing's results feed (answers from anywhere, but has a habit of answering a
  multi-word query with results for its first word alone — "slow cooker chili"
  comes back as dictionary entries for *slow* — so its answers are checked
  against the words asked for, and asked again fresh when they do not match).
  Results from sites that open inside MealHelp come first; the ones that only
  answer a real browser are grouped after and marked. Videos and social posts
  are left out, since neither can be read here.
- **Links work, and so do site search boxes.** Every link on the page and every
  ordinary search form is routed back through MealHelp's own loader, so you can
  wander a site the way you would in Safari. Back and forward work, and coming
  back from a recipe to the results you found it in is instant.
- **Nothing on the page can act.** Pages are shown in a sandboxed frame with
  scripts off. You get the words, the pictures and the site's own styling — and
  no pop-ups, cookie walls, autoplaying video or ads, because those are drawn by
  the scripts that are not running. Lazily loaded photographs are given their
  real addresses before the page is shown, since the script that would have
  done it is not coming.

### How a page gets in

The frame cannot load a site directly: almost every site forbids being framed,
and even a site that allowed it would be a sealed box MealHelp could not read
the recipe out of. So the browser fetches the page's HTML through the same
ladder Import uses — the site itself, your own fetcher if you set one,
MealHelp's Worker, then the shared ones — prepares it (a `<base>` for the page's own address, scripts and preload
hints removed, lazy images fixed, a meta refresh that would carry the frame off
dropped), and hands the result to the frame as `srcdoc`.

That has one honest consequence: **the browser can open exactly the sites that
Import can import, and no others.** The largest publishers — Allrecipes,
Serious Eats, Simply Recipes and the rest of that family, NYT Cooking, The
Kitchn — turn away anything that is not a person with a browser, and a fetcher
of any kind is not one. Those sites are known from the start (and any site that
answers with a wall is remembered for a fortnight), so tapping one does not
make you wait through every route failing: it says so at once and offers to
open the page in your real browser, where the MealHelp button still works. You
can also insist on trying it here.

Pages with a recipe in the words but not in the markup — older blogs, mostly —
get a quieter offer to read the visible text instead, the same way the MealHelp
button falls back when a page has no structured data.

Where you were is kept for the session, so switching to the grocery list and
back does not lose the recipe you were reading. Recently viewed pages and the
learned list of walled sites live in localStorage; nothing else about the
browser is stored anywhere.

### What it does not do

It does not run the site's JavaScript, so anything that only exists once a
script has drawn it — a comment form, a filter that rebuilds the page, a video
player — is not there. Fonts a site serves without CORS headers fall back to
system ones. And it is not a place to sign in to anything: no cookies, no
forms that post, no way for a page to reach outside its frame.

---

## Nutrition

Three places the numbers can come from, and the label always says which:

1. **The recipe site.** Most pages publish schema.org `NutritionInformation`
   alongside the recipe. Import reads it the way Mealie's `clean_nutrition`
   does — the first number out of each string ("250 calories", "1,5 g"),
   sodium and cholesterol turned into milligrams when a site wrote them in
   grams, kJ into kcal. The MealHelp button carries it too.
2. **You.** Nine fields on the recipe editor, per serving.
3. **An estimate from the ingredients.** The method is Tandoor's recipe
   property calculation with the food list built in: each ingredient line is
   matched to one of ~110 common foods, converted to grams (mass units
   directly; volume through the food's own density, so a cup of flour is
   125 g and a cup of oil 216 g; counts through the weight of one), multiplied
   by the food's values per 100 g from USDA FoodData Central, summed and
   divided by the servings. It reports its coverage — "estimated from 7 of 9
   ingredients" — and is labelled as an estimate wherever it appears.

**Plan → Nutrition** adds a day up: every planned meal counts as one serving
eaten, leftovers included, and anything else goes in the log — typed in, or
looked up on [Open Food Facts](https://world.openfoodfacts.org) (keyless,
answers a static site directly). Four bars measure calories, protein, carbs
and fat against your targets (Settings; blank means the FDA Daily Value), the
rest sit in a table under, the week is a strip of seven bars, and a meal whose
recipe has no numbers is listed as uncounted with a way to fix it rather than
silently making the day look lighter.

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
- An extension-based importer for the sites that block every fetcher (the
  built-in browser covers everything else)
- More discovery providers behind the existing provider interface
- Optional AI behind a service interface, for parsing very messy pasted text and
  suggesting tags — never required for anything core

Deliberately out of scope: calorie counting, fitness tracking, social features,
grocery delivery, restaurant discovery, and a chatbot.

---

## Licence

Personal project. Recipes shipped with the app were written for it.

### Starter recipe photographs

The pictures on those recipes are not. Each is freely licensed, from Wikimedia
Commons, resized to 800×600 WebP and bundled under `public/starters/`. CC BY
and CC BY-SA require attribution, which is given here and in the app under
**Settings → Photo credits**; `src/features/recipes/starterPhotos.ts` holds the
same list in code, and a test fails if a photograph is shipped without credit
or credited without being shipped.

| Recipe | Photographer | Licence |
| --- | --- | --- |
| Slow Cooker Chicken Curry | Serial Number 54129 | CC BY-SA 4.0 |
| Instant Pot Beef Chili | cyclonebill | CC BY-SA 2.0 |
| Sheet Pan Chicken and Vegetables | Sharon Chen | CC BY 2.0 |
| Grilled Cheese and Tomato Soup | HarshLight | CC BY 2.0 |
| One Pot Creamy Sausage Pasta | Sarah Stierch | CC0 |
| Slow Cooker Pulled Pork | Shreveport-Bossier CTB | CC BY 2.0 |
| Weeknight Fried Rice | Stacy Spensley | CC BY 2.0 |
| Instant Pot Lentil Soup | Andy Li | CC0 |
| Black Bean Quesadillas | Sarah Stierch | CC BY 4.0 |
| Roast Chicken with Potatoes | Biso | CC BY 3.0 |
| Big Batch Turkey Meatballs | Sarah Stierch | CC BY 4.0 |
| Overnight Oats | David Stewart | CC BY 2.0 |

They are deliberately left out of the service worker's precache — nearly a
megabyte of pictures for recipes many people delete does not belong in an
install — and cached the first time they are seen instead.
