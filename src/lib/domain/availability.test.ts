import { describe, expect, it } from 'vitest'
import {
  buildDayAvailability,
  canStartAt,
  isSelectableEnd,
  rangeLimitsFrom,
  type Slot,
  type SlotState,
} from './availability'
import { DEFAULT_SETTINGS, type Settings } from './settings'
import { toManilaDate } from './time'

/** Contiguous free slots for `[from, to)`. */
function freeSlots(from: number, to: number): Slot[] {
  return Array.from({ length: to - from }, (_, i) => ({
    hour: from + i,
    state: 'free' as SlotState,
  }))
}

function occupy(slots: Slot[], hours: number[], state: SlotState): Slot[] {
  return slots.map((s) => (hours.includes(s.hour) ? { ...s, state } : s))
}

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  openHour: 6,
  closeHour: 22,
  minHours: 1,
  maxHours: 6,
  rateCents: 35000,
}

describe('rangeLimitsFrom — what makes the picker honest', () => {
  it('extends to closing time when the rest of the day is free', () => {
    const slots = freeSlots(6, 22) // last bookable hour is 21
    const limits = rangeLimitsFrom(slots, 18, 1, 6)

    expect(limits.maxEnd).toBe(22) // 21:00-22:00 is the final slot
    expect(limits.minEnd).toBe(19)
  })

  it('stops dead at the first booked hour', () => {
    // 17:00 is taken, so a booking starting at 14:00 can run to 17:00 at most.
    const slots = occupy(freeSlots(6, 22), [17], 'paid')
    const limits = rangeLimitsFrom(slots, 14, 1, 6)

    expect(limits.maxEnd).toBe(17)
    expect(limits.minEnd).toBe(15)
  })

  it('treats a PENDING hour as blocking, not merely advisory', () => {
    // A pending request holds its slot for the hold window; it must block.
    const slots = occupy(freeSlots(6, 22), [16], 'pending')
    expect(rangeLimitsFrom(slots, 14, 1, 6).maxEnd).toBe(16)
  })

  it('caps at maxHours even with the whole day free', () => {
    const slots = freeSlots(6, 22)
    expect(rangeLimitsFrom(slots, 8, 1, 3).maxEnd).toBe(11) // 3 hours, not 14
  })

  it('treats a gap in the hour sequence as a wall', () => {
    // A split operating window (say a midday closure) must not be booked across.
    const slots = [...freeSlots(6, 10), ...freeSlots(14, 18)]
    expect(rangeLimitsFrom(slots, 8, 1, 6).maxEnd).toBe(10)
  })

  it('returns no reachable end when the start itself is not free', () => {
    const slots = occupy(freeSlots(6, 22), [14], 'downpayment')
    const limits = rangeLimitsFrom(slots, 14, 1, 6)

    expect(limits.maxEnd).toBe(14)
    expect(limits.minEnd).toBeNull()
  })

  it('returns no reachable end when minHours cannot be satisfied', () => {
    // Only 16:00-17:00 is free, but the minimum booking is 2 hours.
    const slots = occupy(freeSlots(6, 22), [15, 17], 'paid')
    const limits = rangeLimitsFrom(slots, 16, 2, 6)

    expect(limits.maxEnd).toBe(17) // one hour is reachable
    expect(limits.minEnd).toBeNull() // but that is not enough to book
  })

  it('handles an unknown start hour without throwing', () => {
    expect(rangeLimitsFrom(freeSlots(6, 22), 99, 1, 6).minEnd).toBeNull()
  })
})

