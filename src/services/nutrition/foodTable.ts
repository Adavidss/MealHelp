/**
 * A small table of common foods, per 100 g, with the weight of the units a
 * recipe is likely to use them in.
 *
 * This is the same idea Tandoor uses for recipe properties — a food carries
 * values per base amount, an ingredient line is converted into that amount,
 * and the two are multiplied — with the food list built in rather than typed
 * by the user. Values are rounded from USDA FoodData Central (SR Legacy /
 * Foundation) entries for the plain form of each food; a recipe's "chicken"
 * is taken as raw boneless breast, "beef" as 85% lean mince, and so on. It
 * is an estimate and is labelled as one wherever it appears.
 *
 * `grams` says what one of each unit weighs: `each` for countable things,
 * `cup`/`tbsp`/`tsp` for things measured by volume (so a cup of flour is 125 g
 * and a cup of rice 185 g, which no volume conversion could know).
 */

export interface FoodEntry {
  /** Words that identify the food in an ingredient name; the longest match wins. */
  match: string[]
  /** Per 100 g. */
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  /** mg */
  sodium?: number
  /** Grams per unit. `each` is one item; `cup`, `tbsp`, `tsp` are level. */
  grams?: Partial<Record<'each' | 'cup' | 'tbsp' | 'tsp' | 'clove' | 'slice' | 'can' | 'stalk' | 'bunch' | 'head' | 'sprig' | 'leaf', number>>
}

const G = (each?: number, cup?: number, tbsp?: number, tsp?: number) => ({
  ...(each ? { each } : {}),
  ...(cup ? { cup } : {}),
  ...(tbsp ? { tbsp } : {}),
  ...(tsp ? { tsp } : {}),
})

