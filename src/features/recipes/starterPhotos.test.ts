import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STARTER_PHOTOS, starterPhotoUrl } from './starterPhotos'
import { starterRecipeDrafts } from './starterRecipes'

/**
 * Three things have to stay in step: the files on disk, the recipes that
 * point at them, and the credits that say who took them. A photograph with
 * no credit is a licence breach, and a recipe pointing at a file that is not
 * there is a card that silently falls back to generated artwork — both are
 * quiet failures, so they are checked rather than remembered.
 */
describe('starter photographs', () => {
  const files = readdirSync('public/starters').filter((name) => name.endsWith('.webp'))
  const slugs = files.map((name) => name.replace(/\.webp$/, ''))

  it('gives every starter recipe a photograph that exists', () => {
    const drafts = starterRecipeDrafts()
    expect(drafts.length).toBeGreaterThan(0)
    for (const draft of drafts) {
      expect(draft.image, `${draft.title} has no photograph`).toBeTruthy()
      const slug = (draft.image as string).replace(/^.*\/starters\//, '').replace(/\.webp$/, '')
      expect(slugs, `${draft.title} points at a missing file`).toContain(slug)
    }
  })

  it('credits every photograph it ships, and ships every photograph it credits', () => {
    expect([...STARTER_PHOTOS.map((photo) => photo.slug)].sort()).toEqual([...slugs].sort())
  })

  it('names an author, a licence and where the licence says so', () => {
    for (const photo of STARTER_PHOTOS) {
      expect(photo.author.length, photo.slug).toBeGreaterThan(2)
      expect(photo.license, photo.slug).toMatch(/^CC/)
      expect(photo.licenseUrl, photo.slug).toMatch(/^https:\/\/creativecommons\.org\//)
      expect(photo.sourceUrl, photo.slug).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
    }
  })

  /**
   * The URL is stored on the recipe and rendered from whatever route is open,
   * so it has to be absolute — a relative one resolves differently on
   * /recipes than on /recipes/abc123.
   */
  it('builds an absolute path under the app base', () => {
    // Under vitest the base is "/"; the built app serves from "/MealHelp/".
    // What matters either way is that it starts at the root.
    const url = starterPhotoUrl('chicken-curry')
    expect(url.startsWith('/')).toBe(true)
    expect(url.endsWith('/starters/chicken-curry.webp')).toBe(true)
  })
})
