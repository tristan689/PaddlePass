import Link from 'next/link'
import type { DayAvailability } from '@/lib/domain/availability'
import {
  addDays,
  formatDateCompact,
  formatDateLong,
  weekdayOf,
  WEEKDAY_LABELS,
  type ManilaDate,
} from '@/lib/domain/time'
import { AvailabilityBar, isPastDay } from './AvailabilityBar'

/**
 * Seven days, Sunday to Saturday. The phone-first view: a column per day is a
 * comfortable thumb target at 360px where a month cell is not, and a week is how
 * most people plan a game. Each open column links to that day's hours.
 */
export function WeekView({ days, today }: { days: DayAvailability[]; today: ManilaDate }) {
  const first = days[0].date
  const last = days[days.length - 1].date

  return (
    <section aria-label={`Week of ${formatDateLong(first)}`}>
      <header className="mb-3 flex items-center justify-between">
        <Link
          href={`/?view=week&d=${addDays(first, -7)}`}
          rel="prev"
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Previous week</span>
        </Link>

        <h2 className="text-sm font-semibold tracking-widest text-slate-900">
          {formatDateCompact(first).toUpperCase()} – {formatDateCompact(last).toUpperCase()}
        </h2>

        <Link
          href={`/?view=week&d=${addDays(first, 7)}`}
          rel="next"
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <span aria-hidden="true">›</span>
          <span className="sr-only">Next week</span>
        </Link>
      </header>

      <ul className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => (
          <li key={day.date}>
            <DayColumn day={day} isToday={day.date === today} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function DayColumn({ day, isToday }: { day: DayAvailability; isToday: boolean }) {
  const dayNumber = Number(day.date.slice(8, 10))
  const weekday = WEEKDAY_LABELS[weekdayOf(day.date)]
  const past = isPastDay(day)
  const bookable = !day.closed && day.freeHoursCount > 0

  const label = `${formatDateLong(day.date)}. ${
    day.closed
      ? (day.closedReason ?? 'Closed')
      : past
        ? 'Past'
        : day.freeHoursCount === 0
          ? 'Fully booked'
          : `${day.freeHoursCount} of ${day.openHoursCount} hours open`
  }`

  const body = (
    <>
      <span className="text-[10px] font-semibold tracking-wider text-slate-500">{weekday}</span>
      <span
        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-base font-bold leading-none ${
          isToday ? 'bg-slate-900 text-white' : 'text-slate-900'
        }`}
      >
        {dayNumber}
      </span>
      <AvailabilityBar day={day} className="my-1.5 h-1.5 w-full rounded-full" />
      <span className="text-[11px] font-medium text-slate-600">
        {day.closed ? '✕' : past ? '–' : day.freeHoursCount === 0 ? 'FULL' : `${day.freeHoursCount}h`}
      </span>
    </>
  )

  const base =
    'flex min-h-24 w-full flex-col items-center justify-center rounded-xl border px-1 py-2'

  if (!bookable) {
    return (
      <div
        aria-disabled="true"
        aria-label={label}
        className={`${base} cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 ${
          day.closed ? 'hatched' : ''
        }`}
      >
        {body}
      </div>
    )
  }

  return (
    <Link
      href={`/?view=day&d=${day.date}`}
      aria-label={label}
      className={`${base} border-slate-300 bg-white transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900`}
    >
      {body}
    </Link>
  )
}
