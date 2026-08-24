import { describe, expect, it } from 'vitest'
import { timerFromText } from './stepTimer'

describe('timerFromText', () => {
  it('reads the timing out of an ordinary direction', () => {
    expect(timerFromText('Simmer for 20 minutes, stirring occasionally.')).toBe(20)
    expect(timerFromText('Bake 1 hour until golden.')).toBe(60)
    expect(timerFromText('Rest 5 min before slicing.')).toBe(5)
  })

  /** A timer that goes off early is a timer somebody has to set again. */
  it('takes the longer end of a range', () => {
    expect(timerFromText('Cook for 8-10 minutes.')).toBe(10)
    expect(timerFromText('Roast 25 to 30 minutes.')).toBe(30)
  })

  it('takes the longest timing in a step with more than one', () => {
    expect(timerFromText('Sauté 2 minutes, then simmer 30 minutes.')).toBe(30)
  })

  it('leaves alone what a kitchen timer should not be counting', () => {
    // Nothing to time.
    expect(timerFromText('Season to taste and serve.')).toBeUndefined()
    // A roast is worth a timer now that a finished one can notify.
    expect(timerFromText('Roast for 3 hours.')).toBe(180)
    // Eight hours in a slow cooker still is not a phone's job.
    expect(timerFromText('Cook on low for 8 hours.')).toBeUndefined()
    // "30 seconds of stirring" is not worth a timer, and is not minutes either.
    expect(timerFromText('Stir for 30 seconds.')).toBeUndefined()
  })

  it('does not mistake a quantity for a timing', () => {
    expect(timerFromText('Add 2 cups of stock.')).toBeUndefined()
  })
})
