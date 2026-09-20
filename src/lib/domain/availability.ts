/**
 * Slot availability and contiguous-range selection.
 *
 * This is the module the slot picker uses to decide which buttons to disable, and
 * the module the server uses to decide whether a submitted range is legal. Both
 * import it, so the rules cannot drift apart. It is pure: no Next, no Supabase,
 * no Date construction -- `todayInManila()` is passed in by the caller.
 *
 * It is NOT the double-booking guarantee. That is the Postgres EXCLUDE constraint.
 * This layer exists so the UI never offers an invalid choice in the first place.
 */

import type { ManilaDate } from './time'
import { weekdayOf } from './time'
import type { Settings } from './settings'
import { isClosedWeekday, openHours } from './settings'

/** What occupies a single hour. Ordered roughly by how "committed" it is. */
export type SlotState =
  | 'free'
  | 'pending' // requested, awaiting admin -- still holds the slot
  | 'approved' // admin said yes, no money yet
  | 'downpayment' // partially paid
  | 'paid' // settled
  | 'closed' // closed weekday, or an admin block
  | 'past' // already started today, or an earlier date

export interface Slot {
  hour: number
  state: SlotState
}

/** Every state except `free` blocks a new booking from taking the hour. */
export function isBookable(state: SlotState): boolean {
  return state === 'free'
}

/** An occupied range coming back from the database. */
export interface OccupiedRange {
  startHour: number
  endHour: number // exclusive
  state: Exclude<SlotState, 'free' | 'past'>
}

export interface DayAvailability {
  date: ManilaDate
  slots: Slot[]
  /** True when nothing on this date can be booked at all. */
  closed: boolean
  /** Shown to the public when closed, e.g. "Holiday" or "Court resurfacing". */
  closedReason?: string
  /** Hours the court is open on this date, ignoring bookings. */
  openHoursCount: number
  /** Hours still bookable right now. */
  freeHoursCount: number
}

export interface BuildDayInput {
  date: ManilaDate
  settings: Settings
  occupied: OccupiedRange[]
  /** Admin block covering this whole date, if any. */
  blockedReason?: string
  /** From `todayInManila()`. */
  today: ManilaDate
  /** From `nowHourInManila()`. */
  nowHour: number
}

/**
 * Compose one day's slots from the settings, the bookings, the blocks and the clock.
 *
 * Precedence matters and is deliberate: past beats closed beats occupied. A slot
 * that has already started is shown as past even on a blocked day, because
 * "you can't book that, it's over" is the more useful message.
 */
export function buildDayAvailability(input: BuildDayInput): DayAvailability {
  const { date, settings, occupied, blockedReason, today, nowHour } = input

  const hours = openHours(settings)
  const isPastDate = date < today
  const isToday = date === today
  const closedByWeekday = isClosedWeekday(settings, weekdayOf(date))
  const closed = closedByWeekday || blockedReason !== undefined

  const slots: Slot[] = hours.map((hour) => {
    if (isPastDate || (isToday && hour <= nowHour)) return { hour, state: 'past' }
    if (closed) return { hour, state: 'closed' }

    const hit = occupied.find((o) => hour >= o.startHour && hour < o.endHour)
    return { hour, state: hit ? hit.state : 'free' }
  })

  return {
    date,
    slots,
    closed,
    closedReason: blockedReason ?? (closedByWeekday ? 'Closed' : undefined),
    openHoursCount: hours.length,
    freeHoursCount: slots.filter((s) => isBookable(s.state)).length,
  }
}

export interface RangeLimits {
  minHours: number
  maxHours: number
  /**
   * Furthest exclusive end hour reachable from `startHour` without crossing a
   * non-free slot, passing closing time, or exceeding `maxHours`.
   * Equals `startHour` when the start itself isn't bookable.
   */
  maxEnd: number
  /** Earliest legal exclusive end, or `null` when `minHours` can't be met here. */
  minEnd: number | null
}

/**
 * How far a booking starting at `startHour` can legally extend.
 *
 * This is what makes the picker honest: the moment a start is chosen, every hour
 * past `maxEnd` is disabled, so the customer physically cannot select a range that
 * skips over a booked hour. Never show an error for something the UI invited.
 *
 * `slots` must be ascending. Gaps in the hour sequence are treated as walls, so a
 * split operating window (e.g. a lunch closure) can never be booked across.
 */
export function rangeLimitsFrom(
  slots: Slot[],
  startHour: number,
  minHours: number,
  maxHours: number
): RangeLimits {
  const startIndex = slots.findIndex((s) => s.hour === startHour)

  if (startIndex === -1 || !isBookable(slots[startIndex].state)) {
    return { minHours, maxHours, maxEnd: startHour, minEnd: null }
  }

  let i = startIndex
  while (
    i + 1 < slots.length &&
    isBookable(slots[i + 1].state) &&
    slots[i + 1].hour === slots[i].hour + 1 && // contiguous, no gap
    slots[i + 1].hour + 1 - startHour <= maxHours
  ) {
    i++
  }

  const maxEnd = slots[i].hour + 1 // exclusive
  const wantedMinEnd = startHour + minHours

  return {
    minHours,
    maxHours,
    maxEnd,
    minEnd: wantedMinEnd <= maxEnd ? wantedMinEnd : null,
  }
}

/** The single predicate both the picker and the server use to accept a range. */
export function isSelectableEnd(
  limits: RangeLimits,
  startHour: number,
  endHour: number
): boolean {
  if (limits.minEnd === null) return false
  const hours = endHour - startHour
  return (
    endHour >= limits.minEnd &&
    endHour <= limits.maxEnd &&
    hours >= limits.minHours &&
    hours <= limits.maxHours
  )
}

/**
 * Can a booking legally *start* here? Used to disable starts up-front rather than
 * letting someone pick one and then discover nothing valid follows it.
 */
export function canStartAt(
  slots: Slot[],
  startHour: number,
  minHours: number,
  maxHours: number
): boolean {
  return rangeLimitsFrom(slots, startHour, minHours, maxHours).minEnd !== null
}

/** Every hour that would be covered by selecting `[startHour, endHour)`. */
export function hoursInRange(startHour: number, endHour: number): number[] {
  return Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => startHour + i)
}

/**
 * Why a slot can't be picked, phrased for a customer rather than a developer.
 * Names the actual blocker instead of a generic "unavailable".
 */
export function blockerMessage(state: SlotState): string {
  switch (state) {
    case 'past':
      return 'That time has already passed.'
    case 'closed':
      return 'The court is closed then.'
    case 'pending':
      return 'Someone has a pending request for that hour.'
    case 'approved':
    case 'downpayment':
    case 'paid':
      return 'That hour is already booked.'
    case 'free':
      return ''
  }
}
