import Link from 'next/link'
import type { DayAvailability } from '@/lib/domain/availability'
import { addMonths, formatMonthLong, weekdayOf, WEEKDAY_LABELS } from '@/lib/domain/time'
import { AvailabilityBar, availabilityCaption } from './AvailabilityBar'

/**
 * Desktop month calendar.
 *
 * A Server Component: month navigation is a <Link> to ?m=YYYY-MM and picking a day
 * is a <Link> to /book/<date>, so the whole grid ships zero JavaScript. It also
 * means every view is a real URL — staff can send a customer straight to a
 * specific day, and the browser back button behaves.
 */
export function MonthGrid({
  month,
  days,
  className = '',
}: {
  month: string
  days: DayAvailability[]
  className?: string
}) {
  // Blank cells so the 1st lands under its real weekday.
  const leadingBlanks = days.length > 0 ? weekdayOf(days[0].date) : 0

  return (
    <section className={className} aria-label={`Availability for ${formatMonthLong(month)}`}>
      <header className="mb-3 flex items-center justify-between">
        <Link
          href={`/?m=${addMonths(month, -1)}`}
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          rel="prev"
        >
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Previous month</span>
        </Link>

        <h2 className="text-sm font-semibold tracking-widest text-slate-900">
          {formatMonthLong(month)}
        </h2>

        <Link
          href={`/?m=${addMonths(month, 1)}`}
          className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          rel="next"
        >
          <span aria-hidden="true">›</span>
          <span className="sr-only">Next month</span>
        </Link>
      </header>

      <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-200 bg-slate-200 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-slate-50 py-2 text-[11px] font-semibold tracking-wider text-slate-500"
          >
            {label}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} className="min-h-24 bg-slate-50" />
        ))}

        {days.map((day) => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>
    </section>
  )
}

function DayCell({ day }: { day: DayAvailability }) {
  const caption = availabilityCaption(day)
  const dayNumber = Number(day.date.slice(8, 10))
  const bookable = !day.closed && day.freeHoursCount > 0

  const captionTone = {
    open: 'text-emerald-700',
    busy: 'text-amber-700',
    full: 'text-slate-500',
    closed: 'text-slate-400',
  }[caption.tone]

  const inner = (
    <>
      <span className="text-sm font-semibold text-slate-900">{dayNumber}</span>
      <AvailabilityBar day={day} className="mt-1.5 h-2 rounded-sm" />
      <span className={`mt-1 text-[10px] font-medium ${captionTone}`}>
        {day.closed && day.closedReason !== 'Closed' ? day.closedReason : caption.text}
      </span>
    </>
  )

  // A fully-booked or closed day is not a link. Rendering it as a dead link would
  // invite a tap that goes nowhere; a <div> with aria-disabled states the fact.
  if (!bookable) {
    return (
      <div
        aria-disabled="true"
        className={`flex min-h-24 cursor-not-allowed flex-col items-center bg-white p-2 ${
          day.closed ? 'hatched' : ''
        }`}
      >
        {inner}
      </div>
    )
  }

  return (
    <Link
      href={`/book/${day.date}`}
      className="flex min-h-24 flex-col items-center bg-white p-2 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900"
    >
      {inner}
    </Link>
  )
}
