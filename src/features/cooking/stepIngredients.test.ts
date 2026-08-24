import { describe, expect, it } from 'vitest'
import { ingredientsForStep } from './stepIngredients'
import { displayIngredientSections } from '@/features/recipes/ingredientDisplay'
import { ingredientsFrom } from '@/test/factories'

function items(lines: string[]) {
  return displayIngredientSections(ingredientsFrom(lines)).flatMap((section) => section.items)
}

describe('ingredientsForStep', () => {
  const chili = items([
    '2 lbs ground beef',
    '1 large yellow onion, diced',
    '1 red bell pepper, diced',
    '4 cloves garlic, minced',
    '3 tbsp chili powder',
    '1 tsp black pepper',
    '2 cans kidney beans, drained',
  ])

  it('finds what a step is actually talking about', () => {
    const found = ingredientsForStep(
      'Set the Instant Pot to sauté and brown the beef with the onion and pepper, about 8 minutes.',
      chili,
    )
    const names = found.map((item) => item.name)
    expect(names).toContain('ground beef')
    expect(names).toContain('large yellow onion')
    // Two peppers, both offered: guessing between them would be worse.
    expect(names).toContain('red bell pepper')
    expect(names).toContain('black pepper')
    expect(names).not.toContain('kidney beans')
  })

  it('prefers the ingredient a step names outright', () => {
    const found = ingredientsForStep('Stir in the garlic and chili powder.', chili)
    const names = found.map((item) => item.name)
    expect(names).toContain('chili powder')
    expect(names).toContain('garlic')
    // "powder" was named exactly, so the loose match on it is not repeated.
    expect(names).toHaveLength(2)
  })

  it("keeps the recipe's own order", () => {
    const found = ingredientsForStep('Add the beans and the onion.', chili)
    expect(found.map((item) => item.name)).toEqual(['large yellow onion', 'kidney beans'])
  })

  it('does not match a word inside another word', () => {
    const oil = items(['2 tbsp olive oil', '1 cup peas'])
    expect(ingredientsForStep('Bring to the boil, then add peanuts.', oil)).toEqual([])
  })

  it('says nothing when the step names nothing', () => {
    expect(ingredientsForStep('Serve hot.', chili)).toEqual([])
  })
})
