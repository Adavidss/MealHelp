/**
 * The photographs shipped with the starter recipes.
 *
 * They are real food, not stock illustration, because a board of food is the
 * whole idea of the app and generated artwork only ever stood in for a
 * missing picture. They are bundled as files rather than linked from a photo
 * site for two reasons: a link to somebody else's server rots, and fetching
 * one would tell that server which recipes you are looking at — which is not
 * a thing an app that never uploads anything should start doing.
 *
 * Every one is freely licensed, from Wikimedia Commons. CC BY and CC BY-SA
 * require attribution, so the credits below are shown in Settings and listed
 * in the README; nothing here is used beyond what those licences allow.
 */

export interface StarterPhoto {
  /** Matches the file in public/starters and the seed that uses it. */
  slug: string
  /** The recipe the photograph illustrates. */
  recipe: string
  author: string
  license: string
  licenseUrl: string
  /** The file's page on Wikimedia Commons. */
  sourceUrl: string
}

const CC = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  by2: 'https://creativecommons.org/licenses/by/2.0/',
  by3: 'https://creativecommons.org/licenses/by/3.0/',
  by4: 'https://creativecommons.org/licenses/by/4.0/',
  bysa2: 'https://creativecommons.org/licenses/by-sa/2.0/',
  bysa4: 'https://creativecommons.org/licenses/by-sa/4.0/',
}

export const STARTER_PHOTOS: StarterPhoto[] = [
  {
    slug: 'chicken-curry',
    recipe: 'Slow Cooker Chicken Curry',
    author: 'Serial Number 54129',
    license: 'CC BY-SA 4.0',
    licenseUrl: CC.bysa4,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bhuna_curry_bowl.jpg',
  },
  {
    slug: 'beef-chili',
    recipe: 'Instant Pot Beef Chili',
    author: 'cyclonebill',
    license: 'CC BY-SA 2.0',
    licenseUrl: CC.bysa2,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Chili_con_carne_(5034005470).jpg',
  },
  {
    slug: 'sheet-pan-chicken',
    recipe: 'Sheet Pan Chicken and Vegetables',
    author: 'Sharon Chen',
    license: 'CC BY 2.0',
    licenseUrl: CC.by2,
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:One-Pan_Balsamic_Chicken_with_Roasted_Vegetables-5_(30545623394).jpg',
  },
  {
    slug: 'grilled-cheese-tomato-soup',
    recipe: 'Grilled Cheese and Tomato Soup',
    author: 'HarshLight',
    license: 'CC BY 2.0',
    licenseUrl: CC.by2,
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Jolly_Holiday_Combo_-_28212938952.jpg',
  },
  {
    slug: 'sausage-pasta',
    recipe: 'One Pot Creamy Sausage Pasta',
    author: 'Sarah Stierch',
    license: 'CC0',
    licenseUrl: CC.cc0,
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Jacob's_Restaurant_-_December_2025_-_Sarah_Stierch_03.jpg",
  },
  {
    slug: 'pulled-pork',
    recipe: 'Slow Cooker Pulled Pork',
    author: 'Shreveport-Bossier Convention and Tourist Bureau',
    license: 'CC BY 2.0',
    licenseUrl: CC.by2,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pulled_whole_hog_barbecue.jpg',
  },
  {
    slug: 'fried-rice',
    recipe: 'Weeknight Fried Rice',
    author: 'Stacy Spensley',
    license: 'CC BY 2.0',
    licenseUrl: CC.by2,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kimchi_fried_rice_2.jpg',
  },
  {
    slug: 'lentil-soup',
    recipe: 'Instant Pot Lentil Soup',
    author: 'Andy Li',
    license: 'CC0',
    licenseUrl: CC.cc0,
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Lentil_Soup_-_Schnitzel_%26_Co._2026-05-16.jpg',
  },
  {
    slug: 'quesadilla',
    recipe: 'Black Bean Quesadillas',
    author: 'Sarah Stierch',
    license: 'CC BY 4.0',
    licenseUrl: CC.by4,
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:La_Casa_Restaurant_-_November_15_2023_-_Sarah_Stierch.jpg',
  },
  {
    slug: 'roast-chicken-potatoes',
    recipe: 'Roast Chicken with Potatoes',
    author: 'Biso',
    license: 'CC BY 3.0',
    licenseUrl: CC.by3,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Roasted_chicken_and_potatoes.JPG',
  },
  {
    slug: 'turkey-meatballs',
    recipe: 'Big Batch Turkey Meatballs',
    author: 'Sarah Stierch',
    license: 'CC BY 4.0',
    licenseUrl: CC.by4,
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Penne_and_turkey_meatballs_-_Jan_2022_-_Sarah_Stierch.jpg',
  },
  {
    slug: 'overnight-oats',
    recipe: 'Overnight Oats',
    author: 'David Stewart',
    license: 'CC BY 2.0',
    licenseUrl: CC.by2,
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Muesli_with_Berries.jpg',
  },
]

/**
 * Where a starter photograph lives, as an absolute path under the app's base.
 *
 * It has to be absolute, not relative: the URL is stored on the recipe in
 * IndexedDB and then rendered from whatever route the user happens to be on,
 * so a relative path would resolve differently on /recipes than on
 * /recipes/abc123.
 */
export function starterPhotoUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}starters/${slug}.webp`
}
