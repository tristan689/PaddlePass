import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  isMonth,
  resolveMonth,
  datesInMonth,
  daysBetween,
  daysInMonth,
  formatDateCompact,
  formatHour,
  formatHourRange,
  hourToTime,
  isManilaDate,
  monthOf,
  nowHourInManila,
  timeToHour,
  todayInManila,
  toManilaDate,
  weekdayOf,
} from './time'

/**
 * The headline test. Vercel runs UTC; the gym is UTC+8. If "today" is ever derived
 * from the host clock, the calendar shows the wrong day for the eight hours between
 * Manila midnight and UTC midnight, and today's slots look already-past.
 */
describe('todayInManila — the UTC off-by-one-day trap', () => {
  it('rolls to the next day once it is past midnight in Manila', () => {
    // 16:30 UTC on 20 Sep === 00:30 on 21 Sep in Manila.
    const instant = new Date('2026-09-20T16:30:00Z')

    expect(instant.getUTCDate()).toBe(20) // still the 20th in UTC
    expect(todayInManila(instant)).toBe('2026-09-21') // but the 21st at the court
    expect(nowHourInManila(instant)).toBe(0) // and it is hour zero, not 16
  })

  it('still reads as the same day one minute before Manila midnight', () => {
    const instant = new Date('2026-09-20T15:59:00Z') // 23:59 Manila
    expect(todayInManila(instant)).toBe('2026-09-20')
    expect(nowHourInManila(instant)).toBe(23)
  })

  it('handles the turn of the year, where the date and the year both roll', () => {
    const instant = new Date('2026-12-31T16:00:00Z') // 00:00 on 1 Jan 2027 in Manila
    expect(todayInManila(instant)).toBe('2027-01-01')
    expect(nowHourInManila(instant)).toBe(0)
  })

  it('reports midnight as hour 0, never hour 24', () => {
    // hourCycle:'h23' matters here — `hour12:false` yields "24" in some runtimes.
    expect(nowHourInManila(new Date('2026-09-20T16:00:00Z'))).toBe(0)
  })
})

describe('date validation', () => {
  it('accepts real calendar dates', () => {
    expect(isManilaDate('2026-09-21')).toBe(true)
    expect(isManilaDate('2028-02-29')).toBe(true) // 2028 is a leap year
  })

  it('rejects dates that look well-formed but do not exist', () => {
    expect(isManilaDate('2026-02-30')).toBe(false)
    expect(isManilaDate('2026-13-01')).toBe(false)
    expect(isManilaDate('2027-02-29')).toBe(false) // 2027 is not a leap year
  })

  it('rejects the wrong shape entirely', () => {
    expect(isManilaDate('21-09-2026')).toBe(false)
    expect(isManilaDate('2026-9-1')).toBe(false)
    expect(isManilaDate('')).toBe(false)
  })

  it('throws rather than coercing when converting', () => {
    expect(() => toManilaDate('nonsense')).toThrow()
  })
})

describe('calendar arithmetic', () => {
  const date = toManilaDate('2026-09-21')

  it('adds and subtracts days across month boundaries', () => {
    expect(addDays(date, 1)).toBe('2026-09-22')
    expect(addDays(date, 10)).toBe('2026-10-01')
    expect(addDays(date, -21)).toBe('2026-08-31')
  })

  it('crosses a leap day correctly', () => {
    expect(addDays(toManilaDate('2028-02-28'), 1)).toBe('2028-02-29')
    expect(addDays(toManilaDate('2027-02-28'), 1)).toBe('2027-03-01')
  })

  it('measures whole days in both directions', () => {
    expect(daysBetween(date, toManilaDate('2026-09-28'))).toBe(7)
    expect(daysBetween(date, toManilaDate('2026-09-14'))).toBe(-7)
    expect(daysBetween(date, date)).toBe(0)
  })

  it('reports the weekday the way Postgres does, Sunday = 0', () => {
    expect(weekdayOf(toManilaDate('2026-09-20'))).toBe(0) // Sunday
    expect(weekdayOf(toManilaDate('2026-09-21'))).toBe(1) // Monday
    expect(weekdayOf(toManilaDate('2026-09-26'))).toBe(6) // Saturday
  })

  it('derives the month tag used for cache invalidation', () => {
    expect(monthOf(date)).toBe('2026-09')
  })

  it('counts days in a month, including February', () => {
    expect(daysInMonth('2026-09')).toBe(30)
    expect(daysInMonth('2026-01')).toBe(31)
    expect(daysInMonth('2027-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
  })

  it('enumerates a whole month in order', () => {
    const days = datesInMonth('2026-09')
    expect(days).toHaveLength(30)
    expect(days[0]).toBe('2026-09-01')
    expect(days[29]).toBe('2026-09-30')
  })
})

describe('hour formatting', () => {
  it('converts between hour numbers and times', () => {
    expect(hourToTime(6)).toBe('06:00')
    expect(hourToTime(14)).toBe('14:00')
    expect(timeToHour('14:00' as never)).toBe(14)
  })

  it('renders 12-hour clock labels the way customers read them', () => {
    expect(formatHour(0)).toBe('12:00 AM')
    expect(formatHour(6)).toBe('6:00 AM')
    expect(formatHour(12)).toBe('12:00 PM')
    expect(formatHour(14)).toBe('2:00 PM')
    expect(formatHour(22)).toBe('10:00 PM')
  })

  it('treats a close time of 24 as midnight rather than hour 24', () => {
    expect(formatHour(24)).toBe('12:00 AM')
  })

  it('collapses a shared meridiem in a range', () => {
    expect(formatHourRange(14, 17)).toBe('2:00 – 5:00 PM')
    expect(formatHourRange(9, 13)).toBe('9:00 AM – 1:00 PM')
  })
})

describe('display formatting is timezone-proof', () => {
  it('formats the intended calendar day regardless of host timezone', () => {
    // A naive `new Date('2026-09-21')` is midnight UTC, which is the 20th in the
    // Americas. Pinning the formatter to UTC is what stops that.
    expect(formatDateCompact(toManilaDate('2026-09-21'))).toContain('21')
    expect(formatDateCompact(toManilaDate('2026-09-01'))).toContain('1')
  })
})

describe('month navigation', () => {
  it('steps forward and back across year boundaries', () => {
    expect(addMonths('2026-09', 1)).toBe('2026-10')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-09', 0)).toBe('2026-09')
  })

  it('validates month strings', () => {
    expect(isMonth('2026-09')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-00')).toBe(false)
    expect(isMonth('2026-9')).toBe(false)
    expect(isMonth('')).toBe(false)
  })

  it('falls back to the current Manila month for junk input', () => {
    // A hand-edited ?m= query must not 500 the public calendar.
    const now = new Date('2026-09-20T16:30:00Z') // already 21 Sep in Manila
    expect(resolveMonth('2026-11', now)).toBe('2026-11')
    expect(resolveMonth('garbage', now)).toBe('2026-09')
    expect(resolveMonth(undefined, now)).toBe('2026-09')
  })
})
