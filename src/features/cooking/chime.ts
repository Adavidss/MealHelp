/**
 * The timer alert.
 *
 * iPhone is the device this app is used on, and iOS has no `navigator.vibrate`
 * — so on the primary platform a finished timer would just quietly change
 * colour while you are looking at the stove. This plays a short two-note chime
 * instead, synthesised rather than loaded, so it costs nothing and works with
 * no network.
 *
 * iOS also refuses to start audio outside a user gesture. The context is
 * therefore created and unlocked when a timer is *started* (a tap), which is
 * what earns the right to make a sound when it later finishes.
 */

let context: AudioContext | undefined

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

function getContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  if (context) return context
  const Ctor =
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
  if (!Ctor) return undefined
  try {
    context = new Ctor()
    return context
  } catch {
    return undefined
  }
}

/** Call from the tap that starts a timer, so the chime is allowed to play later. */
export function primeChime(): void {
  const ctx = getContext()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency

  // A soft attack and a long tail: a kitchen timer, not a system error.
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.28, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.05)
}

export function playChime(): void {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime
  // Two notes a fifth apart, twice — audible over an extractor fan without
  // being the sort of alarm that makes everyone jump.
  tone(ctx, 880, now, 0.35)
  tone(ctx, 1318.5, now + 0.18, 0.4)
  tone(ctx, 880, now + 0.6, 0.35)
  tone(ctx, 1318.5, now + 0.78, 0.45)
}

/** Vibration where it exists; harmless and ignored on iOS. */
export function buzz(): void {
  navigator.vibrate?.([200, 100, 200])
}
