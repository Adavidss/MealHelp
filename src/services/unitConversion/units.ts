/**
 * The unit registry.
 *
 * Units only ever combine inside a dimension. Volume never converts to mass,
 * because "1 cup of flour" and "120 g of flour" are only equal if you know the
 * density of flour, and MealHelp does not. Units the registry does not know
 * ("bunch", "can", "pinch") each become their own dimension, so they add up
 * with themselves and stay separate from everything else.
 */

export type Dimension = 'volume' | 'mass' | 'count' | 'length' | string

export interface UnitDefinition {
  id: string
  dimension: Dimension
  /** Amount of the dimension's base unit (ml, g, each, mm) in one of these. */
  toBase: number
  singular: string
  plural: string
  aliases: string[]
  /** US customary vs metric, used only to keep display in the same family. */
  system?: 'us' | 'metric'
}

const DEFINITIONS: UnitDefinition[] = [
  // ---- Volume (base: millilitre) ----
  {
    id: 'tsp',
    dimension: 'volume',
    toBase: 4.92892,
    singular: 'tsp',
    plural: 'tsp',
    system: 'us',
    aliases: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'],
  },
  {
    id: 'tbsp',
    dimension: 'volume',
    toBase: 14.7868,
    singular: 'tbsp',
    plural: 'tbsp',
    system: 'us',
    aliases: ['tbsp', 'tbsps', 'tbs', 'tablespoon', 'tablespoons', 'tbl'],
  },
  {
    id: 'fl-oz',
    dimension: 'volume',
    toBase: 29.5735,
    singular: 'fl oz',
    plural: 'fl oz',
    system: 'us',
    aliases: ['fl oz', 'fl. oz.', 'fl oz.', 'fluid ounce', 'fluid ounces', 'floz'],
  },
  {
    id: 'cup',
    dimension: 'volume',
    toBase: 236.588,
    singular: 'cup',
    plural: 'cups',
    system: 'us',
    aliases: ['cup', 'cups', 'c'],
  },
  {
    id: 'pint',
    dimension: 'volume',
    toBase: 473.176,
    singular: 'pint',
    plural: 'pints',
    system: 'us',
    aliases: ['pint', 'pints', 'pt'],
  },
  {
    id: 'quart',
    dimension: 'volume',
    toBase: 946.353,
    singular: 'quart',
    plural: 'quarts',
    system: 'us',
    aliases: ['quart', 'quarts', 'qt'],
  },
  {
    id: 'gallon',
    dimension: 'volume',
    toBase: 3785.41,
    singular: 'gallon',
    plural: 'gallons',
    system: 'us',
    aliases: ['gallon', 'gallons', 'gal'],
  },
  {
    id: 'ml',
    dimension: 'volume',
    toBase: 1,
    singular: 'ml',
    plural: 'ml',
    system: 'metric',
    aliases: ['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  },
  {
    id: 'l',
    dimension: 'volume',
    toBase: 1000,
    singular: 'L',
    plural: 'L',
    system: 'metric',
    aliases: ['l', 'liter', 'liters', 'litre', 'litres'],
  },

  // ---- Mass (base: gram) ----
  {
    id: 'g',
    dimension: 'mass',
    toBase: 1,
    singular: 'g',
    plural: 'g',
    system: 'metric',
    aliases: ['g', 'gr', 'gram', 'grams', 'gramme', 'grammes'],
  },
  {
    id: 'kg',
    dimension: 'mass',
    toBase: 1000,
    singular: 'kg',
    plural: 'kg',
    system: 'metric',
    aliases: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  },
  {
    id: 'mg',
    dimension: 'mass',
    toBase: 0.001,
    singular: 'mg',
    plural: 'mg',
    system: 'metric',
    aliases: ['mg', 'milligram', 'milligrams'],
  },
  {
    id: 'oz',
    dimension: 'mass',
    toBase: 28.3495,
    singular: 'oz',
    plural: 'oz',
    system: 'us',
    aliases: ['oz', 'ozs', 'ounce', 'ounces'],
  },
  {
    id: 'lb',
    dimension: 'mass',
    toBase: 453.592,
    singular: 'lb',
    plural: 'lbs',
    system: 'us',
    aliases: ['lb', 'lbs', 'pound', 'pounds', '#'],
  },
]

/**
 * Discrete units. They are real units — "3 cloves" is meaningful — but nothing
 * converts into or out of them, so each is its own dimension.
 */
const DISCRETE: Array<{ id: string; plural: string; aliases: string[] }> = [
  { id: 'clove', plural: 'cloves', aliases: ['clove', 'cloves'] },
  { id: 'can', plural: 'cans', aliases: ['can', 'cans'] },
  { id: 'jar', plural: 'jars', aliases: ['jar', 'jars'] },
  { id: 'package', plural: 'packages', aliases: ['package', 'packages', 'pkg', 'pack'] },
  { id: 'bag', plural: 'bags', aliases: ['bag', 'bags'] },
  { id: 'box', plural: 'boxes', aliases: ['box', 'boxes'] },
  { id: 'bunch', plural: 'bunches', aliases: ['bunch', 'bunches'] },
  { id: 'head', plural: 'heads', aliases: ['head', 'heads'] },
  { id: 'stalk', plural: 'stalks', aliases: ['stalk', 'stalks'] },
  { id: 'sprig', plural: 'sprigs', aliases: ['sprig', 'sprigs'] },
  { id: 'slice', plural: 'slices', aliases: ['slice', 'slices'] },
  { id: 'strip', plural: 'strips', aliases: ['strip', 'strips'] },
  { id: 'sheet', plural: 'sheets', aliases: ['sheet', 'sheets'] },
  { id: 'ear', plural: 'ears', aliases: ['ear', 'ears'] },
  { id: 'fillet', plural: 'fillets', aliases: ['fillet', 'fillets', 'filet', 'filets'] },
  { id: 'pinch', plural: 'pinches', aliases: ['pinch', 'pinches'] },
  { id: 'dash', plural: 'dashes', aliases: ['dash', 'dashes'] },
  { id: 'handful', plural: 'handfuls', aliases: ['handful', 'handfuls'] },
  { id: 'bottle', plural: 'bottles', aliases: ['bottle', 'bottles'] },
  { id: 'container', plural: 'containers', aliases: ['container', 'containers'] },
  { id: 'loaf', plural: 'loaves', aliases: ['loaf', 'loaves'] },
  { id: 'stick', plural: 'sticks', aliases: ['stick', 'sticks'] },
]

for (const item of DISCRETE) {
  DEFINITIONS.push({
    id: item.id,
    // Own dimension: nothing else may merge with it.
    dimension: `discrete:${item.id}`,
    toBase: 1,
    singular: item.id,
    plural: item.plural,
    aliases: item.aliases,
  })
}

const BY_ALIAS = new Map<string, UnitDefinition>()
const BY_ID = new Map<string, UnitDefinition>()
for (const def of DEFINITIONS) {
  BY_ID.set(def.id, def)
  for (const alias of def.aliases) BY_ALIAS.set(alias, def)
}

/** Longest alias first, so "fl oz" wins over "oz" when scanning a line. */
export const UNIT_ALIASES: string[] = [...BY_ALIAS.keys()].sort(
  (a, b) => b.length - a.length,
)

function cleanUnitText(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
}

/** Canonical unit id, or undefined when the text is not a unit at all. */
export function normalizeUnit(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = cleanUnitText(raw)
  if (!cleaned) return undefined
  const known = BY_ALIAS.get(cleaned) ?? BY_ALIAS.get(cleaned.replace(/\./g, ''))
  if (known) return known.id
  // Unknown units are kept verbatim rather than dropped; they simply only ever
  // add up with an identical unit.
  return cleaned
}

export function getUnit(id: string | undefined): UnitDefinition | undefined {
  return id ? BY_ID.get(id) : undefined
}

export function dimensionOf(unitId: string | undefined): Dimension {
  if (!unitId) return 'count'
  return BY_ID.get(unitId)?.dimension ?? `unknown:${unitId}`
}

/**
 * Whether two units can be added together. Two missing units count as
 * compatible ("2 onions" + "1 onion"), but a missing unit never merges with a
 * present one — "2 onions" and "200 g onion" are different information.
 */
export function unitsCompatible(a: string | undefined, b: string | undefined): boolean {
  return dimensionOf(a) === dimensionOf(b)
}

/** Converts within a dimension. Returns undefined across dimensions. */
export function convert(
  amount: number,
  from: string | undefined,
  to: string | undefined,
): number | undefined {
  if (!unitsCompatible(from, to)) return undefined
  const fromDef = getUnit(from)
  const toDef = getUnit(to)
  if (!fromDef || !toDef) return amount
  return (amount * fromDef.toBase) / toDef.toBase
}

/**
 * Renders a unit next to an amount. Anything up to one stays singular, because
 * "1/2 cups" is not how a recipe is read aloud.
 */
export function formatUnit(unitId: string | undefined, amount: number): string {
  if (!unitId) return ''
  const def = getUnit(unitId)
  if (!def) return unitId
  return Math.abs(amount) <= 1 ? def.singular : def.plural
}
