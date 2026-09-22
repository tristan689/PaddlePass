import { describe, expect, it } from 'vitest'
import { DEFAULT_AFTER_LOGIN, safeNextPath } from './redirect'

describe('safeNextPath', () => {
  it('falls back to the dashboard when nothing is supplied', () => {
    expect(safeNextPath(undefined)).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath(null)).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath('')).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('accepts paths inside the admin area', () => {
    expect(safeNextPath('/admin')).toBe('/admin')
    expect(safeNextPath('/admin/bookings')).toBe('/admin/bookings')
    expect(safeNextPath('/admin/bookings/abc?x=1')).toBe('/admin/bookings/abc?x=1')
  })

  it('rejects open-redirect shapes', () => {
    expect(safeNextPath('https://evil.example/admin')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath('//evil.example/admin')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath('/\\evil.example')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath('/admin/<script>')).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('accepts the customer account area', () => {
    expect(safeNextPath('/account')).toBe('/account')
  })

  it('rejects paths outside the admin and account areas', () => {
    expect(safeNextPath('/')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath('/adminx')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath('/accounts')).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeNextPath('/book/2026-09-21')).toBe(DEFAULT_AFTER_LOGIN)
  })

  it('takes the first value when the parameter was repeated', () => {
    expect(safeNextPath(['/admin/staff', '/evil'])).toBe('/admin/staff')
  })
})
