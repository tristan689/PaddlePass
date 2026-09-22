import { describe, expect, it } from 'vitest'
import { bookingEnquiry, messengerHref } from './messenger'
import { toManilaDate } from './time'

describe('messengerHref', () => {
  it('builds an m.me link with the text encoded', () => {
    const href = messengerHref('undefeated.fitnesscenter', "Hi! I'd like to book")
    expect(href.startsWith('https://m.me/undefeated.fitnesscenter?text=')).toBe(true)
    expect(href).toContain(encodeURIComponent("Hi! I'd like to book"))
    expect(href).not.toContain(' ')
  })

  it('strips a leading @ and trims the handle', () => {
    expect(messengerHref(' @somepage ', 'x')).toBe('https://m.me/somepage?text=x')
  })
})

describe('bookingEnquiry', () => {
  it('names the day in full so staff can find it', () => {
    const text = bookingEnquiry(toManilaDate('2026-09-28'))
    // ICU decides day/month order for en-PH; only the parts are asserted.
    expect(text).toMatch(/Monday/)
    expect(text).toMatch(/September/)
    expect(text).toMatch(/28/)
    expect(text).toMatch(/2026/)
  })
})
