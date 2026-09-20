/**
 * Manila wall-clock date/time.
 *
 * This module is the firewall against the single most likely bug in this app.
 *
 * Vercel runs in UTC. At 00:30 Manila it is still *yesterday* in UTC, so a naive
 * `new Date()` marks today's slots as already past and the calendar silently shows
 * the wrong day. Every notion of "today" and "now" in this codebase goes through
 * here, and no other module is allowed to construct a `Date` from a calendar date.
 *
 * Storage truth is Manila wall-clock (`date` + `time` in Postgres). The Philippines
 * has no DST and has been fixed at UTC+8 since 1844, so wall-clock arithmetic is
 * unambiguous -- but we still never *assume* +08:00, we ask `Intl` for it.
 */

export const MANILA_TZ = 'Asia/Manila'

/** `YYYY-MM-DD` in Manila. Branded so a raw string can't be passed by accident. */
export type ManilaDate = string & { readonly __brand: 'ManilaDate' }

/** `HH:MM` 24-hour in Manila. Branded for the same reason. */
export type ManilaTime = string & { readonly __brand: 'ManilaTime' }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-4]):[0-5]\d$/

export function isManilaDate(value: string): value is ManilaDate {
  if (!DATE_RE.test(value)) return false
  const { y, m, d } = splitDate(value)
  // Rejects 2026-02-30 and friends: round-tripping only survives real dates.
  const probe = new Date(Date.UTC(y, m - 1, d))
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  )
}

export function toManilaDate(value: string): ManilaDate {
  if (!isManilaDate(value)) throw new Error(`Not a valid calendar date: ${value}`)
  return value
}

export function isManilaTime(value: string): value is ManilaTime {
  return TIME_RE.test(value)
}

export function toManilaTime(value: string): ManilaTime {
  if (!isManilaTime(value)) throw new Error(`Not a valid HH:MM time: ${value}`)
  return value
}

function splitDate(date: string): { y: number; m: number; d: number } {
  return {
    y: Number(date.slice(0, 4)),
    m: Number(date.slice(5, 7)),
    d: Number(date.slice(8, 10)),
  }
}

/**
 * Read the wall clock in Manila, whatever the host timezone is.
 * `Intl` owns the offset so we never hardcode +08:00.
 */
function manilaParts(now: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // never yields "24" for midnight, unlike hour12:false
  }).formatToParts(now)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value)

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/** Today's calendar date in Manila. The only correct source of "today". */
export function todayInManila(now: Date = new Date()): ManilaDate {
  const { year, month, day } = manilaParts(now)
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}` as ManilaDate
}

/** Current hour 0-23 in Manila. Used to grey out slots that already started. */
export function nowHourInManila(now: Date = new Date()): number {
  return manilaParts(now).hour
}

/** Current `HH:MM` in Manila. */
export function nowTimeInManila(now: Date = new Date()): ManilaTime {
  const { hour, minute } = manilaParts(now)
  return `${pad2(hour)}:${pad2(minute)}` as ManilaTime
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const pad4 = (n: number) => String(n).padStart(4, '0')

/**
 * Calendar arithmetic done entirely in UTC so the host timezone can never shift a
 * day boundary. We construct in UTC, read in UTC, and format from the integers.
 */
export function addDays(date: ManilaDate, days: number): ManilaDate {
  const { y, m, d } = splitDate(date)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return `${pad4(shifted.getUTCFullYear())}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate()
  )}` as ManilaDate
}

/** Whole days from `a` to `b`. Negative when `b` is earlier. */
export function daysBetween(a: ManilaDate, b: ManilaDate): number {
  return Math.round((utcMs(b) - utcMs(a)) / 86_400_000)
}

function utcMs(date: ManilaDate): number {
  const { y, m, d } = splitDate(date)
  return Date.UTC(y, m - 1, d)
}

/** 0 = Sunday .. 6 = Saturday, matching Postgres `extract(dow)`. */
export function weekdayOf(date: ManilaDate): number {
  const { y, m, d } = splitDate(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** `2026-09` for the month this date falls in. Used as a cache tag. */
export function monthOf(date: ManilaDate): string {
  return date.slice(0, 7)
}

export function firstOfMonth(month: string): ManilaDate {
  return `${month}-01` as ManilaDate
}

export function daysInMonth(month: string): number {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Every date in a `YYYY-MM` month, in order. */
export function datesInMonth(month: string): ManilaDate[] {
  const first = firstOfMonth(month)
  return Array.from({ length: daysInMonth(month) }, (_, i) => addDays(first, i))
}

// ---------------------------------------------------------------------------
// Hours <-> times. Slots are whole hours, so an hour number is the natural key.
// ---------------------------------------------------------------------------

export function hourToTime(hour: number): ManilaTime {
  return `${pad2(hour)}:00` as ManilaTime
}

export function timeToHour(time: ManilaTime): number {
  return Number(time.slice(0, 2))
}

/** `14` -> `"2:00 PM"`. `24` -> `"12:00 AM"` so a close time of midnight reads right. */
export function formatHour(hour: number): string {
  const h = hour % 24
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${suffix}`
}

