import type { StartingSite } from './types'

/**
 * Sites worth starting from, and sites that will not open here.
 *
 * Both lists are honest snapshots rather than promises. The starting sites are
 * ones that opened inside the frame when this was written, chosen for having
 * proper recipe markup and being the kind of place people actually cook from.
 * The walled hosts are the ones that turn away anything that is not a person
 * with a browser — a fetcher of any kind included — so trying is a waste of
 * everyone's time and they are sent to the real browser straight away.
 *
 * Sites change their minds, which is why the walled list also learns: any host
 * that answers with a wall at runtime is remembered for a while (see
 * browserMemory), and any host on the list can still be tried on request.
 */

export const STARTING_SITES: StartingSite[] = [
  { name: 'Budget Bytes', url: 'https://www.budgetbytes.com/', blurb: 'Cheap, quick, cost per serving' },
  { name: 'BBC Good Food', url: 'https://www.bbcgoodfood.com/', blurb: 'Tested recipes, metric measures' },
  { name: 'RecipeTin Eats', url: 'https://www.recipetineats.com/', blurb: 'Reliable weeknight dinners' },
  { name: 'Smitten Kitchen', url: 'https://smittenkitchen.com/', blurb: 'Home cooking, written well' },
  { name: 'Skinnytaste', url: 'https://www.skinnytaste.com/', blurb: 'Lighter everyday meals' },
  { name: "Natasha's Kitchen", url: 'https://natashaskitchen.com/', blurb: 'Family favourites' },
  { name: 'Cookie and Kate', url: 'https://cookieandkate.com/', blurb: 'Vegetarian and whole foods' },
  { name: 'Minimalist Baker', url: 'https://minimalistbaker.com/', blurb: '10 ingredients or fewer' },
  { name: 'Love and Lemons', url: 'https://www.loveandlemons.com/', blurb: 'Vegetable-forward' },
  { name: 'Pinch of Yum', url: 'https://pinchofyum.com/', blurb: 'Simple, big flavours' },
  { name: 'Half Baked Harvest', url: 'https://www.halfbakedharvest.com/', blurb: 'Cosy, generous cooking' },
  { name: 'The Mediterranean Dish', url: 'https://www.themediterraneandish.com/', blurb: 'Mediterranean everyday' },
  { name: 'The Woks of Life', url: 'https://thewoksoflife.com/', blurb: 'Chinese home cooking' },
  { name: 'Just One Cookbook', url: 'https://www.justonecookbook.com/', blurb: 'Japanese home cooking' },
  { name: "Swasthi's Recipes", url: 'https://www.indianhealthyrecipes.com/', blurb: 'Indian, step by step' },
  { name: "Sally's Baking", url: 'https://sallysbakingaddiction.com/', blurb: 'Baking that works' },
  { name: 'King Arthur Baking', url: 'https://www.kingarthurbaking.com/', blurb: 'Bread and baking' },
  { name: 'Once Upon a Chef', url: 'https://www.onceuponachef.com/', blurb: 'Tested and perfected' },
  { name: 'Downshiftology', url: 'https://downshiftology.com/', blurb: 'Healthy, gluten-free' },
  { name: 'Taste of Home', url: 'https://www.tasteofhome.com/', blurb: 'Reader recipes, huge range' },
  { name: 'Jamie Oliver', url: 'https://www.jamieoliver.com/', blurb: 'British, relaxed' },
  { name: 'Spend with Pennies', url: 'https://www.spendwithpennies.com/', blurb: 'Comfort food, budget' },
]

/**
 * Hosts that refuse every fetcher. Mostly one publisher's family of sites,
 * which share one bot wall, plus a few that put a browser challenge in front.
 */
const WALLED_HOSTS = [
  // Dotdash Meredith
  'allrecipes.com',
  'seriouseats.com',
  'simplyrecipes.com',
  'thespruceeats.com',
  'eatingwell.com',
  'foodandwine.com',
  'southernliving.com',
  'marthastewart.com',
  'myrecipes.com',
  'realsimple.com',
  'bhg.com',
  'thekitchn.com',
  'food52.com',
  'damndelicious.net',
  'wellplated.com',
  'tasteatlas.com',
  // Sign-in required as well as walled; nothing here could show it anyway.
  'cooking.nytimes.com',
]

export function normaliseHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '')
}

function matchesHost(host: string, candidate: string): boolean {
  return host === candidate || host.endsWith(`.${candidate}`)
}

/** True when the host is one of the sites known from the start to turn fetchers away. */
export function isKnownWalledHost(host: string): boolean {
  const normalised = normaliseHost(host)
  return WALLED_HOSTS.some((walled) => matchesHost(normalised, walled))
}
