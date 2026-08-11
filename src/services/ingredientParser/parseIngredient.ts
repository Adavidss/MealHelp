import { UNIT_ALIASES, normalizeUnit } from '@/services/unitConversion'
import { categorizeIngredient } from './categorize'

/**
 * Ingredient parsing is a best effort over text written by humans for humans.
 * The parser is allowed to be wrong; what it is never allowed to do is throw
 * the original line away. Everything it produces sits *beside* `originalText`,
 * which is what the recipe view shows and what the grocery list quotes back.
 */
export interface ParsedIngredient {
  originalText: string
  quantity?: number
  quantityMax?: number
  unit?: string
  ingredientName: string
  preparation?: string
  optional?: boolean
  groceryCategory?: string
  section?: string
}

const VULGAR_FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  a: 1,
  an: 1,
  half: 0.5,
  dozen: 12,
  couple: 2,
}

/** Phrases that describe what to do to an ingredient, not which to buy. */
const PREP_WORDS = [
  'finely chopped',
  'roughly chopped',
  'coarsely chopped',
  'thinly sliced',
  'thickly sliced',
  'freshly grated',
  'freshly ground',
  'lightly beaten',
  'room temperature',
  'at room temperature',
  'cut into chunks',
  'cut into cubes',
  'cut into strips',
  'to taste',
  'for serving',
  'for garnish',
  'for topping',
  'plus more',
  'plus extra',
  'chopped',
  'diced',
  'minced',
  'sliced',
  'grated',
  'shredded',
  'crushed',
  'cubed',
  'julienned',
  'halved',
  'quartered',
  'peeled',
  'seeded',
  'cored',
  'stemmed',
  'trimmed',
  'rinsed',
  'drained',
  'melted',
  'softened',
  'beaten',
  'whisked',
  'divided',
  'thawed',
  'cooked',
  'uncooked',
  'packed',
  'undrained',
  'quartered',
  'zested',
  'juiced',
  'torn',
  'crumbled',
  'cubed',
  'warmed',
  'toasted',
]

const LEADING_ADVERBS =
  /^(finely|freshly|roughly|coarsely|thinly|thickly|lightly)\s+\w+ed\b/i

/** Bullet characters and checkbox glyphs copied along with a recipe. */
const LIST_MARKER = /^[\s\-–—•*▪▫◦●○+·▢☐□]+/

function expandFractions(text: string): string {
  let out = text
  for (const [glyph, value] of Object.entries(VULGAR_FRACTIONS)) {
    // "1½" has to become "1 1/2", not "11/2".
    out = out.replace(new RegExp(`(\\d)\\s*${glyph}`, 'g'), `$1 ${value}`)
    out = out.replace(new RegExp(glyph, 'g'), value)
  }
  return out
}

interface NumberMatch {
  value: number
  length: number
}

function matchNumber(text: string): NumberMatch | undefined {
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(text)
  if (mixed) {
    const [, whole, numerator, denominator] = mixed
    const denom = Number(denominator)
    if (denom !== 0) {
      return {
        value: Number(whole) + Number(numerator) / denom,
        length: mixed[0].length,
      }
    }
  }

  const fraction = /^(\d+)\s*\/\s*(\d+)/.exec(text)
  if (fraction) {
    const denom = Number(fraction[2])
    if (denom !== 0) {
      return { value: Number(fraction[1]) / denom, length: fraction[0].length }
    }
  }

  const decimal = /^(\d+(?:[.,]\d+)?)/.exec(text)
  if (decimal) {
    return {
      value: Number(decimal[1].replace(',', '.')),
      length: decimal[0].length,
    }
  }

  const word = /^([a-z]+)\b/i.exec(text)
  if (word) {
    const value = NUMBER_WORDS[word[1].toLowerCase()]
    // "a" and "an" only count as one when a unit follows ("a pinch of salt");
    // otherwise "an apple" would lose the apple.
    if (value != null) return { value, length: word[0].length }
  }

  return undefined
}

function matchUnit(text: string): { unit: string; length: number } | undefined {
  const lower = text.toLowerCase()
  for (const alias of UNIT_ALIASES) {
    if (!lower.startsWith(alias)) continue
    const next = lower.charAt(alias.length)
    // Must end on a word boundary so "cup" does not match "cupcakes".
    if (next && /[a-z0-9]/.test(next)) continue
    return { unit: alias, length: alias.length }
  }
  return undefined
}

function stripParentheticals(text: string): { rest: string; notes: string[] } {
  const notes: string[] = []
  let rest = text
  let guard = 0
  while (guard++ < 5) {
    const match = /^\(([^)]*)\)\s*/.exec(rest)
    if (!match) break
    if (match[1].trim()) notes.push(match[1].trim())
    rest = rest.slice(match[0].length)
  }
  return { rest, notes }
}

