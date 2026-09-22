import { describe, expect, it } from 'vitest'
import { bookingMessage, messengerHref } from './messenger'
import { toManilaDate } from './time'

describe('messengerHref', () => {
  it('builds an m.me link with the text encoded', () => {
    const href = messengerHref('undefeated.fitnesscenter', "Hi! I'm booking")
    expect(href.startsWith('https://m.me/undefeated.fitnesscenter?text=')).toBe(true)
    expect(href).toContain(encodeURIComponent("Hi! I'm booking"))
    expect(href).not.toContain(' ')
  })

  it('strips a leading @ and trims the handle', () => {
    expect(messengerHref(' @somepage ', 'x')).toBe('https://m.me/somepage?text=x')
  })
})

describe('bookingMessage', () => {
  it('names the day, the hours and the duration', () => {
    const text = bookingMessage(toManilaDate('2026-09-28'), 15, 17)
    // ICU decides day/month order for en-PH; only the parts are asserted.
    expect(text).toMatch(/Monday/)
    expect(text).toMatch(/September/)
    expect(text).toMatch(/28/)
    expect(text).toMatch(/2026/)
    expect(text).toContain('3:00 – 5:00 PM')
    expect(text).toContain('(2 hours)')
  })

  it('uses the singular for one hour and reads midnight correctly', () => {
    const text = bookingMessage(toManilaDate('2026-09-28'), 23, 24)
    expect(text).toContain('11:00 PM – 12:00 AM')
    expect(text).toContain('(1 hour)')
    expect(text).not.toContain('—\n')
  })

  it('signs the message for a signed-in customer', () => {
    const text = bookingMessage(toManilaDate('2026-09-28'), 15, 16, {
      name: 'Juan dela Cruz',
      email: 'juan@example.com',
    })
    expect(text.endsWith('— Juan dela Cruz (juan@example.com)')).toBe(true)
  })
})
