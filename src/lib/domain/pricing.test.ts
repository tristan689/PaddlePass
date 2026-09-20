import { describe, expect, it } from 'vitest'
import { balanceCents, isSettled, overpaidCents, priceBooking } from './pricing'

const RATE = 35000 // ₱350.00 / hour
const PADDLE = 10000 // ₱100.00 / paddle

describe('priceBooking', () => {
  it('charges the court by the hour', () => {
    const p = priceBooking({ hours: 3, paddleCount: 0, rateCents: RATE, paddleFeeCents: PADDLE })
    expect(p.courtCents).toBe(105000)
    expect(p.totalCents).toBe(105000)
  })

  /**
   * The rule most likely to be "fixed" into a bug by a future reader: paddles are
   * a flat fee PER BOOKING. A six-hour game pays the same rental as a one-hour game.
   */
  it('charges paddles per booking, NOT per hour', () => {
    const short = priceBooking({ hours: 1, paddleCount: 4, rateCents: RATE, paddleFeeCents: PADDLE })
    const long = priceBooking({ hours: 6, paddleCount: 4, rateCents: RATE, paddleFeeCents: PADDLE })

    expect(short.paddleCents).toBe(40000)
    expect(long.paddleCents).toBe(40000) // identical despite 6x the court time
    expect(long.paddleCents).toBe(short.paddleCents)
  })

  it('sums court and paddles into the total', () => {
    const p = priceBooking({ hours: 3, paddleCount: 4, rateCents: RATE, paddleFeeCents: PADDLE })
    expect(p.totalCents).toBe(105000 + 40000) // ₱1,450.00
  })

  it('costs nothing extra when no paddles are rented', () => {
    const p = priceBooking({ hours: 2, paddleCount: 0, rateCents: RATE, paddleFeeCents: PADDLE })
    expect(p.paddleCents).toBe(0)
  })

  it('honours a snapshotted rate rather than a current one', () => {
    // An old booking priced at ₱300 must keep costing ₱300 after a rate rise.
    const old = priceBooking({ hours: 2, paddleCount: 0, rateCents: 30000, paddleFeeCents: 0 })
    expect(old.totalCents).toBe(60000)
  })

  it('produces whole centavos, never a float artefact', () => {
    const p = priceBooking({ hours: 3, paddleCount: 3, rateCents: 33333, paddleFeeCents: 3333 })
    expect(Number.isInteger(p.totalCents)).toBe(true)
  })
})

describe('balance and settlement', () => {
  it('reports what is still owed', () => {
    expect(balanceCents(145000, 30000)).toBe(115000)
  })

  it('never reports a negative balance when someone overpays', () => {
    expect(balanceCents(100000, 120000)).toBe(0)
    expect(overpaidCents(100000, 120000)).toBe(20000)
  })

  it('treats an exact payment as settled', () => {
    expect(isSettled(100000, 100000)).toBe(true)
    expect(isSettled(100000, 99999)).toBe(false)
  })

  it('does not call a zero-total booking settled', () => {
    // Guards the pre-configuration state where the rate is still ₱0.
    expect(isSettled(0, 0)).toBe(false)
  })
})