function splitNameAndPreparation(text: string): {
  name: string
  preparation?: string
} {
  const trimmed = text.trim()
  if (!trimmed) return { name: '' }

  // "onion, finely diced" — everything after the first comma is preparation.
  const commaIndex = trimmed.indexOf(',')
  if (commaIndex > 0) {
    return {
      name: trimmed.slice(0, commaIndex).trim(),
      preparation: trimmed.slice(commaIndex + 1).trim() || undefined,
    }
  }

  // "finely chopped parsley" — an adverb up front is clearly a method.
  const leading = LEADING_ADVERBS.exec(trimmed)
  if (leading) {
    return {
      name: trimmed.slice(leading[0].length).trim(),
      preparation: leading[0].trim(),
    }
  }

  // "2 cloves garlic minced" — a trailing method word with no comma.
  const lower = trimmed.toLowerCase()
  for (const word of PREP_WORDS) {
    if (lower.endsWith(` ${word}`)) {
      return {
        name: trimmed.slice(0, trimmed.length - word.length - 1).trim(),
        preparation: trimmed.slice(trimmed.length - word.length).trim(),
      }
    }
  }

  return { name: trimmed }
}

/**
 * Recipe blogs often price each line — "garam masala ($0.45)". That is the
 * writer's cost breakdown, not part of what you buy, and left in place it makes
 * the priced spice a different grocery item from the unpriced one.
 */
const INLINE_PRICE = /\s*\(\s*[$£€]\s*\d[\d.,]*\s*\)/g

function cleanName(name: string): string {
  return name
    .replace(INLINE_PRICE, '')
    .replace(/^of\s+/i, '')
    .replace(/[,;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Turns one written line into structured fields.
 *
 * Returns `ingredientName` equal to the original line when nothing could be
 * pulled apart, so a failed parse still produces a usable ingredient.
 */
export function parseIngredient(raw: string, section?: string): ParsedIngredient {
  const originalText = raw.trim()
  if (!originalText) {
    return { originalText: '', ingredientName: '' }
  }

  let working = expandFractions(originalText.replace(LIST_MARKER, ''))

  let optional = false
  if (/\boptional\b/i.test(working)) {
    optional = true
    working = working
      .replace(/\(\s*optional[^)]*\)/gi, ' ')
      .replace(/,?\s*\boptional\b\.?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const notes: string[] = []
  let quantity: number | undefined
  let quantityMax: number | undefined
  let unit: string | undefined

  const first = matchNumber(working)
  if (first) {
    const isWordNumber = /^[a-z]/i.test(working)
    const afterNumber = working.slice(first.length).trimStart()

    // A bare "a"/"an"/"one" only counts as a quantity when a unit follows it,
    // so "an apple" keeps its apple and "a pinch of salt" gets its pinch.
    const unitAfterWord = isWordNumber ? matchUnit(afterNumber) : undefined
    if (!isWordNumber || unitAfterWord) {
      quantity = first.value
      working = afterNumber

      const range = /^(?:-|–|—|to)\s*/.exec(working)
      if (range) {
        const upper = matchNumber(working.slice(range[0].length))
        if (upper) {
          quantityMax = upper.value
          working = working.slice(range[0].length + upper.length).trimStart()
        }
      }

      const beforeUnit = stripParentheticals(working)
      notes.push(...beforeUnit.notes)
      working = beforeUnit.rest

      const unitMatch = matchUnit(working)
      if (unitMatch) {
        unit = normalizeUnit(unitMatch.unit)
        working = working.slice(unitMatch.length).trimStart()
      }

      const afterUnit = stripParentheticals(working)
      notes.push(...afterUnit.notes)
      working = afterUnit.rest

      working = working.replace(/^of\s+/i, '')
    }
  }

  const { name, preparation } = splitNameAndPreparation(working)
  const finalName = cleanName(name) || originalText

  const preparationParts = [preparation, ...notes].filter(Boolean) as string[]

  return {
    originalText,
    quantity,
    quantityMax,
    unit,
    ingredientName: finalName,
    preparation: preparationParts.length ? preparationParts.join(', ') : undefined,
    optional: optional || undefined,
    groceryCategory: categorizeIngredient(finalName),
    section,
  }
}

/** A line like "For the sauce:" groups the lines that follow it. */
function asSectionHeading(line: string): string | undefined {
  const trimmed = line.trim()
  if (!trimmed.endsWith(':')) return undefined
  if (/\d/.test(trimmed)) return undefined
  if (trimmed.length > 60) return undefined
  return trimmed.slice(0, -1).trim() || undefined
}

/** Parses a pasted block, one ingredient per line, honouring section headings. */
export function parseIngredientLines(text: string): ParsedIngredient[] {
  const results: ParsedIngredient[] = []
  let section: string | undefined

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const heading = asSectionHeading(trimmed)
    if (heading) {
      section = heading
      continue
    }

    results.push(parseIngredient(trimmed, section))
  }

  return results
}
