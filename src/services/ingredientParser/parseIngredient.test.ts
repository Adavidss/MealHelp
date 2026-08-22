import { describe, expect, it } from 'vitest'
import { parseIngredient, parseIngredientLines } from './parseIngredient'
import { displayIngredientName, normalizeIngredientKey, singularize } from './normalize'

describe('parseIngredient', () => {
  it('splits the example from the spec into its parts', () => {
    const result = parseIngredient('2 large yellow onions, finely diced')
    expect(result.quantity).toBe(2)
    expect(result.unit).toBeUndefined()
    expect(result.ingredientName).toBe('large yellow onions')
    expect(result.preparation).toBe('finely diced')
    expect(result.originalText).toBe('2 large yellow onions, finely diced')
  })

  it('never loses the original text, even when parsing gets nothing', () => {
    const result = parseIngredient('Salt and pepper to taste')
    expect(result.originalText).toBe('Salt and pepper to taste')
    expect(result.ingredientName).not.toBe('')
  })

  it('reads units and quantities', () => {
    const result = parseIngredient('2 tbsp olive oil')
    expect(result.quantity).toBe(2)
    expect(result.unit).toBe('tbsp')
    expect(result.ingredientName).toBe('olive oil')
  })

  it('reads mixed numbers and vulgar fractions', () => {
    expect(parseIngredient('1 1/2 cups rice').quantity).toBe(1.5)
    expect(parseIngredient('1½ cups rice').quantity).toBe(1.5)
    expect(parseIngredient('½ cup rice').quantity).toBe(0.5)
    expect(parseIngredient('1/4 tsp salt').quantity).toBe(0.25)
  })

  it('reads ranges as a quantity plus a maximum', () => {
    const result = parseIngredient('2-3 cloves garlic, minced')
    expect(result.quantity).toBe(2)
    expect(result.quantityMax).toBe(3)
    expect(result.unit).toBe('clove')
    expect(result.ingredientName).toBe('garlic')
  })

  it('handles a can size in parentheses', () => {
    const result = parseIngredient('1 (14 oz) can diced tomatoes')
    expect(result.quantity).toBe(1)
    expect(result.unit).toBe('can')
    expect(result.ingredientName).toBe('diced tomatoes')
    expect(result.preparation).toContain('14 oz')
  })

  it('flags optional ingredients without mangling the name', () => {
    const result = parseIngredient('1 tbsp fish sauce (optional)')
    expect(result.optional).toBe(true)
    expect(result.ingredientName).toBe('fish sauce')
  })

  it('keeps an unquantified item whole', () => {
    const result = parseIngredient('an apple')
    expect(result.quantity).toBeUndefined()
    expect(result.ingredientName).toBe('an apple')
  })

  it('treats "a" as one when a unit follows', () => {
    const result = parseIngredient('a pinch of saffron')
    expect(result.quantity).toBe(1)
    expect(result.unit).toBe('pinch')
    expect(result.ingredientName).toBe('saffron')
  })

  it('moves a trailing method word into preparation', () => {
    const result = parseIngredient('3 carrots chopped')
    expect(result.ingredientName).toBe('carrots')
    expect(result.preparation).toBe('chopped')
  })

  it('assigns a grocery aisle', () => {
    expect(parseIngredient('1 lb chicken thighs').groceryCategory).toBe(
      'Meat & Seafood',
    )
    expect(parseIngredient('2 cups spinach').groceryCategory).toBe('Produce')
    expect(parseIngredient('1 tsp cumin').groceryCategory).toBe('Spices & Seasonings')
  })

  it("drops a blog's per-ingredient price from the name", () => {
    // Budget Bytes and friends annotate every line with what it cost them.
    const result = parseIngredient('1.5 Tbsp garam masala ($0.45)')
    expect(result.ingredientName).toBe('garam masala')
    expect(result.quantity).toBe(1.5)
    expect(result.unit).toBe('tbsp')
    // The line is still stored exactly as the recipe wrote it.
    expect(result.originalText).toBe('1.5 Tbsp garam masala ($0.45)')
  })

  it('strips list markers copied from a webpage', () => {
    const result = parseIngredient('▢ 1 lb ground beef')
    expect(result.quantity).toBe(1)
    expect(result.unit).toBe('lb')
    expect(result.ingredientName).toBe('ground beef')
  })
})

describe('parseIngredientLines', () => {
  it('creates one row per line', () => {
    const rows = parseIngredientLines(
      '1 lb chicken thighs\n1 can coconut milk\n2 tbsp curry paste\n2 cups spinach',
    )
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.ingredientName)).toEqual([
      'chicken thighs',
      'coconut milk',
      'curry paste',
      'spinach',
    ])
  })

  it('remembers section headings', () => {
    const rows = parseIngredientLines('For the sauce:\n2 tbsp soy sauce\n1 tsp honey')
    expect(rows).toHaveLength(2)
    expect(rows[0].section).toBe('For the sauce')
  })
})

describe('normalizeIngredientKey', () => {
  it('collapses the same ingredient written three ways', () => {
    expect(normalizeIngredientKey('yellow onions')).toBe('yellow onion')
    expect(normalizeIngredientKey('Yellow Onion')).toBe('yellow onion')
    expect(normalizeIngredientKey('large yellow onions')).toBe('yellow onion')
  })

  it('keeps genuinely different ingredients apart', () => {
    const keys = new Set(
      ['yellow onion', 'red onion', 'green onion'].map(normalizeIngredientKey),
    )
    expect(keys.size).toBe(3)
  })

  it('singularises only the head noun', () => {
    expect(normalizeIngredientKey('sweet potatoes')).toBe('sweet potato')
    expect(normalizeIngredientKey('chicken thighs')).toBe('chicken thigh')
  })

  it('leaves words that only look plural alone', () => {
    expect(singularize('asparagus')).toBe('asparagus')
    expect(singularize('couscous')).toBe('couscous')
  })
})

describe('displayIngredientName, pluralised', () => {
  it('pluralises the head word', () => {
    expect(displayIngredientName('yellow onion', { plural: true })).toBe('Yellow onions')
  })

  it('leaves an already-plural name alone, rather than making "eggses"', () => {
    expect(displayIngredientName('eggs', { plural: true })).toBe('Eggs')
  })

  /**
   * A real recipe wrote "green cooking bananas (plantains)", and the list
   * showed "(plantains)s". Only a word can take an s.
   */
  it('does not pluralise something that does not end in a word', () => {
    expect(displayIngredientName('green cooking bananas (plantains)', { plural: true })).toBe(
      'Green cooking bananas (plantains)',
    )
  })
})
