/**
 * What things roughly cost.
 *
 * Every number here is an estimate and the app says so wherever it shows one.
 * There is no free grocery price API worth depending on — the ones that exist
 * need keys, cover one country, and go stale — and a static app cannot phone
 * one anyway. So this is the same shape as the nutrition table next door: a
 * modest built-in list of typical prices, which the user's own prices
 * override the moment they type one in (see db/prices).
 *
 * Prices are US dollars for a mid-range supermarket, mid-2020s, and are
 * deliberately round: the point is "this week's shop is about $85, and the
 * beef is a third of it", not a receipt.
 */

export interface PriceEntry {
  /** Matched against the normalised ingredient key. */
  key: string
  /** Price for one `unit`. */
  price: number
  /** A unit from the unitConversion table, or 'each'. */
  unit: string
  /** Other names that mean the same shopping decision. */
  aliases?: string[]
  /**
   * How much of a package one is, for the things sold by the package and
   * cooked by the piece: sixteen slices to a loaf, ten tortillas to a pack.
   * Without these, "4 slices of bread" has no honest price, because no weight
   * anybody knows converts slices into loaves.
   */
  contains?: Record<string, number>
}

export const PRICE_TABLE: PriceEntry[] = [
  // Meat and seafood — the part of a shop that actually moves the total.
  { key: 'chicken breast', price: 4.5, unit: 'lb', aliases: ['chicken breasts', 'boneless skinless chicken breast'] },
  { key: 'chicken thigh', price: 3.5, unit: 'lb', aliases: ['chicken thighs', 'boneless skinless chicken thighs'] },
  { key: 'whole chicken', price: 2.2, unit: 'lb', aliases: ['chicken'] },
  { key: 'ground beef', price: 5.5, unit: 'lb', aliases: ['beef mince', 'minced beef'] },
  { key: 'ground turkey', price: 4.8, unit: 'lb', aliases: ['turkey mince'] },
  { key: 'ground pork', price: 4.5, unit: 'lb' },
  { key: 'pork shoulder', price: 3.2, unit: 'lb', aliases: ['pork butt', 'boston butt'] },
  { key: 'beef chuck', price: 6.5, unit: 'lb', aliases: ['chuck roast', 'stewing beef'] },
  { key: 'bacon', price: 6.5, unit: 'lb' },
  { key: 'italian sausage', price: 5.5, unit: 'lb', aliases: ['sausage', 'sausages'] },
  { key: 'salmon', price: 12, unit: 'lb', aliases: ['salmon fillet'] },
  { key: 'cooked turkey', price: 6, unit: 'lb', aliases: ['cooked turkey meat', 'cooked chicken', 'leftover turkey'] },
  { key: 'beef with bones', price: 4.5, unit: 'lb', aliases: ['soup bones', 'beef shank'] },
  { key: 'shrimp', price: 10, unit: 'lb', aliases: ['prawns'] },

  // Dairy and eggs
  { key: 'milk', price: 4, unit: 'gal', aliases: ['whole milk', 'skim milk'] },
  { key: 'heavy cream', price: 4.5, unit: 'pt', aliases: ['double cream', 'whipping cream'] },
  { key: 'butter', price: 4.5, unit: 'lb' },
  { key: 'eggs', price: 0.33, unit: 'each', aliases: ['egg', 'large eggs'] },
  { key: 'cheddar', price: 5, unit: 'lb', aliases: ['cheddar cheese', 'shredded cheddar'] },
  { key: 'parmesan', price: 8, unit: 'lb', aliases: ['parmigiano', 'grated parmesan'] },
  { key: 'mozzarella', price: 5, unit: 'lb', aliases: ['shredded mozzarella'] },
  { key: 'cream cheese', price: 3, unit: 'lb' },
  { key: 'yogurt', price: 5, unit: 'qt', aliases: ['greek yogurt', 'yoghurt'] },
  { key: 'buttermilk', price: 3, unit: 'qt' },
  { key: 'margarine', price: 3, unit: 'lb', aliases: ['butter or margarine'] },
  { key: 'sour cream', price: 3, unit: 'pt' },

  // Produce, mostly by the piece because that is how it is bought
  { key: 'onion', price: 0.9, unit: 'each', aliases: ['onions', 'yellow onion', 'yellow onions', 'red onion'] },
  { key: 'garlic', price: 0.08, unit: 'clove', aliases: ['garlic clove', 'garlic cloves', 'cloves garlic', 'head garlic'] },
  { key: 'carrot', price: 0.4, unit: 'each', aliases: ['carrots'] },
  { key: 'celery', price: 0.3, unit: 'stalk', aliases: ['celery stalk', 'celery stalks'] },
  { key: 'potato', price: 0.8, unit: 'each', aliases: ['potatoes', 'russet potato', 'yukon gold potatoes'] },
  { key: 'sweet potato', price: 1.2, unit: 'each', aliases: ['sweet potatoes'] },
  { key: 'bell pepper', price: 1.5, unit: 'each', aliases: ['bell peppers', 'red bell pepper', 'green bell pepper'] },
  { key: 'tomato', price: 0.9, unit: 'each', aliases: ['tomatoes'] },
  { key: 'lemon', price: 0.8, unit: 'each', aliases: ['lemons'] },
  { key: 'lime', price: 0.5, unit: 'each', aliases: ['limes', 'lime wedges'] },
  { key: 'ginger', price: 0.6, unit: 'oz', aliases: ['fresh ginger', 'ginger root', 'grated fresh ginger'] },
  { key: 'broccoli', price: 2.5, unit: 'each', aliases: ['broccoli head', 'broccoli florets'] },
  { key: 'spinach', price: 3.5, unit: 'lb', aliases: ['baby spinach'] },
  { key: 'mushrooms', price: 4, unit: 'lb', aliases: ['mushroom', 'cremini mushrooms', 'button mushrooms'] },
  { key: 'zucchini', price: 1.2, unit: 'each', aliases: ['courgette', 'zucchinis'] },
  { key: 'cilantro', price: 0.5, unit: 'oz', aliases: ['coriander', 'fresh cilantro'] },
  { key: 'parsley', price: 0.75, unit: 'oz', aliases: ['fresh parsley', 'flat leaf parsley'] },
  { key: 'green onion', price: 0.2, unit: 'each', aliases: ['scallions', 'green onions', 'spring onions'] },
  { key: 'avocado', price: 1.5, unit: 'each', aliases: ['avocados'] },
  { key: 'banana', price: 0.3, unit: 'each', aliases: ['bananas'] },
  { key: 'apple', price: 1, unit: 'each', aliases: ['apples'] },
  { key: 'berries', price: 4, unit: 'lb', aliases: ['strawberries', 'blueberries', 'raspberries'] },
  { key: 'lettuce', price: 2.5, unit: 'each', aliases: ['romaine', 'iceberg lettuce'] },
  { key: 'cabbage', price: 2.5, unit: 'each' },
  { key: 'cauliflower', price: 3.5, unit: 'each' },
  { key: 'kale', price: 3, unit: 'each' },
  { key: 'corn', price: 0.7, unit: 'each', aliases: ['corn on the cob', 'ears of corn'] },

  // Pantry, tins and jars
  { key: 'rice', price: 1.6, unit: 'lb', aliases: ['white rice', 'jasmine rice', 'basmati rice', 'brown rice'] },
  { key: 'pasta', price: 1.8, unit: 'lb', aliases: ['penne', 'spaghetti', 'fusilli', 'macaroni', 'noodles'] },
  { key: 'flour', price: 0.9, unit: 'lb', aliases: ['all purpose flour', 'plain flour'] },
  { key: 'sugar', price: 1, unit: 'lb', aliases: ['granulated sugar', 'brown sugar'] },
  { key: 'olive oil', price: 0.55, unit: 'fl oz', aliases: ['extra virgin olive oil'] },
  { key: 'vegetable oil', price: 0.2, unit: 'fl oz', aliases: ['canola oil', 'sunflower oil', 'a quantity of oil suitable for the desired cooking method (see notes below)'] },
  { key: 'sesame oil', price: 0.9, unit: 'fl oz' },
  { key: 'soy sauce', price: 0.2, unit: 'fl oz' },
  { key: 'vinegar', price: 0.15, unit: 'fl oz', aliases: ['balsamic vinegar', 'apple cider vinegar', 'rice vinegar'] },
  { key: 'diced tomatoes', price: 1.5, unit: 'can', aliases: ['crushed tomatoes', 'canned tomatoes', 'chopped tomatoes'] },
  { key: 'tomato paste', price: 1, unit: 'can', contains: { tbsp: 12, cup: 0.75 } },
  { key: 'black beans', price: 1.2, unit: 'can', aliases: ['kidney beans', 'chickpeas', 'cannellini beans', 'pinto beans'] },
  { key: 'coconut milk', price: 2.2, unit: 'can' },
  { key: 'chicken broth', price: 0.06, unit: 'fl oz', aliases: ['chicken stock', 'beef broth', 'vegetable broth', 'stock'] },
  { key: 'lentils', price: 1.8, unit: 'lb', aliases: ['red lentils', 'green lentils'] },
  { key: 'oats', price: 1.5, unit: 'lb', aliases: ['rolled oats', 'porridge oats'] },
  { key: 'bread', price: 3.5, unit: 'loaf', aliases: ['loaf', 'sandwich bread', 'sourdough'], contains: { slice: 16 } },
  { key: 'tortillas', price: 3.5, unit: 'pack', aliases: ['flour tortillas', 'corn tortillas'], contains: { each: 10 } },
  { key: 'breadcrumbs', price: 3, unit: 'lb', aliases: ['panko'] },
  { key: 'peanut butter', price: 4, unit: 'lb' },
  { key: 'honey', price: 8, unit: 'lb' },
  { key: 'maple syrup', price: 12, unit: 'pt' },
  { key: 'biscuit dough', price: 3, unit: 'can', aliases: ['frozen biscuit dough', 'refrigerated biscuits'], contains: { each: 8 } },
  { key: 'chia seeds', price: 0.5, unit: 'oz', aliases: ['flax seeds', 'hemp seeds'] },
  { key: 'plantain', price: 1, unit: 'each', aliases: ['plantains', 'green cooking bananas (plantains)', 'cooking bananas'] },
  { key: 'cereal', price: 5, unit: 'box', aliases: ['special k', 'special k strawberry', 'cornflakes', 'granola', 'muesli'] },

  // Seasonings — pennies per recipe, but they belong on a shop
  { key: 'salt', price: 1.5, unit: 'lb', aliases: ['kosher salt', 'sea salt'] },
  { key: 'black pepper', price: 0.5, unit: 'oz', aliases: ['pepper', 'ground black pepper'] },
  { key: 'cumin', price: 0.6, unit: 'oz', aliases: ['ground cumin'] },
  { key: 'garlic powder', price: 0.6, unit: 'oz', aliases: ['onion powder'] },
  { key: 'apple juice', price: 0.03, unit: 'fl oz', aliases: ['orange juice'] },
  { key: 'paprika', price: 0.6, unit: 'oz', aliases: ['smoked paprika'] },
  { key: 'chili powder', price: 0.6, unit: 'oz', aliases: ['cayenne', 'red pepper flakes'] },
  { key: 'curry powder', price: 0.8, unit: 'oz', aliases: ['garam masala', 'curry paste'] },
  { key: 'oregano', price: 0.8, unit: 'oz', aliases: ['dried oregano', 'italian seasoning'] },
  { key: 'cinnamon', price: 0.9, unit: 'oz', aliases: ['ground cinnamon'] },
  { key: 'bay leaves', price: 1, unit: 'oz', aliases: ['bay leaf'] },
  { key: 'rosemary', price: 1.5, unit: 'oz', aliases: ['thyme', 'fresh rosemary', 'fresh thyme'] },
  { key: 'vanilla', price: 3, unit: 'fl oz', aliases: ['vanilla extract'] },
  { key: 'bbq sauce', price: 0.15, unit: 'fl oz', aliases: ['barbecue sauce'] },
  { key: 'ketchup', price: 0.1, unit: 'fl oz' },
  { key: 'mayonnaise', price: 0.15, unit: 'fl oz', aliases: ['mayo'] },
  { key: 'mustard', price: 0.15, unit: 'fl oz', aliases: ['dijon mustard'] },
  { key: 'salsa', price: 0.2, unit: 'fl oz' },
  { key: 'ranch dressing', price: 0.12, unit: 'fl oz', aliases: ['salad dressing'] },
  { key: 'cream of chicken soup', price: 1.6, unit: 'can', aliases: ['cream of mushroom soup', 'condensed soup'] },

  // Added after checking the estimator against how recipe sites actually write
  // a shopping line. Every one of these was a dash on somebody's recipe page.
  { key: 'pork chop', price: 4.5, unit: 'lb', aliases: ['pork chops', 'pork loin', 'pork tenderloin'] },
  { key: 'steak', price: 11, unit: 'lb', aliases: ['flank steak', 'sirloin', 'skirt steak', 'ribeye', 'strip steak'] },
  { key: 'white fish', price: 9, unit: 'lb', aliases: ['cod', 'tilapia', 'haddock', 'pollock'] },
  { key: 'tuna', price: 1.5, unit: 'can', aliases: ['canned tuna'] },
  { key: 'anchovy', price: 3, unit: 'can', aliases: ['anchovies'] },
  { key: 'tofu', price: 2.5, unit: 'lb', aliases: ['firm tofu', 'extra firm tofu', 'silken tofu'] },
  { key: 'feta', price: 7, unit: 'lb' },
  { key: 'swiss cheese', price: 7, unit: 'lb', aliases: ['provolone', 'gruyere', 'monterey jack', 'pepper jack'] },
  { key: 'half and half', price: 3.5, unit: 'pt', aliases: ['half-and-half', 'light cream'] },
  { key: 'cottage cheese', price: 3.5, unit: 'lb', aliases: ['ricotta'] },

  // Produce the table did not have
  { key: 'asparagus', price: 4, unit: 'lb' },
  { key: 'green beans', price: 3, unit: 'lb', aliases: ['green bean', 'string beans'] },
  { key: 'brussels sprouts', price: 3.5, unit: 'lb', aliases: ['brussel sprouts'] },
  { key: 'butternut squash', price: 1.5, unit: 'lb', aliases: ['acorn squash', 'winter squash'] },
  { key: 'eggplant', price: 2, unit: 'each', aliases: ['aubergine'] },
  { key: 'cucumber', price: 1, unit: 'each', aliases: ['english cucumber', 'cucumbers'] },
  { key: 'jalapeno', price: 0.3, unit: 'each', aliases: ['jalapeño', 'serrano', 'chile pepper', 'chili pepper'] },
  { key: 'arugula', price: 5, unit: 'lb', aliases: ['rocket', 'mixed greens', 'salad greens', 'spring mix'] },
  { key: 'basil', price: 2, unit: 'oz', aliases: ['fresh basil', 'mint', 'fresh mint', 'dill', 'fresh dill', 'sage', 'fresh sage'] },
  { key: 'peas', price: 2, unit: 'lb', aliases: ['frozen peas', 'green peas'] },
  { key: 'frozen corn', price: 2, unit: 'lb', aliases: ['sweetcorn'] },
  { key: 'frozen vegetables', price: 2.5, unit: 'lb', aliases: ['mixed vegetables', 'stir fry vegetables'] },
  { key: 'grapes', price: 3, unit: 'lb', aliases: ['grape'] },
  { key: 'orange', price: 1, unit: 'each', aliases: ['oranges', 'clementine', 'mandarin'] },
  { key: 'pineapple', price: 3.5, unit: 'each' },
  { key: 'raisins', price: 4, unit: 'lb', aliases: ['dried cranberries', 'dried fruit', 'dates'] },

  // Dry goods and the middle aisles
  { key: 'quinoa', price: 4, unit: 'lb' },
  { key: 'couscous', price: 3, unit: 'lb', aliases: ['orzo'] },
  { key: 'barley', price: 2, unit: 'lb', aliases: ['pearl barley', 'farro', 'bulgur'] },
  { key: 'cornstarch', price: 2, unit: 'lb', aliases: ['corn starch', 'cornflour'] },
  { key: 'baking powder', price: 3, unit: 'lb', aliases: ['baking soda', 'bicarbonate of soda'] },
  { key: 'yeast', price: 0.5, unit: 'oz', aliases: ['active dry yeast', 'instant yeast', 'nutritional yeast'] },
  { key: 'cocoa powder', price: 6, unit: 'lb', aliases: ['cacao powder'] },
  { key: 'chocolate chips', price: 5, unit: 'lb', aliases: ['chocolate', 'dark chocolate', 'semi sweet chocolate chips'] },
  { key: 'walnuts', price: 9, unit: 'lb', aliases: ['pecans', 'chopped walnuts', 'chopped pecans'] },
  { key: 'almonds', price: 8, unit: 'lb', aliases: ['sliced almonds', 'slivered almonds'] },
  { key: 'cashews', price: 9, unit: 'lb', aliases: ['peanuts', 'mixed nuts'] },
  { key: 'pine nuts', price: 25, unit: 'lb', aliases: ['pine nut'] },
  { key: 'sesame seeds', price: 6, unit: 'lb', aliases: ['poppy seeds', 'sunflower seeds', 'pumpkin seeds'] },
  { key: 'coconut flakes', price: 5, unit: 'lb', aliases: ['shredded coconut', 'desiccated coconut'] },
  { key: 'hamburger buns', price: 3, unit: 'pack', aliases: ['hot dog buns', 'burger buns', 'rolls', 'dinner rolls'], contains: { each: 8 } },
  { key: 'pita bread', price: 3, unit: 'pack', aliases: ['naan', 'flatbread'], contains: { each: 6 } },

  // Jars, bottles and the sauces a recipe assumes you have
  { key: 'tomato sauce', price: 1.2, unit: 'can', aliases: ['passata', 'canned tomato sauce'] },
  { key: 'marinara sauce', price: 3, unit: 'jar', aliases: ['pasta sauce', 'spaghetti sauce', 'tomato pasta sauce'], contains: { cup: 3 } },
  { key: 'worcestershire sauce', price: 0.35, unit: 'fl oz' },
  { key: 'fish sauce', price: 0.4, unit: 'fl oz', aliases: ['oyster sauce'] },
  { key: 'hot sauce', price: 0.4, unit: 'fl oz', aliases: ['sriracha', 'tabasco', 'chili garlic sauce', 'gochujang'] },
  { key: 'peanut oil', price: 0.3, unit: 'fl oz', aliases: ['avocado oil', 'coconut oil', 'grapeseed oil'] },
  { key: 'wine', price: 0.4, unit: 'fl oz', aliases: ['white wine', 'red wine', 'dry white wine', 'cooking wine', 'sherry', 'marsala'] },
  { key: 'olives', price: 8, unit: 'lb', aliases: ['kalamata olives', 'green olives', 'black olives'] },
  { key: 'capers', price: 0.9, unit: 'oz' },
  { key: 'pickles', price: 0.15, unit: 'fl oz', aliases: ['dill pickles', 'relish'] },
  { key: 'apple cider', price: 0.04, unit: 'fl oz', aliases: ['cider'] },
  { key: 'pumpkin puree', price: 2, unit: 'can', aliases: ['canned pumpkin'] },
  { key: 'evaporated milk', price: 1.5, unit: 'can', aliases: ['condensed milk', 'sweetened condensed milk'] },
  { key: 'corn syrup', price: 0.15, unit: 'fl oz', aliases: ['agave', 'agave nectar', 'molasses'] },
  { key: 'powdered sugar', price: 1.6, unit: 'lb', aliases: ['confectioners sugar', 'icing sugar'] },
  { key: 'cinnamon stick', price: 0.4, unit: 'each', aliases: ['cinnamon sticks', 'star anise', 'cardamom pod', 'cardamom pods'] },
  { key: 'nutmeg', price: 1.2, unit: 'oz', aliases: ['allspice', 'cloves ground', 'ground ginger', 'turmeric', 'coriander seed', 'fennel seed', 'mustard seed', 'celery seed', 'dill weed', 'tarragon', 'marjoram', 'sumac', 'za atar'] },
]

