/**
 * The timer a step is asking for.
 *
 * Imported recipes almost never carry structured timings, but the sentence
 * says it plainly — "simmer for 20 minutes", "bake 1 hour", "rest 5-10 min".
 * Reading it out of the text is the difference between a timer button being
 * there when it is needed and the cook reaching for a different app.
 */

const PATTERN =
  /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:(?:to|-|–|—)\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?|h|minutes?|mins?|m)\b/gi

export function timerFromText(text: string | undefined): number | undefined {
  if (!text) return undefined

  let longest: number | undefined
  for (const match of text.matchAll(PATTERN)) {
    const unit = match[3].toLowerCase()
    // The upper end of "5-10 minutes": a timer that goes off early is a timer
    // somebody has to set again.
    const value = Number(match[2] ?? match[1])
    if (!Number.isFinite(value) || value <= 0) continue
    const minutes = unit.startsWith('h') ? value * 60 : value
    /*
     * Nobody needs a timer for thirty seconds of stirring. The upper end used
     * to be two hours, because a timer living in an open page could not
     * survive longer than somebody would keep it open; now that a finished
     * timer notifies and says how late it is, a roast is worth offering. A
     * slow cooker's eight hours still is not: nothing here can be trusted to
     * count that long, and a button that fails after a whole afternoon is
     * worse than no button.
     */
    if (minutes < 1 || minutes > 240) continue
    if (longest == null || minutes > longest) longest = minutes
  }
  return longest == null ? undefined : Math.round(longest)
}
