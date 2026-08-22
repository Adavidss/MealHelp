import { describe, expect, it } from 'vitest'
import { leftoverGraph } from './leftoverLinks'
import { makePlannedMeal } from '@/test/factories'

describe('leftoverGraph', () => {
  it('points a leftover night at the night that cooked it', () => {
    const monday = makePlannedMeal({ id: 'mon', date: '2026-08-10', kind: 'recipe', recipeId: 'chili' })
    const tuesday = makePlannedMeal({ id: 'tue', date: '2026-08-11', kind: 'leftover', recipeId: 'chili' })

    const graph = leftoverGraph([tuesday, monday])

    expect(graph.sourceOf.get('tue')).toEqual({ sourceId: 'mon', sourceDate: '2026-08-10' })
    expect(graph.feeds.get('mon')).toEqual(['2026-08-11'])
  })

  it('eats from the most recent cooking of it, not the first one that week', () => {
    const meals = [
      makePlannedMeal({ id: 'mon', date: '2026-08-10', kind: 'recipe', recipeId: 'chili' }),
      makePlannedMeal({ id: 'wed', date: '2026-08-12', kind: 'recipe', recipeId: 'chili' }),
      makePlannedMeal({ id: 'thu', date: '2026-08-13', kind: 'leftover', recipeId: 'chili' }),
    ]
    expect(leftoverGraph(meals).sourceOf.get('thu')?.sourceId).toBe('wed')
  })

  it('never has a leftover night eat from a later one', () => {
    const meals = [
      makePlannedMeal({ id: 'tue', date: '2026-08-11', kind: 'leftover', recipeId: 'chili' }),
      makePlannedMeal({ id: 'wed', date: '2026-08-12', kind: 'recipe', recipeId: 'chili' }),
    ]
    expect(leftoverGraph(meals).sourceOf.has('tue')).toBe(false)
  })

  it('honours a link the planner wrote down, whatever the dates suggest', () => {
    const meals = [
      makePlannedMeal({ id: 'mon', date: '2026-08-10', kind: 'recipe', recipeId: 'chili' }),
      makePlannedMeal({ id: 'tue', date: '2026-08-11', kind: 'recipe', recipeId: 'chili' }),
      makePlannedMeal({
        id: 'fri',
        date: '2026-08-14',
        kind: 'leftover',
        recipeId: 'chili',
        sourcePlannedMealId: 'mon',
      }),
    ]
    expect(leftoverGraph(meals).sourceOf.get('fri')?.sourceId).toBe('mon')
  })

  it('counts every night one cooking session feeds', () => {
    const meals = [
      makePlannedMeal({ id: 'mon', date: '2026-08-10', kind: 'recipe', recipeId: 'pork' }),
      makePlannedMeal({ id: 'tue', date: '2026-08-11', kind: 'leftover', recipeId: 'pork' }),
      makePlannedMeal({ id: 'wed', date: '2026-08-12', kind: 'leftover', recipeId: 'pork' }),
    ]
    expect(leftoverGraph(meals).feeds.get('mon')).toEqual(['2026-08-11', '2026-08-12'])
  })

  it('says nothing rather than pointing at a source that is gone', () => {
    const orphan = makePlannedMeal({ id: 'tue', date: '2026-08-11', kind: 'leftover', recipeId: 'chili' })
    expect(leftoverGraph([orphan]).sourceOf.size).toBe(0)
  })
})
