import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  buildDayAvailability,
  type DayAvailability,
  type OccupiedRange,
  type SlotState,
} from '@/lib/domain/availability'
import {
  addDays,
  datesInMonth,
  daysInMonth,
  firstOfMonth,
  nowHourInManila,
  todayInManila,
  type ManilaDate,
} from '@/lib/domain/time'
import { getSettings, type PublicSettings } from './settings'

interface AvailabilityRow {
  slot_date: string
  start_hour: number
  end_hour: number
  state: string
}

interface BlockedRow {
  blocked_date: string
  public_reason: string
}

/** Occupied ranges and closures for a date window, grouped by date. */
async function loadWindow(from: ManilaDate, to: ManilaDate) {
  const supabase = await createClient()

  const [availability, blocked] = await Promise.all([
    supabase.rpc('get_availability', { p_from: from, p_to: to }),
    supabase.rpc('get_blocked_dates', { p_from: from, p_to: to }),
  ])

  if (availability.error)
    throw new Error(`Could not load availability: ${availability.error.message}`)
  if (blocked.error)
    throw new Error(`Could not load closures: ${blocked.error.message}`)

  const occupiedByDate = new Map<string, OccupiedRange[]>()
  for (const row of (availability.data ?? []) as AvailabilityRow[]) {
    const list = occupiedByDate.get(row.slot_date) ?? []
    list.push({
      startHour: row.start_hour,
      endHour: row.end_hour,
      state: row.state as OccupiedRange['state'],
    })
    occupiedByDate.set(row.slot_date, list)
  }

  const blockedByDate = new Map<string, string>()
  for (const row of (blocked.data ?? []) as BlockedRow[]) {
    blockedByDate.set(row.blocked_date, row.public_reason)
  }

  return { occupiedByDate, blockedByDate }
}

export interface MonthAvailability {
  month: string
  days: DayAvailability[]
  settings: PublicSettings
}

/**
 * A whole month for the calendar grid.
 *
 * The clock is read ONCE here and threaded through every day, so a render that
 * straddles the top of an hour cannot mark one day's slots past and another's
 * future using two different "nows".
 */
export async function getMonthAvailability(month: string): Promise<MonthAvailability> {
  const settings = await getSettings()

  const from = firstOfMonth(month)
  const to = addDays(from, daysInMonth(month) - 1)
  const { occupiedByDate, blockedByDate } = await loadWindow(from, to)

  const today = todayInManila()
  const nowHour = nowHourInManila()

  const days = datesInMonth(month).map((date) =>
    buildDayAvailability({
      date,
      settings,
      occupied: occupiedByDate.get(date) ?? [],
      blockedReason: blockedByDate.get(date),
      today,
      nowHour,
    })
  )

  return { month, days, settings }
}

/**
 * One day, for the slot picker.
 *
 * This is the read immediately before a submit, so it is never cached and never
 * approximated. It is also only advisory: the authority on whether a slot is free
 * is the EXCLUDE constraint, which arbitrates at insert time.
 */
export async function getDayAvailability(
  date: ManilaDate
): Promise<{ day: DayAvailability; settings: PublicSettings }> {
  const settings = await getSettings()
  const { occupiedByDate, blockedByDate } = await loadWindow(date, date)

  const day = buildDayAvailability({
    date,
    settings,
    occupied: occupiedByDate.get(date) ?? [],
    blockedReason: blockedByDate.get(date),
    today: todayInManila(),
    nowHour: nowHourInManila(),
  })

  return { day, settings }
}

/** The rolling window the mobile date strip scrolls through. */
export async function getStripAvailability(
  start: ManilaDate,
  dayCount = 21
): Promise<{ days: DayAvailability[]; settings: PublicSettings }> {
  const settings = await getSettings()
  const end = addDays(start, dayCount - 1)
  const { occupiedByDate, blockedByDate } = await loadWindow(start, end)

  const today = todayInManila()
  const nowHour = nowHourInManila()

  const days = Array.from({ length: dayCount }, (_, i) => addDays(start, i)).map(
    (date) =>
      buildDayAvailability({
        date,
        settings,
        occupied: occupiedByDate.get(date) ?? [],
        blockedReason: blockedByDate.get(date),
        today,
        nowHour,
      })
  )

  return { days, settings }
}

export type { DayAvailability, SlotState }
