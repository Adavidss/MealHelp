import { describe, expect, it } from 'vitest'
import { resultTags } from './resultTags'
import { previewImageFromHtml } from './preview'
import { SURPRISE_IDEAS, surpriseIdeaItems } from './surpriseIdeas'

describe('resultTags', () => {
  it('reads the appliance out of the title the page gave itself', () => {
    expect(resultTags({ title: 'Slow Cooker Beef Stew' }).map((t) => t.label)).toContain('Crock-Pot')
    expect(resultTags({ title: 'One-Pan Balsamic Chicken' }).map((t) => t.label)).toContain('One pan')
    expect(resultTags({ title: 'Easy Air Fryer Salmon' }).map((t) => t.label)).toContain('Air fryer')
  })

  it('leads with a time when the page claims one', () => {
    expect(resultTags({ title: '30-Minute Chicken Tacos' })[0]).toMatchObject({ label: '30 min' })
  })

  /**
   * A tag is a claim the page made about itself. Inventing one would be
   * MealHelp putting words in a stranger's mouth.
   */
  it('says nothing about a title that says nothing', () => {
    expect(resultTags({ title: 'Chicken Tikka Masala' })).toEqual([])
  })

  it('ignores a duration that is a step rather than the recipe', () => {
    // "Bake for 5 minutes" is not a five-minute dinner, and three hours is
    // not a selling point either.
    expect(resultTags({ title: 'Stew', snippet: 'Simmer for 5 minutes.' })).toEqual([])
    expect(resultTags({ title: 'Brisket', snippet: 'Cook for 240 minutes.' })).toEqual([])
  })

  it('shows at most a few, most telling first', () => {
    const tags = resultTags({
      title: '30-Minute One-Pan Vegan Freezer-Friendly Budget Dinner',
    })
    expect(tags).toHaveLength(3)
    expect(tags[0].label).toBe('30 min')
  })
})

describe('previewImageFromHtml', () => {
  it('reads the picture a page publishes for people who link to it', () => {
    const html = `<html><head><meta property="og:image" content="/img/stew.jpg"></head></html>`
    expect(previewImageFromHtml(html, 'https://example.com/recipes/stew')).toBe(
      'https://example.com/img/stew.jpg',
    )
  })

  it('falls back to the Twitter card, and gives up quietly', () => {
    const twitter = `<meta name="twitter:image" content="https://cdn.example.com/a.jpg">`
    expect(previewImageFromHtml(twitter, 'https://example.com/')).toBe('https://cdn.example.com/a.jpg')
    expect(previewImageFromHtml('<html><body>no picture</body></html>', 'https://example.com/')).toBeUndefined()
  })
})

describe('surprise ideas', () => {
  it('offers real dinners, not curiosities', () => {
    expect(SURPRISE_IDEAS.length).toBeGreaterThan(20)
    for (const idea of SURPRISE_IDEAS) {
      // Two or three words: a search engine finds dishes, not sentences.
      expect(idea.split(' ').length).toBeLessThanOrEqual(5)
      expect(idea).toBe(idea.toLowerCase())
    }
  })

  it('has no duplicates, which would make a roll feel rigged', () => {
    expect(new Set(SURPRISE_IDEAS).size).toBe(SURPRISE_IDEAS.length)
  })

  it('hands the picker something it can identify', () => {
    expect(surpriseIdeaItems()[0]).toEqual({ id: SURPRISE_IDEAS[0] })
  })
})
