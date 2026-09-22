import { describe, expect, it } from 'vitest'
import { loginToEmail, STAFF_LOGIN_DOMAIN } from './login'

describe('loginToEmail', () => {
  it('maps a bare username onto the staff domain', () => {
    expect(loginToEmail('admin')).toBe(`admin@${STAFF_LOGIN_DOMAIN}`)
    expect(loginToEmail('  Admin ')).toBe(`admin@${STAFF_LOGIN_DOMAIN}`)
    expect(loginToEmail('front.desk-2')).toBe(`front.desk-2@${STAFF_LOGIN_DOMAIN}`)
  })

  it('passes a real email through, lower-cased', () => {
    expect(loginToEmail('Tristan@Example.com')).toBe('tristan@example.com')
  })

  it('rejects junk rather than guessing', () => {
    expect(loginToEmail('')).toBeNull()
    expect(loginToEmail('not an email@')).toBeNull()
    expect(loginToEmail('admin@@x')).toBeNull()
    expect(loginToEmail('has space')).toBeNull()
    expect(loginToEmail('-leadingdash')).toBeNull()
  })
})
