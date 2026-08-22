import type { Nutrition } from '@/models'

/**
 * Nutrition for the recipes MealHelp ships with, per serving.
 *
 * Estimates, not label values: produced by running the app's own
 * `estimateNutrition` over each recipe's ingredients, and carried here so the
 * nutrition page is useful on the first week rather than after twelve trips
 * to twelve recipe pages. They are stored with `nutritionSource: 'estimate'`,
 * which is what makes every screen that shows them say "estimated from the
 * ingredients" — and re-estimating or typing over them works exactly as it
 * does for any other recipe.
 *
 * Regenerate by opening the app and running `estimateNutrition` over
 * `starterRecipeDrafts()`; three foods were added to the nutrition table while
 * doing so, because a whole chicken was being counted as one breast and cooked
 * rice as dry.
 */
export const STARTER_NUTRITION: Record<string, Nutrition> = {
  'chicken-curry': { calories: 441, protein: 32, carbs: 9.6, fat: 31.2, fiber: 1, sugar: 1.5, sodium: 786 },
  'beef-chili': { calories: 489, protein: 38.3, carbs: 31.1, fat: 23.7, fiber: 9, sugar: 0.8, sodium: 893 },
  'sheet-pan-chicken': { calories: 370, protein: 23.9, carbs: 26.2, fat: 19, fiber: 4, sugar: 2.7, sodium: 388 },
  'grilled-cheese-tomato-soup': { calories: 738, protein: 24.1, carbs: 50.2, fat: 50.5, fiber: 5.9, sugar: 2.2, sodium: 2015 },
  'sausage-pasta': { calories: 927, protein: 37.5, carbs: 79.9, fat: 51.4, fiber: 5.4, sugar: 1.2, sodium: 1855 },
  'pulled-pork': { calories: 455, protein: 32.9, carbs: 4.9, fat: 32.7, fiber: 0.4, sugar: 3.8, sodium: 698 },
  'fried-rice': { calories: 389, protein: 10.9, carbs: 53.1, fat: 14.3, fiber: 2.2, sugar: 3, sodium: 657 },
  'lentil-soup': { calories: 250, protein: 15.7, carbs: 39.2, fat: 4.6, fiber: 7.4, sugar: 1.7, sodium: 1196 },
  'quesadilla': { calories: 770, protein: 30.6, carbs: 76.4, fat: 38.7, fiber: 11, sodium: 1195 },
  'roast-chicken-potatoes': { calories: 862, protein: 78.9, carbs: 27.1, fat: 48.6, fiber: 3.3, sodium: 821 },
  'turkey-meatballs': { calories: 272, protein: 27.4, carbs: 10.8, fat: 12.8, fiber: 0.1, sodium: 483 },
  'overnight-oats': { calories: 339, protein: 14, carbs: 47.4, fat: 10.9, fiber: 5.9, sugar: 15 },
}
