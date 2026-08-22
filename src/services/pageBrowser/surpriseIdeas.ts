/**
 * Things to search for when you have no idea what to search for.
 *
 * The web tab's version of "surprise me" cannot pick a random recipe the way
 * the library can — there is no list of every recipe on the internet to draw
 * from. What it can do is ask a question you would not have thought to ask,
 * which turns out to be the useful half of a surprise anyway.
 *
 * Chosen to be dinners rather than curiosities: every one of these is
 * something a person might actually cook on a Tuesday, spread across cuisines
 * and methods so consecutive rolls do not all look the same.
 */

export const SURPRISE_IDEAS: string[] = [
  'chicken traybake',
  'lentil dahl',
  'beef stew',
  'shakshuka',
  'chicken and rice soup',
  'sausage and white bean stew',
  'mushroom risotto',
  'fish tacos',
  'chickpea curry',
  'pork ragu',
  'thai green curry',
  'roast vegetable pasta',
  'black bean soup',
  'lemon chicken orzo',
  'beef stir fry',
  'baked ziti',
  'salmon traybake',
  'tomato and butter bean stew',
  'chicken shawarma bowl',
  'creamy tuscan chicken',
  'sweet potato chilli',
  'miso noodle soup',
  'greek lemon potatoes and chicken',
  'spinach and ricotta pasta bake',
  'harissa chicken',
  'coconut fish curry',
  'french onion pasta',
  'chorizo and chickpea stew',
  'teriyaki salmon rice bowl',
  'braised beef ragu pappardelle',
]

/** The ideas as identified items, for the shared random picker. */
export function surpriseIdeaItems(): Array<{ id: string }> {
  return SURPRISE_IDEAS.map((idea) => ({ id: idea }))
}
