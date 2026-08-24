import { describe, expect, it } from 'vitest'
import { displayIngredientName, normalizeIngredientKey, parseIngredient } from '@/services/ingredientParser'
import { priceOfItem } from './estimate'
import type { GroceryItem } from '@/models'

/**
 * A shopping line, priced the way the app prices one.
 *
 * These are written the way recipe sites write them, brackets and all, because
 * that is what lands in the library: the app's own twelve starters priced
 * cleanly long before an imported recipe did, which is exactly how a gap like
 * this stays invisible. A dash on a recipe page is the app saying "I don't
 * know" — fine once, useless thirty times.
 */
const LINES = `2 tablespoons extra-virgin olive oil
1 large yellow onion, diced
3 cloves garlic, minced
1 (28-ounce) can crushed tomatoes
2 pounds boneless skinless chicken thighs
1 cup long-grain white rice
1/2 teaspoon kosher salt
1/4 teaspoon freshly ground black pepper
1 tablespoon unsalted butter
2 cups low-sodium chicken broth
1 pound spaghetti
1/2 cup freshly grated Parmesan cheese
1 bunch fresh parsley, chopped
2 medium carrots, peeled and sliced
1 red bell pepper, sliced
1 (15-ounce) can black beans, drained and rinsed
1 tablespoon soy sauce
2 teaspoons ground cumin
1 teaspoon smoked paprika
1 cup heavy cream
8 ounces cremini mushrooms, sliced
1 pound ground beef
4 boneless pork chops
1 (14-ounce) can coconut milk
2 tablespoons tomato paste
1 lemon, juiced
1 lime, zested and juiced
2 tablespoons honey
1/3 cup maple syrup
1 cup all-purpose flour
2 large eggs
1 cup whole milk
1 teaspoon baking powder
1/2 cup brown sugar
1 teaspoon vanilla extract
2 cups shredded mozzarella cheese
1 pound russet potatoes
1 sweet potato, cubed
1 head broccoli, cut into florets
2 zucchini, sliced
1 cup frozen peas
1 (6-ounce) can tomato paste
1 rotisserie chicken, shredded
1 pound shrimp, peeled and deveined
2 salmon fillets
1 cup dried red lentils
1 (15-ounce) can chickpeas, drained
1/4 cup soy sauce
2 tablespoons rice vinegar
1 tablespoon sesame oil
1 inch fresh ginger, grated
2 green onions, sliced
1 jalapeño, seeded and minced
1 avocado, sliced
1 cup cherry tomatoes, halved
2 cups baby spinach
1 (5-ounce) package arugula
1/2 cup crumbled feta cheese
1 cup Greek yogurt
8 ounces cream cheese, softened
1 cup sour cream
12 corn tortillas
8 flour tortillas
1 loaf crusty bread
4 hamburger buns
1 cup rolled oats
1/2 cup peanut butter
1 cup chocolate chips
1/2 cup chopped walnuts
1 cup quinoa
1 pound asparagus, trimmed
1 (10-ounce) bag frozen corn
2 tablespoons Worcestershire sauce
1 tablespoon Dijon mustard
1/4 cup mayonnaise
2 tablespoons ketchup
1 teaspoon dried oregano
1 teaspoon dried thyme
2 bay leaves
1 cinnamon stick
1/2 cup white wine
2 tablespoons balsamic vinegar
1 pound Italian sausage, casings removed
6 slices bacon
1 cup grated cheddar cheese
1 (16-ounce) box penne pasta
1 cup couscous
2 cups vegetable broth
1 tablespoon curry powder
1 (14-ounce) package firm tofu
1 cup cashews
1/4 cup sesame seeds
2 tablespoons cornstarch
1 pound flank steak
1 pound cod fillets
2 cups apple cider
3 apples, peeled and sliced
2 bananas, mashed
1 cup blueberries
1 pint strawberries
1 cup orange juice
1 English cucumber, sliced
1 (8-ounce) can tomato sauce
1 cup marinara sauce
2 tablespoons chili powder
1 pound Brussels sprouts, halved
1 butternut squash, cubed
1 cup pearl barley
1 (15-ounce) can kidney beans
1/2 cup raisins
1 tablespoon garlic powder
1 teaspoon onion powder
1 cup panko breadcrumbs
2 tablespoons fresh basil, chopped
1 cup half-and-half
1 (12-ounce) package bacon
1 pound ground turkey
1 cup wild rice
2 cups cauliflower florets
1 eggplant, cubed
1 pound green beans, trimmed
1/2 cup pine nuts
1 tablespoon capers
2 anchovy fillets
1 cup olives, pitted
1/4 cup red wine vinegar
1 tablespoon fish sauce
1 cup coconut flakes
2 tablespoons peanut oil
1 pound udon noodles
1 (8-ounce) package egg noodles
1 cup buttermilk
2 tablespoons powdered sugar
1 cup pumpkin puree
1 tablespoon nutritional yeast`.split('\n')

function priceOf(line: string) {
  const parsed = parseIngredient(line)
  const name = parsed.ingredientName || line
  const item: GroceryItem = {
    id: line,
    key: normalizeIngredientKey(name),
    name: displayIngredientName(name),
    quantities: parsed.quantity != null ? [{ amount: parsed.quantity, unit: parsed.unit }] : [],
    category: 'Other',
    checked: false,
    sources: [],
  }
  return priceOfItem(item)
}

describe('pricing an imported recipe', () => {
  it('prices what a real recipe asks for', () => {
    const missing = LINES.filter((line) => priceOf(line).amount == null)
    // Named rather than counted: a failure should say which line stopped working.
    expect(missing).toEqual([])
  })

  it('reads the size out of the brackets when the unit is a package', () => {
    const parsed = parseIngredient('1 (14-ounce) package firm tofu')
    expect(parsed.quantity).toBe(14)
    expect(parsed.unit).toBe('oz')
  })

  it('leaves cans alone, because a can is something a price knows', () => {
    const parsed = parseIngredient('1 (28-ounce) can crushed tomatoes')
    expect(parsed.unit).toBe('can')
    expect(parsed.quantity).toBe(1)
  })

  it('counts an inch of ginger as a piece of ginger', () => {
    const parsed = parseIngredient('1 inch fresh ginger, grated')
    expect(parsed.ingredientName).toBe('fresh ginger')
    expect(parsed.quantity).toBe(1)
  })

  /** A wrong price is worse than a dash, so the fallbacks must stay narrow. */
  it('still refuses to invent one', () => {
    expect(priceOf('1 cup unicorn tears').amount).toBeUndefined()
    expect(priceOf('2 tbsp fairy dust').amount).toBeUndefined()
  })

  it('keeps the specific price ahead of the plainer one', () => {
    // Stripping words is a last resort: these all have entries of their own.
    expect(priceOf('1 pound ground beef').amount).toBe(5.5)
    expect(priceOf('1 tablespoon garlic powder').amount).toBeLessThan(0.5)
    expect(priceOf('1 cup apple juice').amount).toBeLessThan(0.5)
    expect(priceOf('8 ounces cream cheese').amount).toBe(1.5)
  })
})
