import { describe, expect, it } from 'vitest'
import {
  centavosToPesos,
  formatPesoPlain,
  parsePesoInput,
  pesosToCentavos,
} from './money'

describe('centavo conversion', () => {
  it('round-trips whole pesos', () => {
    expect(pesosToCentavos(350)).toBe(35000)
    expect(centavosToPesos(35000)).toBe(350)
  })

  it('rounds rather than truncating fractional centavos', () => {
    expect(pesosToCentavos(0.125)).toBe(13)
    expect(pesosToCentavos(1050.005)).toBe(105001)
  })

  it('avoids the classic float drift', () => {
    // 0.1 + 0.2 as floats is 0.30000000000000004; as centavos it is exactly 30.
    expect(pesosToCentavos(0.1) + pesosToCentavos(0.2)).toBe(30)
  })
})

describe('formatPesoPlain — the CSV format', () => {
  it('emits a bare number Excel can sum, with no symbol or separators', () => {
    expect(formatPesoPlain(105000)).toBe('1050.00')
    expect(formatPesoPlain(30000)).toBe('300.00')
    expect(formatPesoPlain(0)).toBe('0.00')
  })
})

describe('parsePesoInput — what staff actually type', () => {
  it('accepts a plain number', () => {
    expect(parsePesoInput('300')).toBe(30000)
    expect(parsePesoInput('1050.50')).toBe(105050)
  })

  it('tolerates the peso sign, separators and stray spaces', () => {
    expect(parsePesoInput('₱1,050.00')).toBe(105000)
    expect(parsePesoInput(' 1,050 ')).toBe(105000)
  })

  it('returns null for unparseable input rather than silently yielding zero', () => {
    // A mistyped amount must not quietly become free court time.
    expect(parsePesoInput('abc')).toBeNull()
    expect(parsePesoInput('')).toBeNull()
    expect(parsePesoInput('   ')).toBeNull()
    expect(parsePesoInput('12.34.56')).toBeNull()
  })

  it('parses a negative so the caller can reject it explicitly', () => {
    expect(parsePesoInput('-50')).toBe(-5000)
  })
})
