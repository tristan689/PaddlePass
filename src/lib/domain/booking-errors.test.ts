import { describe, expect, it } from 'vitest'
import {
  customerMessageFor,
  shouldRefreshAvailability,
  staffMessageFor,
} from './booking-errors'

describe('customerMessageFor', () => {
  it('maps known codes to sentences', () => {
    expect(customerMessageFor('SLOT_TAKEN')).toMatch(/someone else just took/i)
    expect(customerMessageFor('PADDLES_UNAVAILABLE')).toMatch(/paddles/i)
  })

  it('tolerates a prefixed message', () => {
    expect(customerMessageFor('ERROR: SLOT_TAKEN')).toMatch(/someone else/i)
  })

  it('never leaks unknown database text', () => {
    const msg = customerMessageFor('column "foo" does not exist')
    expect(msg).not.toMatch(/column/)
    expect(msg).toMatch(/try again/i)
  })

  it('handles empty input', () => {
    expect(customerMessageFor(undefined)).toMatch(/try again/i)
  })
})

describe('staffMessageFor', () => {
  it('maps staff codes', () => {
    expect(staffMessageFor('NOT_PENDING')).toMatch(/pending/i)
    expect(staffMessageFor('REASON_REQUIRED')).toMatch(/reason/i)
  })

  it('explains the one-live-payment rule', () => {
    expect(
      staffMessageFor(
        'duplicate key value violates unique constraint "payments_one_live_down_idx"'
      )
    ).toMatch(/already recorded/i)
  })
})

describe('shouldRefreshAvailability', () => {
  it('flags races and stale pickers', () => {
    expect(shouldRefreshAvailability('SLOT_TAKEN')).toBe(true)
    expect(shouldRefreshAvailability('TIME_PAST')).toBe(true)
    expect(shouldRefreshAvailability('MISSING_DETAILS')).toBe(false)
  })
})
