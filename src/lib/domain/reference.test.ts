import { describe, expect, it } from 'vitest'
import {
  generateLookupToken,
  generateReference,
  generateReferenceBody,
  isValidReference,
  normalizeReference,
  REFERENCE_ALPHABET,
  REFERENCE_LENGTH,
} from './reference'

describe('the alphabet', () => {
  it('excludes every character pair people confuse when reading aloud', () => {
    // These codes get dictated over Messenger and squinted at in screenshots.
    for (const ambiguous of ['0', '1', 'I', 'L', 'O', 'U']) {
      expect(REFERENCE_ALPHABET).not.toContain(ambiguous)
    }
  })

  it('has no duplicate characters', () => {
    expect(new Set(REFERENCE_ALPHABET).size).toBe(REFERENCE_ALPHABET.length)
  })
})

describe('generateReference', () => {
  it('produces a prefixed code of the expected shape', () => {
    const ref = generateReference()
    expect(ref).toMatch(/^UD-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/)
    expect(ref).toHaveLength(3 + REFERENCE_LENGTH)
  })

  it('only ever emits characters from the alphabet', () => {
    for (let i = 0; i < 200; i++) {
      for (const char of generateReferenceBody()) {
        expect(REFERENCE_ALPHABET).toContain(char)
      }
    }
  })

  it('honours a widened length, used to escape collisions', () => {
    expect(generateReferenceBody(6)).toHaveLength(6)
    expect(generateReferenceBody(8)).toHaveLength(8)
  })

  it('collides only at roughly the birthday rate, which is why the DB retries', () => {
    // 2000 draws from 30^5 (24.3M) carries a ~8% chance of at least one collision,
    // so asserting perfect uniqueness here would fail about one run in twelve. That
    // expected rate is exactly why uniqueness is owned by the unique index on
    // bookings.reference_code and the retry loop in assign_booking_identifiers(),
    // not by this function.
    const draws = 2000
    const seen = new Set(Array.from({ length: draws }, () => generateReference()))
    expect(seen.size).toBeGreaterThan(draws * 0.99)
  })

  it('is effectively collision-free once widened, the escape hatch for a crowded space', () => {
    // 30^8 is 656 billion; a collision across 2000 draws is about 3e-6.
    const seen = new Set(Array.from({ length: 2000 }, () => generateReferenceBody(8)))
    expect(seen.size).toBe(2000)
  })

  it('spreads across the whole alphabet rather than favouring the low end', () => {
    // Rejection sampling exists to prevent modulo bias. If someone replaces it with
    // `byte % 30`, the first 16 characters get ~2x the weight and this fails.
    const counts = new Map<string, number>()
    for (const char of generateReferenceBody(20000)) {
      counts.set(char, (counts.get(char) ?? 0) + 1)
    }

    expect(counts.size).toBe(REFERENCE_ALPHABET.length)

    const expected = 20000 / REFERENCE_ALPHABET.length
    for (const count of counts.values()) {
      // Generous band — this is a smoke test for bias, not a statistics exam.
      expect(count).toBeGreaterThan(expected * 0.7)
      expect(count).toBeLessThan(expected * 1.3)
    }
  })
})

describe('normalizeReference — the admin search box', () => {
  it('canonicalises whatever a staffer types or pastes', () => {
    expect(normalizeReference('UD-7K2MX')).toBe('UD-7K2MX')
    expect(normalizeReference('ud-7k2mx')).toBe('UD-7K2MX')
    expect(normalizeReference('ud 7k2mx')).toBe('UD-7K2MX')
    expect(normalizeReference('7K2MX')).toBe('UD-7K2MX') // bare body
    expect(normalizeReference('  UD7K2MX  ')).toBe('UD-7K2MX')
  })

  it('returns null when there is nothing to search on', () => {
    // Lets the caller fall back to a name search instead of querying garbage.
    expect(normalizeReference('')).toBeNull()
    expect(normalizeReference('   ')).toBeNull()
    expect(normalizeReference('---')).toBeNull()
    expect(normalizeReference('UD')).toBeNull()
  })
})

describe('isValidReference', () => {
  it('accepts a well-formed code', () => {
    expect(isValidReference('UD-7K2MX')).toBe(true)
  })

  it('rejects a missing prefix, a short body, or out-of-alphabet characters', () => {
    expect(isValidReference('7K2MX')).toBe(false)
    expect(isValidReference('UD-7K2')).toBe(false)
    expect(isValidReference('UD-7K2M0')).toBe(false) // 0 is not in the alphabet
    expect(isValidReference('UD-7K2MI')).toBe(false) // nor is I
  })
})

describe('generateLookupToken', () => {
  it('is long enough not to be guessable', () => {
    expect(generateLookupToken()).toMatch(/^[0-9a-f]{48}$/) // 24 bytes of entropy
  })

  it('differs every time', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateLookupToken()))
    expect(seen.size).toBe(500)
  })
})
