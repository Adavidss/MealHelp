import { describe, expect, it } from 'vitest'
import {
  BROWSE_SECTIONS,
  buildBrowseSections,
  sectionLabels,
  sectionTotal,
} from './browseSections'
import { CHARACTERISTICS } from './characteristics'
import { makeRecipe } from '@/test/factories'

const CROCK_POT_EASY = makeRecipe({
  id: 'pulled-pork',
  title: 'Slow Cooker Pulled Pork',
  cookingMethods: ['slow-cooker'],
  activeTimeMinutes: 15,
  cookTimeMinutes: 480,
})

const CROCK_POT_FIDDLY = makeRecipe({
  id: 'fussy-stew',
  title: 'Elaborate Slow Cooker Stew',
  cookingMethods: ['slow-cooker'],
  activeTimeMinutes: 75,
  cookTimeMinutes: 480,
})

const INSTANT_POT_EASY = makeRecipe({
  id: 'lentil-soup',
  title: 'Instant Pot Lentil Soup',
  cookingMethods: ['instant-pot'],
  activeTimeMinutes: 15,
})

const ONE_POT = makeRecipe({
  id: 'sausage-pasta',
  title: 'One Pot Creamy Sausage Pasta',
  cookingMethods: ['one-pot', 'stovetop'],
  activeTimeMinutes: 25,
})

const UNRELATED = makeRecipe({
  id: 'roast',
  title: 'Sunday Roast',
  cookingMethods: ['oven'],
  activeTimeMinutes: 90,
})

const LIBRARY = [CROCK_POT_EASY, CROCK_POT_FIDDLY, INSTANT_POT_EASY, ONE_POT, UNRELATED]

describe('buildBrowseSections', () => {
  it('puts the easy slow cooker meals on their own shelf', () => {
    const shelf = buildBrowseSections(LIBRARY).find((s) => s.id === 'easy-crock-pot')
    expect(shelf?.recipes.map((r) => r.id)).toEqual(['pulled-pork'])
  })

  /** "Easy" is doing real work here — a slow cooker recipe can still be a chore. */
  it('leaves a fiddly slow cooker recipe off the easy shelf', () => {
    const shelf = buildBrowseSections(LIBRARY).find((s) => s.id === 'easy-crock-pot')
    expect(shelf?.recipes.map((r) => r.id)).not.toContain('fussy-stew')
  })

  it('has a shelf each for Instant Pot and one pot', () => {
    const shelves = buildBrowseSections(LIBRARY)
    expect(shelves.find((s) => s.id === 'easy-instant-pot')?.recipes.map((r) => r.id)).toEqual([
      'lentil-soup',
    ])
    expect(shelves.find((s) => s.id === 'one-pot')?.recipes.map((r) => r.id)).toEqual([
      'sausage-pasta',
    ])
  })

  it('leaves out anything that belongs on no shelf', () => {
    const onShelves = buildBrowseSections(LIBRARY).flatMap((s) =>
      s.recipes.map((r) => r.id),
    )
    expect(onShelves).not.toContain('roast')
  })

  it('hides a shelf with nothing on it rather than showing an empty row', () => {
    const shelves = buildBrowseSections([UNRELATED])
    expect(shelves).toEqual([])
  })

  /**
   * A one-pot Instant Pot stew genuinely belongs on both shelves. Hiding it
   * from one to avoid the repeat would make that shelf lie about its contents.
   */
  it('lets a recipe appear on every shelf it truly belongs to', () => {
    const both = makeRecipe({
      id: 'both',
      title: 'Instant Pot One Pot Chili',
      cookingMethods: ['instant-pot', 'one-pot'],
      activeTimeMinutes: 15,
    })
    const shelves = buildBrowseSections([both])

    expect(shelves.map((s) => s.id).sort()).toEqual(['easy-instant-pot', 'one-pot'])
  })

  it('shows a sample rather than the whole shelf', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makeRecipe({
        id: `one-pot-${i}`,
        title: `One Pot Number ${i}`,
        cookingMethods: ['one-pot'],
        activeTimeMinutes: 20,
      }),
    )
    const shelf = buildBrowseSections(many, { limit: 12 })[0]

    expect(shelf.recipes).toHaveLength(12)
    // …while "See all" still knows the real number.
    expect(sectionTotal(many, shelf)).toBe(20)
  })
})

describe('the shelf definitions', () => {
  it('are built only from characteristics that exist', () => {
    const known = new Set(CHARACTERISTICS.map((entry) => entry.id))
    for (const section of BROWSE_SECTIONS) {
      for (const id of section.characteristics) {
        expect(known, `${section.id} refers to "${id}"`).toContain(id)
      }
    }
  })

  it('can describe themselves in the same words as the filters', () => {
    const crockPot = BROWSE_SECTIONS.find((s) => s.id === 'easy-crock-pot')!
    expect(sectionLabels(crockPot)).toEqual(['Crock-Pot', 'Simple'])
  })

  it('have no duplicate ids, since See all is keyed on them', () => {
    const ids = BROWSE_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
