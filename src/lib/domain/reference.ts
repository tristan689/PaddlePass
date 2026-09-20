/**
 * Booking reference codes, e.g. `UD-7K2MX`.
 *
 * These get read aloud, retyped into Messenger, and squinted at in screenshots, so
 * the alphabet deliberately drops every character pair people confuse:
 *   0/O, 1/I/L, U/V.
 *
 * The code is an IDENTIFIER, not a credential. It is short and guessable by design;
 * anything that actually needs protecting is behind `lookup_token` instead.
 */

/** 30 unambiguous characters: digits 2-9 plus A-Z without I, L, O or U. */
export const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

export const REFERENCE_PREFIX = 'UD-'

/** Default body length. 30^5 ≈ 24.3 million -- ample for a single court. */
export const REFERENCE_LENGTH = 5

/**
 * Largest multiple of the alphabet size that fits in a byte (30 × 8 = 240).
 * Bytes at or above this are rejected rather than folded, which is what keeps the
 * distribution uniform. Naive `byte % 30` would make the first 16 characters
 * meaningfully more likely -- harmless for collisions, but it is free to do right.
 */
const REJECTION_CEILING =
  Math.floor(256 / REFERENCE_ALPHABET.length) * REFERENCE_ALPHABET.length

function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

/** A reference body of `length` characters, uniformly distributed. */
export function generateReferenceBody(length: number = REFERENCE_LENGTH): string {
  let out = ''
  while (out.length < length) {
    // Over-draw so the common case needs a single syscall despite rejections.
    for (const byte of randomBytes((length - out.length) * 2)) {
      if (byte >= REJECTION_CEILING) continue
      out += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]
      if (out.length === length) break
    }
  }
  return out
}

/** A full reference, e.g. `UD-7K2MX`. */
export function generateReference(length: number = REFERENCE_LENGTH): string {
  return REFERENCE_PREFIX + generateReferenceBody(length)
}

/**
 * Clean up whatever a customer pasted or a staffer typed into the search box.
 * Accepts `ud 7k2mx`, `UD-7K2MX`, `7k2mx` and returns the canonical `UD-7K2MX`.
 * Returns `null` when there's nothing usable, so callers can fall back to a
 * name search rather than querying for garbage.
 */
export function normalizeReference(raw: string): string | null {
  const stripped = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (stripped === '') return null

  const body = stripped.startsWith('UD') ? stripped.slice(2) : stripped
  if (body === '') return null

  return REFERENCE_PREFIX + body
}

/** Does this look like a complete, well-formed reference? */
export function isValidReference(value: string): boolean {
  if (!value.startsWith(REFERENCE_PREFIX)) return false
  const body = value.slice(REFERENCE_PREFIX.length)
  if (body.length < REFERENCE_LENGTH) return false
  return [...body].every((c) => REFERENCE_ALPHABET.includes(c))
}

/**
 * Opaque secret paired with each booking so `/r/<ref>` can show status without the
 * short code alone being enough to enumerate other people's bookings.
 */
export function generateLookupToken(): string {
  return [...randomBytes(24)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
