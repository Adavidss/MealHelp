import type { SyncSnapshot } from '@/models'

/**
 * The household code, and why the Worker never sees your kitchen.
 *
 * Everything a household shares — recipes, plans, what is in the cupboard —
 * passes through a Worker that anybody could be running. So it goes through
 * encrypted, and the code that unlocks it never leaves the two phones:
 *
 *   code      the shared secret, the thing you text your partner
 *   id        SHA-256 of the code — what the Worker stores the blob under
 *   key       a different derivation of the same code — what unlocks the blob
 *
 * The Worker only ever learns the id, and an id cannot be turned back into a
 * code, so the most it can hold is a bag of bytes it cannot open.
 */

/** No i, l, o, 0 or 1: this gets read aloud and typed in by hand. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const CODE_LENGTH = 16
const GROUP = 4

/** ~79 bits, which is far past guessing, and still four short groups to type. */
export function newHouseholdCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  const chars = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length])
  const groups: string[] = []
  for (let at = 0; at < chars.length; at += GROUP) {
    groups.push(chars.slice(at, at + GROUP).join(''))
  }
  return groups.join('-')
}

/** Typed in with spaces, in capitals, or with the dashes left out: all the same code. */
export function normalizeCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function formatCode(code: string): string {
  const bare = normalizeCode(code)
  const groups: string[] = []
  for (let at = 0; at < bare.length; at += GROUP) groups.push(bare.slice(at, at + GROUP))
  return groups.join('-')
}

export function isPlausibleCode(code: string): boolean {
  return normalizeCode(code).length >= 8
}

function encoded(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text)
}

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', encoded(text))
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * What the Worker files the household under. Domain-separated from the key so
 * that knowing the id tells you nothing at all about how to open the blob.
 */
export async function householdId(code: string): Promise<string> {
  return toHex(await sha256(`mealhelp-household-id:${normalizeCode(code)}`))
}

async function householdKey(code: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoded(normalizeCode(code)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      // The code itself is the entropy, so the salt only separates this use
      // of it from the id above.
      salt: encoded('mealhelp-household-key-v1'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/** What actually sits in the Worker's store. */
export interface SealedSnapshot {
  v: 1
  iv: string
  data: string
}

export async function sealSnapshot(code: string, snapshot: SyncSnapshot): Promise<SealedSnapshot> {
  const key = await householdKey(code)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded(JSON.stringify(snapshot)),
  )
  return { v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(sealed)) }
}

/**
 * Throws if the code is wrong — AES-GCM will not hand back bytes it cannot
 * authenticate, which is exactly the check "is this the right code" needs.
 */
export async function openSnapshot(code: string, sealed: SealedSnapshot): Promise<SyncSnapshot> {
  const key = await householdKey(code)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv) },
    key,
    fromBase64(sealed.data),
  )
  return JSON.parse(new TextDecoder().decode(plain)) as SyncSnapshot
}
