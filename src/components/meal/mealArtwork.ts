import type { CookingMethod, Recipe } from '@/models'
import { TILE_PALETTES, tilePalette } from '@/features/recipes/characteristics'
import { isImageBroken } from '@/features/recipes/photoAvailability'

/**
 * What to draw where the photograph goes.
 *
 * Two facts drive everything here. Most recipes people type in have no
 * picture at all, and an imported recipe's picture lives on somebody else's
 * server and rots. A card that shows an empty frame in either case is not a
 * card you can browse, so a recipe without a usable photograph gets generated
 * artwork instead — the same warm colour every time, drawn from its title.
 */

export type MealArtKind = 'photo' | 'generated'

export interface MealArt {
  kind: MealArtKind
  /** Only for kind: 'photo'. */
  src?: string
  /** 0…TILE_PALETTES-1, deterministic per title. */
  palette: number
  method?: CookingMethod
}

export function mealArt(recipe: Pick<Recipe, 'title' | 'image' | 'cookingMethods'>): MealArt {
  const usable = Boolean(recipe.image) && !isImageBroken(recipe.image)
  return {
    kind: usable ? 'photo' : 'generated',
    src: usable ? recipe.image : undefined,
    palette: tilePalette(recipe),
    method: recipe.cookingMethods?.[0],
  }
}

export { TILE_PALETTES }