/** "tomatoes" and "tomato" are the same shopping decision. */
function singular(name: string): string {
  return name
    .split(' ')
    .map((word) =>
      word
        .replace(/ies$/, 'y')
        // "tomatoes" must not become "tomatoe", which matches nothing.
        .replace(/(ch|sh|ss|x|z|o)es$/, '$1')
        .replace(/([^s])s$/, '$1'),
    )
    .join(' ')
}

/** Every name that resolves to a price, and the same list stemmed. */
const BY_NAME = new Map<string, PriceEntry>()
const BY_SINGULAR = new Map<string, PriceEntry>()
for (const entry of PRICE_TABLE) {
  for (const name of [entry.key, ...(entry.aliases ?? [])]) {
    BY_NAME.set(name, entry)
    // First writer wins, so a specific alias is never shadowed by a later one.
    if (!BY_SINGULAR.has(singular(name))) BY_SINGULAR.set(singular(name), entry)
  }
}

/**
 * Words that say what was done to a thing, not which thing it is.
 *
 * A shopping key keeps these on purpose — "dried" and "fresh" are different
 * decisions on the grocery list — but a *price* does not change because the
 * parmesan was grated, and "freshly grated parmesan cheese" costs whatever
 * parmesan costs. So they are stripped here and nowhere else.
 */
