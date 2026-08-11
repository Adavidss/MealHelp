import { useSyncExternalStore } from 'react'
import type { Recipe } from '@/models'

/**
 * Which recipes actually have a picture.
 *
 * Having a URL is not the same as having a photograph. Imported recipes point
 * at somebody else's server, and those links rot: the image 404s, the site
 * starts blocking hotlinks, or the CDN moves. Mealie handles this by listening
 * for the image's own error event rather than trusting the URL, which is the
 * only way to actually know, and this does the same.
 *
 * Failures are remembered for the session so a recipe does not flicker between
 * the photo section and the artwork section as its tile scrolls in and out.
 */
const broken = new Set<string>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  for (const listener of listeners) listener()
}

export function markImageBroken(url: string): void {
  if (!url || broken.has(url)) return
  broken.add(url)
  emit()
}

export function isImageBroken(url: string | undefined): boolean {
  return Boolean(url && broken.has(url))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Subscribes to discoveries about broken images and returns a number that
 * changes each time one is found.
 *
 * It returns a *value* rather than a checking function on purpose: a callback
 * would keep the same identity forever, so anything memoised against it would
 * never recompute — which is precisely how a recipe with a dead link stayed
 * sitting in the photo section while its own tile had already given up on it.
 */
export function useBrokenImageVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
}

/** True when this recipe has a picture that is known to work. */
export function hasWorkingPhoto(recipe: Recipe): boolean {
  return Boolean(recipe.image) && !isImageBroken(recipe.image)
}

export interface PhotoPartition {
  withPhotos: Recipe[]
  withoutPhotos: Recipe[]
}

/**
 * Splits a list into the ones that can be browsed by eye and the ones that
 * cannot. Order within each group is preserved, so the chosen sort still holds.
 */
export function partitionByPhoto(recipes: Recipe[]): PhotoPartition {
  const withPhotos: Recipe[] = []
  const withoutPhotos: Recipe[] = []
  for (const recipe of recipes) {
    if (hasWorkingPhoto(recipe)) withPhotos.push(recipe)
    else withoutPhotos.push(recipe)
  }
  return { withPhotos, withoutPhotos }
}

/** Test seam: forget everything learned about broken images. */
export function resetBrokenImages(): void {
  broken.clear()
  emit()
}
