import type { RecipeDraft } from '@/models'
import { parseHumanDuration, parseServings, toRecipeDraft } from './normalizeDraft'

/**
 * The paste parser.
 *
 * When a site cannot be read directly, the user copies the recipe and MealHelp
 * makes sense of it. The heuristics are simple on purpose: find the headings if
 * they exist, and otherwise tell ingredients from directions by shape — a line
 * starting with a quantity is something you buy, a sentence is something you
 * do. Whatever it gets wrong is fixed in the preview editor, which is why the
 * preview is never skipped.
 */

const INGREDIENT_HEADINGS =
  /^(ingredients?|you(?:'|’)?ll need|what you need|shopping list)\s*:?\s*$/i
const INSTRUCTION_HEADINGS =
  /^(instructions?|directions?|method|steps?|preparation|how to make.*)\s*:?\s*$/i
const NOTES_HEADINGS = /^(notes?|tips?|chef(?:'|’)?s notes?|storage)\s*:?\s*$/i
const IGNORED_HEADINGS =
  /^(nutrition|nutrition facts|equipment|video|jump to recipe|print recipe|save recipe|rate this recipe|share)\s*:?\s*$/i

const SERVINGS_LINE = /^(?:serves|servings?|yield|makes)\s*:?\s*(.+)$/i
const PREP_LINE = /^prep(?:aration)?\s*(?:time)?\s*:?\s*(.+)$/i
const COOK_LINE = /^cook(?:ing)?\s*(?:time)?\s*:?\s*(.+)$/i
const TOTAL_LINE = /^total\s*(?:time)?\s*:?\s*(.+)$/i

/** Looks like something you buy: "2 cups flour", "½ onion", "Salt to taste". */
const QUANTITY_START = /^(?:[\d¼½¾⅓⅔⅛⅜⅝⅞]|a\s+(?:pinch|dash|handful)\b)/i
const LIST_MARKER = /^[-–—•*▪▫◦●○+·▢☐□]\s*/

type Section = 'unknown' | 'ingredients' | 'instructions' | 'notes' | 'ignored'

export interface TextParseResult {
  draft: RecipeDraft
  warnings: string[]
}

export function parseRecipeText(text: string, sourceUrl?: string): TextParseResult {
  const warnings: string[] = []
  const rawLines = text.split(/\r?\n/).map((line) => line.trim())

  let title = ''
  let servings: number | undefined
  let prep: number | undefined
  let cook: number | undefined
  let total: number | undefined

  const ingredientLines: string[] = []
  const instructionLines: string[] = []
  const noteLines: string[] = []
  const unassigned: string[] = []

  let section: Section = 'unknown'
  let sawHeadings = false

  for (const raw of rawLines) {
    if (!raw) continue
    const line = raw.replace(LIST_MARKER, '').trim()
    if (!line) continue

    if (INGREDIENT_HEADINGS.test(line)) {
      section = 'ingredients'
      sawHeadings = true
      continue
    }
    if (INSTRUCTION_HEADINGS.test(line)) {
      section = 'instructions'
      sawHeadings = true
      continue
    }
    if (NOTES_HEADINGS.test(line)) {
      section = 'notes'
      sawHeadings = true
      continue
    }
    if (IGNORED_HEADINGS.test(line)) {
      section = 'ignored'
      continue
    }

    const servingsMatch = SERVINGS_LINE.exec(line)
    if (servingsMatch && servings == null) {
      servings = parseServings(servingsMatch[1])
      continue
    }
    const prepMatch = PREP_LINE.exec(line)
    if (prepMatch && prep == null) {
      prep = parseHumanDuration(prepMatch[1])
      if (prep != null) continue
    }
    const cookMatch = COOK_LINE.exec(line)
    if (cookMatch && cook == null) {
      cook = parseHumanDuration(cookMatch[1])
      if (cook != null) continue
    }
    const totalMatch = TOTAL_LINE.exec(line)
    if (totalMatch && total == null) {
      total = parseHumanDuration(totalMatch[1])
      if (total != null) continue
    }

    if (!title && section === 'unknown' && looksLikeTitle(line)) {
      title = line
      continue
    }

    switch (section) {
      case 'ingredients':
        ingredientLines.push(line)
        break
      case 'instructions':
        instructionLines.push(stripStepNumber(line))
        break
      case 'notes':
        noteLines.push(line)
        break
      case 'ignored':
        break
      default:
        unassigned.push(line)
    }
  }

  // No headings at all: sort the leftovers by shape.
  if (!sawHeadings || (!ingredientLines.length && !instructionLines.length)) {
    for (const line of unassigned) {
      if (looksLikeIngredient(line)) ingredientLines.push(line)
      else instructionLines.push(stripStepNumber(line))
    }
    if (unassigned.length) {
      warnings.push(
        'MealHelp guessed which lines were ingredients and which were directions — check them below.',
      )
    }
  } else if (unassigned.length) {
    // Text above the first heading is usually a description, not a step.
    const description = unassigned.join(' ')
    if (description.length > 200) warnings.push('Some text could not be placed.')
  }

  if (!title) {
    title = ingredientLines.length ? 'Pasted recipe' : 'Untitled recipe'
    warnings.push('MealHelp could not find a title.')
  }
  if (!ingredientLines.length) warnings.push('No ingredients were found.')
  if (!instructionLines.length) warnings.push('No directions were found.')

  const draft = toRecipeDraft({
    title,
    sourceUrl,
    servings,
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: total,
    ingredientLines,
    instructionTexts: instructionLines,
    notes: noteLines.length ? noteLines.join('\n') : undefined,
  })

  return { draft, warnings }
}

function looksLikeTitle(line: string): boolean {
  if (line.length > 80) return false
  if (QUANTITY_START.test(line)) return false
  if (/[.!?]$/.test(line) && line.split(' ').length > 8) return false
  return line.split(' ').length <= 12
}

function looksLikeIngredient(line: string): boolean {
  if (QUANTITY_START.test(line)) return true
  if (line.length > 90) return false
  // Directions are sentences; ingredients are noun phrases.
  const words = line.split(/\s+/).length
  return words <= 6 && !/[.!?]$/.test(line)
}

function stripStepNumber(line: string): string {
  return line.replace(/^\s*(?:step\s*)?\d+[.):]\s*/i, '').trim()
}