export const FOOD_TABLE: FoodEntry[] = [
  // ---- Proteins ----
  { match: ['chicken thigh'], kcal: 177, protein: 19, carbs: 0, fat: 10.9, grams: G(110) },
  { match: ['chicken breast', 'chicken'], kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, grams: G(170) },
  // Roasted with the skin on, and weighed as a bird rather than a fillet: a
  // whole chicken was matching "chicken breast" and counting 170 g.
  { match: ['whole chicken', 'roast chicken', 'roasting chicken'], kcal: 215, protein: 25, carbs: 0, fat: 12.6, grams: G(1600) },
  { match: ['chicken wing'], kcal: 203, protein: 18, carbs: 0, fat: 14, grams: G(45) },
  { match: ['ground beef', 'beef mince', 'minced beef', 'hamburger'], kcal: 215, protein: 19, carbs: 0, fat: 15, grams: G(undefined, 225) },
  { match: ['beef stew', 'chuck roast', 'chuck', 'stewing beef', 'beef'], kcal: 200, protein: 20, carbs: 0, fat: 13, grams: G(undefined, 225) },
  { match: ['steak', 'sirloin', 'flank'], kcal: 190, protein: 22, carbs: 0, fat: 11, grams: G(225) },
  { match: ['pork shoulder', 'pork butt', 'pulled pork'], kcal: 240, protein: 18, carbs: 0, fat: 18 },
  { match: ['pork tenderloin', 'pork loin', 'pork chop', 'pork'], kcal: 143, protein: 21, carbs: 0, fat: 6, grams: G(150) },
  { match: ['ground pork', 'pork mince'], kcal: 263, protein: 17, carbs: 0, fat: 21 },
  { match: ['bacon'], kcal: 417, protein: 13, carbs: 1.4, fat: 40, sodium: 750, grams: { slice: 12, each: 12 } },
  { match: ['sausage', 'chorizo', 'bratwurst'], kcal: 300, protein: 14, carbs: 2, fat: 26, sodium: 800, grams: G(75) },
  { match: ['ground turkey', 'turkey mince'], kcal: 150, protein: 19, carbs: 0, fat: 8 },
  { match: ['turkey'], kcal: 135, protein: 24, carbs: 0, fat: 4 },
  { match: ['lamb'], kcal: 250, protein: 17, carbs: 0, fat: 20 },
  { match: ['salmon'], kcal: 208, protein: 20, carbs: 0, fat: 13, grams: G(170) },
  { match: ['tuna'], kcal: 116, protein: 26, carbs: 0, fat: 1, sodium: 300, grams: { can: 140, each: 140 } },
  { match: ['shrimp', 'prawn'], kcal: 85, protein: 20, carbs: 0, fat: 0.5, sodium: 120, grams: G(10) },
  { match: ['cod', 'white fish', 'tilapia', 'haddock', 'fish'], kcal: 90, protein: 19, carbs: 0, fat: 1, grams: G(150) },
  { match: ['egg white'], kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, grams: G(33, 243, 15) },
  { match: ['egg'], kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, grams: G(50) },
  { match: ['tofu'], kcal: 76, protein: 8, carbs: 1.9, fat: 4.8, grams: G(undefined, 250) },
  { match: ['tempeh'], kcal: 192, protein: 20, carbs: 8, fat: 11 },

  // ---- Dairy ----
  { match: ['heavy cream', 'double cream', 'whipping cream'], kcal: 340, protein: 2.8, carbs: 2.8, fat: 36, grams: G(undefined, 240, 15, 5) },
  { match: ['sour cream', 'crème fraîche', 'creme fraiche'], kcal: 198, protein: 2.4, carbs: 4.6, fat: 19, grams: G(undefined, 230, 14) },
  { match: ['cream cheese'], kcal: 342, protein: 6, carbs: 4, fat: 34, sodium: 320, grams: G(undefined, 232, 14.5) },
  { match: ['greek yogurt', 'greek yoghurt'], kcal: 59, protein: 10, carbs: 3.6, fat: 0.4, grams: G(undefined, 245, 15) },
  { match: ['yogurt', 'yoghurt'], kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, grams: G(undefined, 245, 15) },
  { match: ['butter'], kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, sodium: 640, grams: G(undefined, 227, 14, 4.7) },
  { match: ['whole milk', 'milk'], kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sugar: 5, grams: G(undefined, 244, 15, 5) },
  { match: ['buttermilk'], kcal: 40, protein: 3.3, carbs: 4.8, fat: 0.9, grams: G(undefined, 245, 15) },
  { match: ['parmesan', 'parmigiano', 'pecorino'], kcal: 431, protein: 38, carbs: 4, fat: 29, sodium: 1500, grams: G(undefined, 100, 6, 2) },
  { match: ['feta'], kcal: 264, protein: 14, carbs: 4, fat: 21, sodium: 1100, grams: G(undefined, 150, 10) },
  { match: ['mozzarella'], kcal: 280, protein: 28, carbs: 3, fat: 17, sodium: 630, grams: G(undefined, 112, 7) },
  { match: ['cheddar', 'gruyere', 'gruyère', 'monterey jack', 'cheese'], kcal: 403, protein: 23, carbs: 3, fat: 33, sodium: 650, grams: G(undefined, 113, 7, 2.5) },

  // ---- Grains, pasta, bread ----
  { match: ['all-purpose flour', 'plain flour', 'all purpose flour', 'flour'], kcal: 364, protein: 10, carbs: 76, fat: 1, fiber: 2.7, grams: G(undefined, 125, 8, 2.6) },
  { match: ['bread crumbs', 'breadcrumbs', 'panko'], kcal: 395, protein: 13, carbs: 72, fat: 5, sodium: 730, grams: G(undefined, 108, 7) },
  { match: ['white rice', 'jasmine rice', 'basmati rice', 'rice'], kcal: 365, protein: 7, carbs: 80, fat: 0.7, grams: G(undefined, 185, 12) },
  // Cooked rice is mostly water: counting a cup of it as dry rice trebles it,
  // and "4 cups cooked rice" is how every fried rice recipe is written.
  { match: ['cooked rice', 'leftover rice', 'steamed rice'], kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, grams: G(undefined, 158, 10) },
  { match: ['brown rice'], kcal: 370, protein: 7.5, carbs: 77, fat: 2.7, fiber: 3.5, grams: G(undefined, 190) },
  { match: ['quinoa'], kcal: 368, protein: 14, carbs: 64, fat: 6, fiber: 7, grams: G(undefined, 170) },
  { match: ['oats', 'oatmeal', 'rolled oats'], kcal: 389, protein: 17, carbs: 66, fat: 7, fiber: 10.6, grams: G(undefined, 80, 5) },
  { match: ['spaghetti', 'penne', 'linguine', 'fettuccine', 'rigatoni', 'macaroni', 'pasta', 'noodles'], kcal: 371, protein: 13, carbs: 75, fat: 1.5, fiber: 3, grams: G(undefined, 100) },
  { match: ['tortilla'], kcal: 300, protein: 8, carbs: 50, fat: 8, sodium: 600, grams: G(45) },
  { match: ['bread', 'bun', 'roll'], kcal: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7, sodium: 490, grams: { slice: 30, each: 50 } },
  { match: ['cornstarch', 'cornflour', 'corn starch'], kcal: 381, protein: 0.3, carbs: 91, fat: 0.1, grams: G(undefined, 128, 8, 2.7) },
  { match: ['sugar', 'caster sugar', 'granulated sugar'], kcal: 387, protein: 0, carbs: 100, fat: 0, sugar: 100, grams: G(undefined, 200, 12.5, 4.2) },
  { match: ['brown sugar'], kcal: 380, protein: 0, carbs: 98, fat: 0, sugar: 97, grams: G(undefined, 220, 14, 4.6) },
  { match: ['honey'], kcal: 304, protein: 0.3, carbs: 82, fat: 0, sugar: 82, grams: G(undefined, 340, 21, 7) },
  { match: ['maple syrup'], kcal: 260, protein: 0, carbs: 67, fat: 0, sugar: 60, grams: G(undefined, 315, 20, 6.7) },

  // ---- Legumes, nuts ----
  { match: ['red lentil', 'lentil'], kcal: 352, protein: 25, carbs: 63, fat: 1, fiber: 11, grams: G(undefined, 190) },
  { match: ['chickpea', 'garbanzo'], kcal: 139, protein: 7.3, carbs: 22.5, fat: 2.6, fiber: 6, sodium: 250, grams: { cup: 164, can: 240, each: 240 } },
  { match: ['black bean', 'kidney bean', 'pinto bean', 'cannellini', 'white bean', 'bean'], kcal: 127, protein: 8, carbs: 22, fat: 0.5, fiber: 7, sodium: 240, grams: { cup: 172, can: 240, each: 240 } },
  { match: ['peanut butter'], kcal: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, sodium: 430, grams: G(undefined, 258, 16) },
  { match: ['almond', 'walnut', 'cashew', 'pecan', 'pistachio', 'peanut', 'nuts'], kcal: 600, protein: 20, carbs: 20, fat: 50, fiber: 8, grams: G(undefined, 140, 9) },
  { match: ['sesame seed', 'sunflower seed', 'pumpkin seed', 'chia seed', 'flax'], kcal: 560, protein: 20, carbs: 25, fat: 45, fiber: 12, grams: G(undefined, 140, 9, 3) },

  { match: ['couscous', 'orzo', 'bulgur', 'farro', 'barley'], kcal: 376, protein: 12.8, carbs: 77, fat: 0.6, fiber: 5, grams: G(undefined, 173, 11) },
  { match: ['caper'], kcal: 23, protein: 2.4, carbs: 5, fat: 0.9, sodium: 2350, grams: G(undefined, 145, 9, 3) },
  { match: ['olive'], kcal: 145, protein: 1, carbs: 4, fat: 15, fiber: 3, sodium: 1550, grams: G(4, 135, 8) },
  { match: ['pumpkin puree', 'canned pumpkin'], kcal: 34, protein: 1.1, carbs: 8, fat: 0.3, fiber: 3, grams: { cup: 245, can: 425, each: 425 } },
  { match: ['anchovy'], kcal: 210, protein: 29, carbs: 0, fat: 10, sodium: 3670, grams: { each: 4, can: 50 } },

  // ---- Vegetables ----
  { match: ['yellow onion', 'red onion', 'white onion', 'onion'], kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, grams: G(110, 160) },
  { match: ['green onion', 'scallion', 'spring onion'], kcal: 32, protein: 1.8, carbs: 7.3, fat: 0.2, fiber: 2.6, grams: G(15, 100) },
  { match: ['shallot'], kcal: 72, protein: 2.5, carbs: 17, fat: 0.1, grams: G(30) },
  { match: ['garlic'], kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, grams: { clove: 3, each: 3, tsp: 3, tbsp: 9 } },
  { match: ['ginger'], kcal: 80, protein: 1.8, carbs: 18, fat: 0.8, grams: G(15, 96, 6, 2) },
  { match: ['carrot'], kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, sugar: 4.7, grams: G(61, 128) },
  { match: ['celery'], kcal: 14, protein: 0.7, carbs: 3, fat: 0.2, fiber: 1.6, grams: { stalk: 40, each: 40, cup: 100 } },
  { match: ['bell pepper', 'red pepper', 'capsicum', 'pepper'], kcal: 26, protein: 1, carbs: 6, fat: 0.3, fiber: 2, grams: G(120, 150) },
  // A pinch of heat, not a vegetable — this was matching "red pepper".
  { match: ['red pepper flakes', 'chili flakes', 'crushed red pepper'], kcal: 282, protein: 12, carbs: 50, fat: 14, grams: G(undefined, 46, 3, 1) },
  // Woody herbs, sold and used by the sprig.
  { match: ['rosemary', 'thyme', 'sage leaves'], kcal: 131, protein: 3.3, carbs: 21, fat: 5.9, grams: G(1, 15, 1) },
  { match: ['jalapeño', 'jalapeno', 'chili', 'chilli', 'serrano'], kcal: 29, protein: 0.9, carbs: 6.5, fat: 0.4, grams: G(14) },
  { match: ['tomato paste'], kcal: 82, protein: 4.3, carbs: 19, fat: 0.5, sodium: 60, grams: G(undefined, 262, 16) },
  { match: ['crushed tomato', 'diced tomato', 'canned tomato', 'tomato sauce', 'passata', 'tomatoes'], kcal: 32, protein: 1.6, carbs: 7, fat: 0.3, fiber: 1.9, sodium: 130, grams: { cup: 240, can: 400, each: 400 } },
  { match: ['cherry tomato', 'tomato'], kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, grams: G(120, 180) },
  { match: ['potato', 'yukon', 'russet'], kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, grams: G(170, 150) },
  { match: ['sweet potato', 'yam'], kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sugar: 4.2, grams: G(130, 133) },
  { match: ['spinach'], kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, grams: G(undefined, 30) },
  { match: ['kale'], kcal: 35, protein: 2.9, carbs: 4.4, fat: 1.5, fiber: 4.1, grams: G(undefined, 20) },
  { match: ['broccoli'], kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, grams: { head: 300, each: 300, cup: 90 } },
  { match: ['cauliflower'], kcal: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2, grams: { head: 600, each: 600, cup: 100 } },
  { match: ['zucchini', 'courgette'], kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, grams: G(200, 124) },
  { match: ['mushroom'], kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1, grams: G(18, 70) },
  { match: ['corn', 'sweetcorn'], kcal: 86, protein: 3.3, carbs: 19, fat: 1.4, fiber: 2.7, grams: { cup: 145, can: 280, each: 280 } },
  { match: ['green bean'], kcal: 31, protein: 1.8, carbs: 7, fat: 0.2, fiber: 2.7, grams: G(undefined, 100) },
  { match: ['pea', 'peas'], kcal: 81, protein: 5.4, carbs: 14, fat: 0.4, fiber: 5.7, grams: G(undefined, 145) },
  { match: ['cabbage'], kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fiber: 2.5, grams: { head: 900, each: 900, cup: 90 } },
  { match: ['lettuce', 'romaine', 'salad greens', 'arugula', 'rocket', 'mixed greens'], kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.3, grams: { head: 300, each: 300, cup: 47 } },
  { match: ['cucumber'], kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, grams: G(300, 120) },
  { match: ['avocado'], kcal: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, grams: G(150, 150) },
  { match: ['eggplant', 'aubergine'], kcal: 25, protein: 1, carbs: 6, fat: 0.2, fiber: 3, grams: G(450, 82) },
  { match: ['butternut', 'squash', 'pumpkin'], kcal: 45, protein: 1, carbs: 12, fat: 0.1, fiber: 2, grams: G(900, 140) },
  { match: ['coconut milk'], kcal: 197, protein: 2, carbs: 2.8, fat: 21, grams: { cup: 240, can: 400, each: 400, tbsp: 15 } },
  { match: ['chicken stock', 'chicken broth', 'vegetable stock', 'vegetable broth', 'beef stock', 'beef broth', 'stock', 'broth'], kcal: 7, protein: 1, carbs: 0.5, fat: 0.2, sodium: 350, grams: G(undefined, 240, 15) },

  // ---- Fruit ----
  { match: ['lemon juice', 'lime juice'], kcal: 22, protein: 0.4, carbs: 7, fat: 0.2, grams: G(undefined, 244, 15, 5) },
  { match: ['lemon', 'lime'], kcal: 29, protein: 1.1, carbs: 9.3, fat: 0.3, grams: G(70) },
  { match: ['apple'], kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, grams: G(180, 125) },
  { match: ['banana'], kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, grams: G(118, 150) },
  { match: ['blueberr', 'strawberr', 'raspberr', 'blackberr', 'berries', 'berry'], kcal: 50, protein: 0.7, carbs: 12, fat: 0.3, fiber: 3, sugar: 8, grams: G(undefined, 148) },
  { match: ['orange'], kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sugar: 9, grams: G(130) },
  { match: ['raisin', 'dried cranberr', 'dates'], kcal: 299, protein: 3, carbs: 79, fat: 0.5, fiber: 3.7, sugar: 59, grams: G(undefined, 145, 9) },

  // ---- Fats, condiments ----
  { match: ['olive oil', 'vegetable oil', 'canola oil', 'sunflower oil', 'sesame oil', 'coconut oil', 'oil'], kcal: 884, protein: 0, carbs: 0, fat: 100, grams: G(undefined, 216, 13.5, 4.5) },
  { match: ['mayonnaise', 'mayo'], kcal: 680, protein: 1, carbs: 1, fat: 75, sodium: 630, grams: G(undefined, 220, 14) },
  { match: ['soy sauce', 'tamari'], kcal: 53, protein: 8, carbs: 5, fat: 0, sodium: 5500, grams: G(undefined, 255, 16, 5.3) },
  { match: ['fish sauce'], kcal: 35, protein: 5, carbs: 4, fat: 0, sodium: 7800, grams: G(undefined, 0, 18, 6) },
  { match: ['ketchup'], kcal: 101, protein: 1, carbs: 27, fat: 0.1, sugar: 21, sodium: 900, grams: G(undefined, 240, 17) },
  { match: ['mustard'], kcal: 66, protein: 4, carbs: 6, fat: 4, sodium: 1100, grams: G(undefined, 0, 15, 5) },
  { match: ['vinegar'], kcal: 19, protein: 0, carbs: 0.9, fat: 0, grams: G(undefined, 240, 15, 5) },
  { match: ['curry paste', 'harissa', 'gochujang', 'miso'], kcal: 150, protein: 4, carbs: 20, fat: 6, sodium: 3000, grams: G(undefined, 0, 17, 6) },
  { match: ['coconut', 'shredded coconut'], kcal: 660, protein: 7, carbs: 24, fat: 65, fiber: 16, grams: G(undefined, 93, 6) },
  { match: ['chocolate chips', 'chocolate'], kcal: 480, protein: 4, carbs: 60, fat: 27, sugar: 50, grams: G(undefined, 170, 11) },
  { match: ['cocoa'], kcal: 228, protein: 20, carbs: 58, fat: 14, fiber: 33, grams: G(undefined, 86, 5) },

  // ---- Seasonings: near-zero, but matched so coverage is honest ----
  { match: ['salt', 'kosher salt', 'sea salt'], kcal: 0, protein: 0, carbs: 0, fat: 0, sodium: 38758, grams: G(undefined, 288, 18, 6) },
  { match: ['black pepper', 'cumin', 'paprika', 'chili powder', 'chilli powder', 'garam masala', 'turmeric', 'coriander', 'oregano', 'thyme', 'rosemary', 'basil', 'parsley', 'cilantro', 'cinnamon', 'nutmeg', 'cayenne', 'curry powder', 'italian seasoning', 'bay leaf', 'bay leaves', 'dill', 'mint', 'chives', 'spice', 'seasoning'], kcal: 250, protein: 10, carbs: 50, fat: 8, fiber: 25, grams: { tsp: 2, tbsp: 6, cup: 16, each: 1, sprig: 1, leaf: 0.2, bunch: 25 } },
  { match: ['baking powder', 'baking soda', 'bicarbonate', 'yeast'], kcal: 50, protein: 0, carbs: 25, fat: 0, sodium: 10000, grams: G(undefined, 0, 14, 4.6) },
  { match: ['vanilla'], kcal: 288, protein: 0, carbs: 13, fat: 0, grams: G(undefined, 0, 13, 4.2) },
  { match: ['water'], kcal: 0, protein: 0, carbs: 0, fat: 0, grams: G(undefined, 237, 15, 5) },
]