const PREP_WORDS = new Set([
  'fresh', 'freshly', 'frozen', 'chopped', 'minced', 'diced', 'sliced', 'shredded',
  'grated', 'crumbled', 'crushed', 'peeled', 'cooked', 'uncooked', 'raw', 'boneless',
  'skinless', 'lean', 'thinly', 'roughly', 'finely', 'softened', 'melted', 'packed',
  'rinsed', 'drained', 'trimmed', 'halved', 'quartered', 'cubed', 'toasted', 'unsalted',
  'salted', 'low-sodium', 'reduced-sodium', 'low-fat', 'nonfat', 'plain', 'organic',
  'ripe', 'baby', 'english', 'pitted', 'seeded', 'deveined', 'day-old', 'all-purpose',
  'all', 'purpose', 'extra-virgin', 'extra', 'virgin', 'free-range', 'cage-free',
  'grass-fed', 'sweetened', 'unsweetened', 'canned', 'jarred', 'boxed', 'bottled',
  'prepared', 'homemade', 'store-bought', 'leftover', 'warm', 'cold', 'room-temperature',
])

/**
 * Words that only say what shape it was cut into. Dropped from the end,
 * because "cauliflower florets" is cauliflower and "cod fillets" is cod.
 */
const GENERIC_TAILS = new Set([
  'cheese', 'fillet', 'fillets', 'floret', 'florets', 'piece', 'pieces', 'chunk',
  'chunks', 'cube', 'cubes', 'strip', 'strips', 'wedge', 'wedges', 'half', 'halves',
])

