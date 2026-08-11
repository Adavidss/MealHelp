import { describe, expect, it } from 'vitest'
import {
  buildBookmarklet,
  buildCaptureScript,
  captureToDraft,
  decodeCapture,
  encodeCapture,
  type CapturePayload,
} from './capture'
import { RecipeImportError } from './types'

const RECIPE_NODE = {
  name: 'Slow Cooker Chicken Tikka Masala',
  recipeYield: '6 servings',
  prepTime: 'PT20M',
  cookTime: 'PT6H',
  recipeIngredient: ['2 lbs chicken thighs', '1 (14 oz) can coconut milk'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Put everything in the slow cooker.' },
    { '@type': 'HowToStep', text: 'Cook on low for 6 hours.' },
  ],
}

describe('capture round trip', () => {
  it('carries a recipe from a page into a draft', () => {
    const payload: CapturePayload = {
      v: 1,
      r: RECIPE_NODE,
      u: 'https://example.com/tikka',
      n: 'example.com',
    }

    const { draft } = captureToDraft(decodeCapture(encodeCapture(payload)))

    expect(draft.title).toBe('Slow Cooker Chicken Tikka Masala')
    expect(draft.servings).toBe(6)
    expect(draft.prepTimeMinutes).toBe(20)
    expect(draft.cookTimeMinutes).toBe(360)
    expect(draft.ingredients).toHaveLength(2)
    expect(draft.instructions).toHaveLength(2)
    expect(draft.sourceUrl).toBe('https://example.com/tikka')
  })

  it('survives accents and symbols in a recipe', () => {
    const payload: CapturePayload = {
      v: 1,
      r: { ...RECIPE_NODE, name: 'Crème Brûlée — 350°F' },
    }
    const { draft } = captureToDraft(decodeCapture(encodeCapture(payload)))
    expect(draft.title).toBe('Crème Brûlée — 350°F')
  })

  it('falls back to the page text when a site has no recipe markup', () => {
    const payload: CapturePayload = {
      v: 1,
      t: [
        'Weeknight Fried Rice',
        'Ingredients',
        '4 cups cooked rice',
        '3 eggs',
        'Instructions',
        'Fry everything in a hot pan for five minutes.',
      ].join('\n'),
      u: 'https://example.com/rice',
      n: 'example.com',
    }

    const { draft, warnings } = captureToDraft(decodeCapture(encodeCapture(payload)))

    expect(draft.title).toBe('Weeknight Fried Rice')
    expect(draft.ingredients).toHaveLength(2)
    expect(warnings.join(' ')).toMatch(/no structured recipe data/i)
  })

  it('says so plainly when the link was cut short', () => {
    expect(() => decodeCapture('not-a-real-payload!!')).toThrow(RecipeImportError)
    expect(() => decodeCapture('not-a-real-payload!!')).toThrow(/cut short|could not be read/i)
  })

  it('refuses a payload from a different version of the button', () => {
    const encoded = encodeCapture({ v: 99, r: RECIPE_NODE } as CapturePayload)
    expect(() => decodeCapture(encoded)).toThrow(/different version/i)
  })

  it('rejects a capture with nothing in it', () => {
    expect(() => captureToDraft({ v: 1 })).toThrow(/empty/i)
  })

  /**
   * The whole point of sending only the recipe fields: a recipe page is often
   * most of a megabyte, and a link has to stay a link.
   */
  it('produces a link short enough for a browser to open', () => {
    const big: CapturePayload = {
      v: 1,
      r: {
        ...RECIPE_NODE,
        recipeIngredient: Array.from({ length: 40 }, (_, i) => `${i + 1} cups ingredient ${i}`),
        recipeInstructions: Array.from({ length: 25 }, (_, i) => ({
          '@type': 'HowToStep',
          text: `Step ${i} with a fairly wordy description of what to do next.`,
        })),
      },
      u: 'https://example.com/very/long/recipe/url/that/goes/on',
    }
    expect(encodeCapture(big).length).toBeLessThan(28_000)
  })
})

describe('the capture script', () => {
  const script = buildCaptureScript('https://kidsdc.org/MealHelp/')

  it('is small enough to live in a bookmark', () => {
    expect(script.length).toBeLessThan(2000)
  })

  it('points back at this installation', () => {
    expect(script).toContain('https://kidsdc.org/MealHelp/#/capture/')
  })

  it('reads structured data and falls back to visible text', () => {
    expect(script).toContain('application/ld+json')
    expect(script).toContain('innerText')
  })

  it('refuses to build a link a browser would truncate', () => {
    expect(script).toContain('28000')
  })

  it('makes a usable javascript: bookmark', () => {
    const bookmarklet = buildBookmarklet('https://kidsdc.org/MealHelp/')
    expect(bookmarklet.startsWith('javascript:')).toBe(true)
    expect(decodeURIComponent(bookmarklet.slice('javascript:'.length))).toBe(script)
  })
})
