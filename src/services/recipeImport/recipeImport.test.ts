import { describe, expect, it } from 'vitest'
import { parseRecipeFromHtml } from './jsonLd'
import { parseRecipeText } from './parseText'
import { detectTimerMinutes, parseISODuration, parseServings } from './normalizeDraft'
import { normalizeUrl } from './adapters'

const JSON_LD_PAGE = `<!doctype html><html><head><title>Curry</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "name": "Example Food" },
    {
      "@type": "Recipe",
      "name": "Slow Cooker Chicken Curry",
      "description": "Weeknight curry.",
      "image": ["https://example.com/curry.jpg"],
      "author": { "@type": "Person", "name": "Sam Cook" },
      "recipeYield": "6 servings",
      "prepTime": "PT20M",
      "cookTime": "PT6H",
      "keywords": "curry, slow cooker, easy",
      "recipeIngredient": [
        "2 lbs chicken thighs",
        "1 (14 oz) can coconut milk",
        "2 tbsp curry paste"
      ],
      "recipeInstructions": [
        { "@type": "HowToStep", "text": "Put everything in the slow cooker." },
        { "@type": "HowToStep", "text": "Cook on low for 6 hours." }
      ]
    }
  ]
}
</script></head><body></body></html>`

describe('parseRecipeFromHtml', () => {
  it('reads a Schema.org recipe out of a page', () => {
    const parsed = parseRecipeFromHtml(JSON_LD_PAGE, 'https://example.com/curry')
    expect(parsed).toBeDefined()
    const recipe = parsed!.draft

    expect(recipe.title).toBe('Slow Cooker Chicken Curry')
    expect(recipe.servings).toBe(6)
    expect(recipe.prepTimeMinutes).toBe(20)
    expect(recipe.cookTimeMinutes).toBe(360)
    expect(recipe.totalTimeMinutes).toBe(380)
    expect(recipe.author).toBe('Sam Cook')
    expect(recipe.image).toBe('https://example.com/curry.jpg')
    expect(recipe.ingredients).toHaveLength(3)
    expect(recipe.instructions).toHaveLength(2)
    expect(recipe.tags).toContain('slow cooker')
  })

  it('keeps the source so the original is never lost', () => {
    const parsed = parseRecipeFromHtml(JSON_LD_PAGE, 'https://example.com/curry')
    expect(parsed!.draft.sourceUrl).toBe('https://example.com/curry')
    expect(parsed!.draft.sourceName).toBe('example.com')
  })

  it('infers how the recipe is cooked', () => {
    const parsed = parseRecipeFromHtml(JSON_LD_PAGE, 'https://example.com/curry')
    expect(parsed!.draft.cookingMethods).toContain('slow-cooker')
  })

  it('returns nothing for a page with no recipe on it', () => {
    expect(parseRecipeFromHtml('<html><body><p>Hello</p></body></html>')).toBeUndefined()
  })

  it('ignores a broken JSON-LD block rather than giving up', () => {
    const page = `<html><head>
      <script type="application/ld+json">{ not json </script>
      ${JSON_LD_PAGE}
    </head></html>`
    expect(parseRecipeFromHtml(page)).toBeDefined()
  })
})

describe('parseRecipeText', () => {
  it('splits a pasted recipe into its sections', () => {
    const { draft } = parseRecipeText(
      [
        'Slow Cooker Chicken Curry',
        'Serves 6',
        'Prep time: 20 minutes',
        'Cook time: 6 hours',
        '',
        'Ingredients',
        '2 lbs chicken thighs',
        '1 can coconut milk',
        '2 tbsp curry paste',
        '',
        'Instructions',
        '1. Put everything in the slow cooker.',
        '2. Cook on low for 6 hours.',
      ].join('\n'),
    )

    expect(draft.title).toBe('Slow Cooker Chicken Curry')
    expect(draft.servings).toBe(6)
    expect(draft.prepTimeMinutes).toBe(20)
    expect(draft.cookTimeMinutes).toBe(360)
    expect(draft.ingredients.map((i) => i.originalText)).toEqual([
      '2 lbs chicken thighs',
      '1 can coconut milk',
      '2 tbsp curry paste',
    ])
    expect(draft.instructions[0].text).toBe('Put everything in the slow cooker.')
  })

  it('guesses sensibly when there are no headings, and says that it guessed', () => {
    const { draft, warnings } = parseRecipeText(
      [
        'Quick Beans',
        '1 can black beans',
        '1 tsp cumin',
        'Warm the beans in a pan with the cumin for five minutes and serve.',
      ].join('\n'),
    )

    expect(draft.ingredients).toHaveLength(2)
    expect(draft.instructions).toHaveLength(1)
    expect(warnings.join(' ')).toMatch(/guessed/i)
  })

  it('never silently produces an empty recipe', () => {
    const { warnings } = parseRecipeText('Just a title and nothing else')
    expect(warnings.join(' ')).toMatch(/no ingredients/i)
  })
})

describe('duration and yield parsing', () => {
  it('reads ISO durations', () => {
    expect(parseISODuration('PT30M')).toBe(30)
    expect(parseISODuration('PT1H30M')).toBe(90)
    expect(parseISODuration('P1DT2H')).toBe(1560)
    expect(parseISODuration('nonsense')).toBeUndefined()
  })

  it('reads durations written for humans', () => {
    expect(parseISODuration('1 hr 15 mins')).toBe(75)
    expect(parseISODuration('45 minutes')).toBe(45)
  })

  it('reads a yield', () => {
    expect(parseServings('6 servings')).toBe(6)
    expect(parseServings('Serves 4-6')).toBe(4)
    expect(parseServings(8)).toBe(8)
  })
})

describe('detectTimerMinutes', () => {
  it('offers a timer for a step that asks you to wait', () => {
    expect(detectTimerMinutes('Bake for 25 minutes.')).toBe(25)
    expect(detectTimerMinutes('Simmer for 10 minutes.')).toBe(10)
    expect(detectTimerMinutes('Cook on low for 6 hours.')).toBe(360)
  })

  it('does not offer a timer for an overnight marinade', () => {
    expect(detectTimerMinutes('Marinate for 48 hours.')).toBeUndefined()
  })

  it('offers nothing when there is no duration', () => {
    expect(detectTimerMinutes('Season to taste.')).toBeUndefined()
  })
})

describe('normalizeUrl', () => {
  it('adds a scheme and strips tracking parameters', () => {
    expect(normalizeUrl('example.com/curry?utm_source=pinterest')).toBe(
      'https://example.com/curry',
    )
  })
})