/**
 * The same name, said more plainly each time.
 *
 * Tried in order, so an exact entry always wins over a stripped-down guess —
 * "ground beef" is looked up before "beef", "cream cheese" before "cream".
 */
function plainer(needle: string): string[] {
  const words = needle.split(' ').filter(Boolean)
  const candidates: string[] = []

  const withoutPrep = words.filter((word) => !PREP_WORDS.has(word))
  if (withoutPrep.length && withoutPrep.length !== words.length) {
    candidates.push(withoutPrep.join(' '))
  }

  // Tails come off one at a time: "shredded mozzarella cheese" → "mozzarella".
  const base = withoutPrep.length ? withoutPrep : words
  let trimmed = [...base]
  while (trimmed.length > 1 && GENERIC_TAILS.has(trimmed[trimmed.length - 1])) {
    trimmed = trimmed.slice(0, -1)
    candidates.push(trimmed.join(' '))
  }

  return candidates
}

export function findPrice(key: string): PriceEntry | undefined {
  const needle = key.trim().toLowerCase()
  if (!needle) return undefined

  const stem = singular(needle)
  const exact = BY_NAME.get(needle) ?? BY_SINGULAR.get(stem)
  if (exact) return exact

  // Said plainly, it may be something the shelf knows.
  for (const candidate of plainer(needle)) {
    const match = BY_NAME.get(candidate) ?? BY_SINGULAR.get(singular(candidate))
    if (match) return match
  }

  /*
   * Otherwise match on the head noun — the last words — and never on a word
   * in the middle. "boneless skinless chicken thighs" is chicken thighs, but
   * "garlic powder" is not garlic and "apple juice" is not an apple, and
   * pricing those as the fresh thing is worse than leaving them blank: it is
   * wrong quietly, inside a number people trust.
   */
  let best: PriceEntry | undefined
  let bestLength = 0
  for (const [name, entry] of BY_SINGULAR) {
    if (name.length <= bestLength) continue
    const boundary = stem.length - name.length
    if (boundary < 0) continue
    if (stem.endsWith(name) && (boundary === 0 || stem[boundary - 1] === ' ')) {
      best = entry
      bestLength = name.length
    }
  }
  return best
}