describe('isSelectableEnd', () => {
  const slots = occupy(freeSlots(6, 22), [17], 'paid')
  const limits = rangeLimitsFrom(slots, 14, 1, 6) // maxEnd 17, minEnd 15

  it('accepts ends inside the reachable window', () => {
    expect(isSelectableEnd(limits, 14, 15)).toBe(true)
    expect(isSelectableEnd(limits, 14, 17)).toBe(true)
  })

  it('rejects an end that would skip over the booked hour', () => {
    expect(isSelectableEnd(limits, 14, 18)).toBe(false)
  })

  it('rejects an end at or before the start', () => {
    expect(isSelectableEnd(limits, 14, 14)).toBe(false)
    expect(isSelectableEnd(limits, 14, 13)).toBe(false)
  })

  it('rejects everything when no end is reachable', () => {
    const none = rangeLimitsFrom(slots, 17, 1, 6)
    expect(isSelectableEnd(none, 17, 18)).toBe(false)
  })
})

describe('canStartAt', () => {
  it('disables a start that has no legal end, before the user taps it', () => {
    const slots = occupy(freeSlots(6, 22), [15, 17], 'paid')
    expect(canStartAt(slots, 16, 2, 6)).toBe(false) // one free hour, needs two
    expect(canStartAt(slots, 16, 1, 6)).toBe(true) // one hour is enough
  })
})

describe('buildDayAvailability', () => {
  const today = toManilaDate('2026-09-21')

  it('marks every hour of an earlier date as past', () => {
    const day = buildDayAvailability({
      date: toManilaDate('2026-09-20'),
      settings,
      occupied: [],
      today,
      nowHour: 10,
    })

    expect(day.slots.every((s) => s.state === 'past')).toBe(true)
    expect(day.freeHoursCount).toBe(0)
  })

  it('marks only the elapsed hours of today as past', () => {
    const day = buildDayAvailability({
      date: today,
      settings,
      occupied: [],
      today,
      nowHour: 10,
    })

    // The 10:00 slot has already started, so it is gone; 11:00 is still bookable.
    expect(day.slots.find((s) => s.hour === 10)?.state).toBe('past')
    expect(day.slots.find((s) => s.hour === 11)?.state).toBe('free')
    expect(day.freeHoursCount).toBe(11) // 11:00 through 21:00
  })

  it('maps occupied ranges onto the hours they cover, end-exclusive', () => {
    const day = buildDayAvailability({
      date: toManilaDate('2026-09-25'),
      settings,
      occupied: [{ startHour: 14, endHour: 17, state: 'downpayment' }],
      today,
      nowHour: 10,
    })

    expect(day.slots.find((s) => s.hour === 13)?.state).toBe('free')
    expect(day.slots.find((s) => s.hour === 14)?.state).toBe('downpayment')
    expect(day.slots.find((s) => s.hour === 16)?.state).toBe('downpayment')
    expect(day.slots.find((s) => s.hour === 17)?.state).toBe('free') // exclusive end
    expect(day.freeHoursCount).toBe(13) // 16 open hours minus 3 booked
  })

  it('closes the whole day on a closed weekday', () => {
    const sunday = toManilaDate('2026-09-27')
    const day = buildDayAvailability({
      date: sunday,
      settings: { ...settings, closedWeekdays: [0] },
      occupied: [],
      today,
      nowHour: 10,
    })

    expect(day.closed).toBe(true)
    expect(day.slots.every((s) => s.state === 'closed')).toBe(true)
    expect(day.freeHoursCount).toBe(0)
  })

  it('closes the day for an admin block and surfaces the reason', () => {
    const day = buildDayAvailability({
      date: toManilaDate('2026-12-25'),
      settings,
      occupied: [],
      blockedReason: 'Christmas Day',
      today,
      nowHour: 10,
    })

    expect(day.closed).toBe(true)
    expect(day.closedReason).toBe('Christmas Day')
  })

  it('shows past rather than closed for elapsed hours on a blocked day', () => {
    // "That time is over" is more useful to a customer than "we were shut".
    const day = buildDayAvailability({
      date: today,
      settings,
      occupied: [],
      blockedReason: 'Maintenance',
      today,
      nowHour: 10,
    })

    expect(day.slots.find((s) => s.hour === 8)?.state).toBe('past')
    expect(day.slots.find((s) => s.hour === 15)?.state).toBe('closed')
  })
})
