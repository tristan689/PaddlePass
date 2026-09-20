import { describe, expect, it } from 'vitest'
import { csvCell, csvDocument, csvRow } from './csv'

describe('csvCell', () => {
  it('passes plain values through', () => {
    expect(csvCell('Juan')).toBe('Juan')
    expect(csvCell(1050)).toBe('1050')
  })

  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('dela Cruz, Juan')).toBe('"dela Cruz, Juan"')
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""')
    expect(csvCell('a\nb')).toBe('"a\nb"')
  })

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+639171234567')).toBe(`"'+639171234567"`)
    expect(csvCell('-5')).toBe(`"'-5"`)
    expect(csvCell('@handle')).toBe(`"'@handle"`)
  })

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
})

describe('csvRow / csvDocument', () => {
  it('joins with commas and CRLF, with a BOM', () => {
    expect(csvRow(['a', 'b,c'])).toBe('a,"b,c"')
    const doc = csvDocument(['h1', 'h2'], [['x', 'y']])
    expect(doc.charCodeAt(0)).toBe(0xfeff)
    expect(doc.slice(1)).toBe('h1,h2\r\nx,y\r\n')
  })
})
