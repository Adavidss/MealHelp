import { liveQuery } from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from './database'
import { addPlannedMeal, getOrCreatePlan, getPlanByWeek, listPlannedMeals } from './plans'

afterEach(async () => {
  await db.mealPlans.clear()
  await db.plannedMeals.clear()
})

/** Resolves with the first value the live query emits, or its error. */
function firstValue<T>(querier: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const subscription = liveQuery(querier).subscribe({
      next: (value) => {
        subscription.unsubscribe()
        resolve(value as T)
      },
      error: (error) => {
        subscription.unsubscribe()
        reject(error)
      },
    })
  })
}

describe('reading a week', () => {
  /**
   * The planner reads the week through a live query. Dexie forbids writes in
   * that context, so a read that quietly created the missing plan row threw a
   * ReadOnlyError and took the whole app down with it — a blank screen with no
   * navigation, every time someone opened a week they had not planned yet.
   */
  it('can be observed live for a week that has never been planned', async () => {
    await expect(firstValue(() => getPlanByWeek('2026-12-07'))).resolves.toBeUndefined()
  })

  it('does not create anything just by being looked at', async () => {
    await firstValue(() => getPlanByWeek('2026-12-07'))
    expect(await db.mealPlans.count()).toBe(0)
  })

  /**
   * The rule this pins down: anything a screen observes has to be read-only.
   * If a future change makes the planner observe `getOrCreatePlan` again, this
   * is the failure that explains why it cannot.
   */
  it('rejects a querier that writes, which is why the read path must not', async () => {
    await expect(firstValue(() => getOrCreatePlan('2026-12-21'))).rejects.toThrow(
      /Readwrite transaction in liveQuery/i,
    )
  })

  it('still observes a week that does exist', async () => {
    const plan = await getOrCreatePlan('2026-12-14')
    const observed = await firstValue(() => getPlanByWeek('2026-12-14'))
    expect(observed?.id).toBe(plan.id)
  })
})

describe('getOrCreatePlan', () => {
  it('creates the week the first time and reuses it after', async () => {
    const first = await getOrCreatePlan('2027-01-04')
    const second = await getOrCreatePlan('2027-01-04')
    expect(second.id).toBe(first.id)
    expect(await db.mealPlans.count()).toBe(1)
  })

  it('is what actually brings a week into existence, when a meal is added', async () => {
    expect(await getPlanByWeek('2027-01-11')).toBeUndefined()

    const plan = await getOrCreatePlan('2027-01-11')
    await addPlannedMeal({
      planId: plan.id,
      date: '2027-01-11',
      mealType: 'dinner',
      kind: 'custom',
      customName: 'Sandwiches',
    })

    expect(await getPlanByWeek('2027-01-11')).toBeDefined()
    expect(await listPlannedMeals(plan.id)).toHaveLength(1)
  })
})
