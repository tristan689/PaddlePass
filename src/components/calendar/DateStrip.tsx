import Link from 'next/link'
import type { DayAvailability } from '@/lib/domain/availability'
import { formatDateLong } from '@/lib/domain/time'
import { AvailabilityBar, isPastDay } from './AvailabilityBar'

const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/**
 * Mobile date strip — the primary surface.
 *
 * Most customers arrive by tapping a link in the Facebook app on a phone. A month
 * grid at 360px gives you 45px cells, which is below a comfortable touch target and
 * unreadable besides. A horizontally scroll-snapped filmstrip is the pattern those
 * same users already know from Grab and Lazada.
 *
 * Still a Server Component: scroll-snap is pure CSS and each chip is a link to the
 * day's time picker.
 */
export function DateStrip({
  days,
  className = '',
}: {
  days: DayAvailability[]
  className?: string
}) {
  return (
    <nav
      className={`-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ scrollSnapType: 'x mandatory' }}
      aria-label="Pick a date"
    >
      <ul className="flex gap-2 pb-1">
        {days.map((day) => (
          <li key={day.date} style={{ scrollSnapAlign: 'center' }}>
            <DateChip day={day} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function DateChip({ day }: { day: DayAvailability }) {
  const dayNumber = Number(day.date.slice(8, 10))
  const weekday = WEEKDAY_SHORT[new Date(`${day.date}T00:00:00Z`).getUTCDay()]
  const past = isPastDay(day)
  const bookable = !day.closed && day.freeHoursCount > 0

  // One full sentence for screen readers; the visual chip is abbreviated.
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
      <span className="text-[10px] font-semibold tracking-wider text-slate-500">
        {weekday}
      </span>
      <span className="text-lg font-bold leading-tight text-slate-900">{dayNumber}</span>
      <AvailabilityBar day={day} className="my-1 h-1 w-full rounded-full" />
      <span className="text-[10px] font-medium text-slate-600">
        {day.closed ? '✕' : past ? '–' : day.freeHoursCount === 0 ? 'FULL' : day.freeHoursCount}
      </span>
    </>
  )

  const base =
    'flex h-[84px] w-14 shrink-0 flex-col items-center justify-center rounded-xl border px-1'

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
      href={`/book/${day.date}`}
      aria-label={label}
      className={`${base} border-slate-300 bg-white transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900`}
    >
      {body}
    </Link>
  )
}
