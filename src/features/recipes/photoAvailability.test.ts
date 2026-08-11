import { afterEach, describe, expect, it } from 'vitest'
import {
  hasWorkingPhoto,
  isImageBroken,
  markImageBroken,
  partitionByPhoto,
  resetBrokenImages,
} from './photoAvailability'
import { makeRecipe } from '@/test/factories'

afterEach(() => {
  resetBrokenImages()
})

const WITH_PHOTO = makeRecipe({
  id: 'photo',
  title: 'Brown Stew Chicken',
  image: 'https://example.com/stew.jpg',
})
const NO_PHOTO = makeRecipe({ id: 'none', title: 'Overnight Oats' })

describe('partitionByPhoto', () => {
  it('separates the ones you can browse by eye from the ones you cannot', () => {
    const { withPhotos, withoutPhotos } = partitionByPhoto([WITH_PHOTO, NO_PHOTO])

    expect(withPhotos.map((r) => r.id)).toEqual(['photo'])
    expect(withoutPhotos.map((r) => r.id)).toEqual(['none'])
  })

  it('keeps the order it was given, so the chosen sort still holds', () => {
    const second = makeRecipe({ id: 'photo2', image: 'https://example.com/2.jpg' })
    const { withPhotos } = partitionByPhoto([WITH_PHOTO, NO_PHOTO, second])
    expect(withPhotos.map((r) => r.id)).toEqual(['photo', 'photo2'])
  })

  it('treats an empty image field as no photo', () => {
    const blank = makeRecipe({ id: 'blank', image: '' })
    expect(partitionByPhoto([blank]).withoutPhotos).toHaveLength(1)
  })

  /**
   * The reason this exists at all. Imported recipes point at somebody else's
   * server, and those links rot — a URL is not proof of a picture. Mealie
   * listens for the image's own error event; so does this.
   */
  it('moves a recipe whose link has rotted out of the picture wall', () => {
    expect(partitionByPhoto([WITH_PHOTO]).withPhotos).toHaveLength(1)

    markImageBroken('https://example.com/stew.jpg')

    const { withPhotos, withoutPhotos } = partitionByPhoto([WITH_PHOTO])
    expect(withPhotos).toHaveLength(0)
    expect(withoutPhotos.map((r) => r.id)).toEqual(['photo'])
  })

  it('only blames the image that actually failed', () => {
    const other = makeRecipe({ id: 'other', image: 'https://example.com/other.jpg' })
    markImageBroken('https://example.com/stew.jpg')

    const { withPhotos } = partitionByPhoto([WITH_PHOTO, other])
    expect(withPhotos.map((r) => r.id)).toEqual(['other'])
  })

  it('remembers a failure, so a tile does not flicker as it scrolls', () => {
    markImageBroken('https://example.com/stew.jpg')
    expect(isImageBroken('https://example.com/stew.jpg')).toBe(true)
    expect(hasWorkingPhoto(WITH_PHOTO)).toBe(false)
  })

  it('ignores an empty url being reported as broken', () => {
    markImageBroken('')
    expect(isImageBroken('')).toBe(false)
  })
})
