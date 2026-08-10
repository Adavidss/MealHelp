import type { RecipeDraft } from '@/models'

export interface RecipeImportResult {
  recipe: RecipeDraft
  /** Things the parser had to guess at, surfaced in the preview. */
  warnings: string[]
  adapterId: string
}

/**
 * Import is deliberately pluggable. A GitHub Pages build can only do what the
 * browser lets it do, and most recipe sites refuse cross-origin reads — so
 * "fetch the URL" is one adapter among several rather than the whole feature.
 * A serverless importer or a share-sheet extension can be added later by
 * implementing this interface; nothing else has to change.
 */
export interface RecipeImportAdapter {
  id: string
  label: string
  canHandle(input: string): boolean
  import(input: string): Promise<RecipeImportResult>
}

export type ImportFailureKind =
  | 'blocked'
  | 'network'
  | 'no-recipe'
  | 'empty'
  | 'unsupported'

/**
 * Import errors carry a message written for the person holding the phone.
 * "Failed to fetch" is never what the user sees.
 */
export class RecipeImportError extends Error {
  kind: ImportFailureKind
  /** What the user can do about it, shown under the message. */
  suggestion?: string

  constructor(kind: ImportFailureKind, message: string, suggestion?: string) {
    super(message)
    this.name = 'RecipeImportError'
    this.kind = kind
    this.suggestion = suggestion
  }
}

export const PASTE_FALLBACK_MESSAGE =
  "MealHelp couldn't directly access this recipe website. Paste the recipe text below and MealHelp will convert it into the standard format."