/** `14, 17` -> `"2:00 – 5:00 PM"`, collapsing a shared meridiem. */
export function formatHourRange(startHour: number, endHour: number): string {
  const start = formatHour(startHour)
  const end = formatHour(endHour)
  const startMeridiem = start.slice(-2)
  const endMeridiem = end.slice(-2)
  if (startMeridiem === endMeridiem) return `${start.slice(0, -3)} – ${end}`
  return `${start} – ${end}`
}

// ---------------------------------------------------------------------------
// Display formatting. Always pinned to UTC on a UTC-constructed date, so the
// host timezone cannot shift the rendered weekday.
// ---------------------------------------------------------------------------

function asUtcDate(date: ManilaDate): Date {
  const { y, m, d } = splitDate(date)
  return new Date(Date.UTC(y, m - 1, d))
}

/** `"Mon, 21 Sep 2026"` */
export function formatDateShort(date: ManilaDate): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(asUtcDate(date))
}

/** `"Monday, 21 September 2026"` */
export function formatDateLong(date: ManilaDate): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(asUtcDate(date))
}

/** `"21 Sep 2026"` -- the logbook's date columns. */
export function formatDateCompact(date: ManilaDate): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(asUtcDate(date))
}

/** `"SEPTEMBER 2026"` -- the calendar header. */
export function formatMonthLong(month: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  })
    .format(asUtcDate(firstOfMonth(month)))
    .toUpperCase()
}

/** Short weekday initials for the month grid header, Sunday first. */
export const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

/** `('2026-09', 1)` -> `'2026-10'`. Used by the calendar's month navigation. */
export function addMonths(month: string, delta: number): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const shifted = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${pad4(shifted.getUTCFullYear())}-${pad2(shifted.getUTCMonth() + 1)}`
}

/** Is this `YYYY-MM` well-formed and a real month? */
export function isMonth(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false
  return Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2999
}

/** The month a date falls in, or the current Manila month when absent/invalid. */
export function resolveMonth(value: string | undefined, now: Date = new Date()): string {
  if (value && isMonth(value)) return value
  return monthOf(todayInManila(now))
}

// ---------------------------------------------------------------------------
// Postgres `time` strings and true instants (timestamptz), for the admin side.
// ---------------------------------------------------------------------------

/** `"14:00:00"` -> 14. A midnight close is stored as `"24:00:00"` -> 24. */
export function hourOfTime(time: string): number {
  return Number(time.slice(0, 2))
}

/** `"14:00:00", "17:00:00"` -> `"2:00 – 5:00 PM"`. */
export function formatTimeRange(startTime: string, endTime: string): string {
  return formatHourRange(hourOfTime(startTime), hourOfTime(endTime))
}

/** An ISO instant rendered as Manila wall-clock: `"Sat 21 Sep, 3:45 PM"`. */
export function formatInstantManila(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Time of day only: `"3:45 PM"`. */
export function formatClockManila(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * `"in 1 h 20 min"`, `"in 4 min"`, `"12 min ago"`. Coarse on purpose: this labels
 * hold deadlines on a list that refreshes on navigation, not a live countdown.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMin = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000)
  const abs = Math.abs(diffMin)
  const body =
    abs < 60
      ? `${abs} min`
      : abs < 60 * 48
        ? `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60} min` : ''}`
        : `${Math.round(abs / 60 / 24)} d`
  return diffMin >= 0 ? `in ${body}` : `${body} ago`
}
