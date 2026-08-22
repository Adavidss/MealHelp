import type { RecipeDraft } from '@/models'
import {
  parseISODuration,
  parseServings,
  toRecipeDraft,
  type DraftInput,
} from './normalizeDraft'
import { parseSchemaNutrition } from '@/services/nutrition/parseSchemaNutrition'

/**
 * Schema.org Recipe extraction.
 *
 * Nearly every recipe site emits JSON-LD for Google, which makes it by far the
 * most reliable thing to read — far more so than scraping the visible markup,
 * which differs on every site. Microdata is checked as a fallback for the older
 * sites that never moved.
 */

type Json = Record<string, unknown>

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function typeOf(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  const type = (node as Json)['@type']
  return asArray(type).filter((t): t is string => typeof t === 'string')
}

function isRecipeNode(node: unknown): boolean {
  return typeOf(node).some((type) => type.toLowerCase() === 'recipe')
}

/** Walks JSON-LD, including @graph containers and nested arrays. */
function findRecipeNode(root: unknown, depth = 0): Json | undefined {
  if (depth > 6 || root == null) return undefined

  if (Array.isArray(root)) {
    for (const entry of root) {
      const found = findRecipeNode(entry, depth + 1)
      if (found) return found
    }
    return undefined
  }

  if (typeof root !== 'object') return undefined
  if (isRecipeNode(root)) return root as Json

  const node = root as Json
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    if (key in node) {
      const found = findRecipeNode(node[key], depth + 1)
      if (found) return found
    }
  }
  return undefined
}

function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return decodeEntities(value.trim()) || undefined
  if (Array.isArray(value)) return textOf(value[0])
  if (value && typeof value === 'object') {
    const node = value as Json
    return textOf(node.name ?? node.text ?? node['@value'])
  }
  return undefined
}

function imageOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value)) return imageOf(value[0])
  if (value && typeof value === 'object') {
    const node = value as Json
    return imageOf(node.url ?? node.contentUrl ?? node['@id'])
  }
  return undefined
}

/** HowToStep, HowToSection and plain strings all appear in the wild. */
function instructionsOf(value: unknown, depth = 0): string[] {
  if (depth > 4) return []
  if (typeof value === 'string') return splitInstructionBlob(value)
  if (Array.isArray(value)) return value.flatMap((entry) => instructionsOf(entry, depth + 1))
  if (value && typeof value === 'object') {
    const node = value as Json
    if (node.itemListElement) return instructionsOf(node.itemListElement, depth + 1)
    const text = textOf(node.text ?? node.name)
    return text ? [text] : []
  }
  return []
}

/** One long paragraph is common; numbered or sentence breaks recover the steps. */
function splitInstructionBlob(text: string): string[] {
  const clean = decodeEntities(text).replace(/\r/g, '')
  const byLine = clean
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
  if (byLine.length > 1) return byLine

  const numbered = clean
    .split(/(?=\b\d+[.)]\s+[A-Z])/)
    .map((part) => part.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
  if (numbered.length > 1) return numbered

  return clean.trim() ? [clean.trim()] : []
}

function decodeEntities(text: string): string {
  if (!text.includes('&')) return text
  if (typeof document === 'undefined') return text
  const el = document.createElement('textarea')
  el.innerHTML = text
  return el.value
}

export interface JsonLdParseResult {
  draft: RecipeDraft
  warnings: string[]
}

/** Reads every JSON-LD block in a document and returns the first Recipe. */
export function parseRecipeFromDocument(
  doc: Document,
  sourceUrl?: string,
): JsonLdParseResult | undefined {
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')]

  for (const script of scripts) {
    const raw = script.textContent?.trim()
    if (!raw) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Some sites emit trailing commas or stray newlines; one bad block is no
      // reason to give up on the others.
      continue
    }
    const node = findRecipeNode(parsed)
    if (node) return fromSchemaNode(node, doc, sourceUrl)
  }

  return parseMicrodata(doc, sourceUrl)
}

export function fromSchemaNode(
  node: Record<string, unknown>,
  doc?: Document,
  sourceUrl?: string,
): JsonLdParseResult {
  const warnings: string[] = []

  const ingredientLines = asArray(node.recipeIngredient ?? node.ingredients)
    .map((entry) => textOf(entry))
    .filter((line): line is string => Boolean(line))

  const instructionTexts = instructionsOf(node.recipeInstructions)

  if (!ingredientLines.length) warnings.push('No ingredients were found.')
  if (!instructionTexts.length) warnings.push('No directions were found.')

  const prep = parseISODuration(node.prepTime)
  const cook = parseISODuration(node.cookTime)
  const total = parseISODuration(node.totalTime)

  const keywords = textOf(node.keywords)
  const tags = keywords
    ? keywords
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : []

  const categories = asArray(node.recipeCategory)
    .map((entry) => textOf(entry))
    .filter((entry): entry is string => Boolean(entry))

  const input: DraftInput = {
    title: textOf(node.name) ?? doc?.title ?? 'Imported recipe',
    description: textOf(node.description),
    sourceUrl,
    sourceName: sourceUrl ? hostnameOf(sourceUrl) : undefined,
    author: textOf(node.author),
    image: imageOf(node.image),
    servings: parseServings(node.recipeYield ?? node.yield),
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: total,
    ingredientLines,
    instructionTexts,
    tags,
    categories,
    nutrition: parseSchemaNutrition(node.nutrition),
  }

  return { draft: toRecipeDraft(input), warnings }
}

/** Older sites still mark recipes up with itemprop attributes. */
function parseMicrodata(doc: Document, sourceUrl?: string): JsonLdParseResult | undefined {
  const scope = doc.querySelector('[itemtype*="schema.org/Recipe" i]')
  if (!scope) return undefined

  const pick = (prop: string): string | undefined => {
    const el = scope.querySelector(`[itemprop="${prop}"]`)
    if (!el) return undefined
    const content = el.getAttribute('content') ?? el.getAttribute('datetime')
    return (content ?? el.textContent ?? '').trim() || undefined
  }

  const pickAll = (prop: string): string[] =>
    [...scope.querySelectorAll(`[itemprop="${prop}"]`)]
      .map((el) => (el.getAttribute('content') ?? el.textContent ?? '').trim())
      .filter(Boolean)

  const ingredientLines = [
    ...pickAll('recipeIngredient'),
    ...pickAll('ingredients'),
  ]
  const instructionTexts = pickAll('recipeInstructions')

  if (!ingredientLines.length && !instructionTexts.length) return undefined

  const input: DraftInput = {
    title: pick('name') ?? doc.title ?? 'Imported recipe',
    description: pick('description'),
    sourceUrl,
    sourceName: sourceUrl ? hostnameOf(sourceUrl) : undefined,
    author: pick('author'),
    image: doc.querySelector<HTMLImageElement>('[itemprop="image"]')?.src,
    servings: parseServings(pick('recipeYield')),
    prepTimeMinutes: parseISODuration(pick('prepTime')),
    cookTimeMinutes: parseISODuration(pick('cookTime')),
    totalTimeMinutes: parseISODuration(pick('totalTime')),
    ingredientLines,
    instructionTexts,
  }

  return {
    draft: toRecipeDraft(input),
    warnings: ['This site uses an older recipe format, so some details may be missing.'],
  }
}

export function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/** Parses an HTML string. Used for both fetched pages and pasted page source. */
export function parseRecipeFromHtml(
  html: string,
  sourceUrl?: string,
): JsonLdParseResult | undefined {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return parseRecipeFromDocument(doc, sourceUrl)
}
