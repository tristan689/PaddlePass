import type { DayAvailability } from '@/lib/domain/availability'
import { displayFor, type CalendarState } from '@/lib/domain/status'

const STATE_FILL: Record<CalendarState, string> = {
  free: 'var(--color-slot-free)',
  pending: 'var(--color-slot-pending)',
  approved: 'var(--color-slot-pending)',
  downpayment: 'var(--color-slot-down)',
  paid: 'var(--color-slot-paid)',
  closed: 'var(--color-slot-closed)',
  past: '#f1f5f9',
}

/**
 * A one-segment-per-open-hour ribbon showing how a day is filling up.
 *
 * Inline SVG from a Server Component: no chart library, no client JavaScript, and
 * it scales cleanly into a 56px-wide mobile date chip. Density communicates how
 * busy the day is at a glance, before anyone reads a single number.
 */
export function AvailabilityBar({
  day,
  className = '',
}: {
  day: DayAvailability
  className?: string
}) {
  const slots = day.slots
  if (slots.length === 0) return null

  const width = 100
  const segment = width / slots.length

  return (
    <svg
      viewBox={`0 0 ${width} 8`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      role="img"
      aria-label={summarise(day)}
    >
      {slots.map((slot, i) => {
        const state: CalendarState =
          slot.state === 'free'
            ? 'free'
            : slot.state === 'past'
              ? 'past'
              : slot.state === 'closed'
                ? 'closed'
                : (slot.state as CalendarState)

        return (
          <rect
            key={slot.hour}
            x={i * segment}
            y={0}
            width={segment}
            height={8}
            fill={STATE_FILL[state]}
            // Hairline separators keep adjacent same-state hours countable.
            stroke="#cbd5e1"
            strokeWidth={0.3}
          />
        )
      })}
    </svg>
  )
}

/** Every hour already gone -- an earlier date, or today after closing. */
export function isPastDay(day: DayAvailability): boolean {
  return day.slots.length > 0 && day.slots.every((slot) => slot.state === 'past')
}

function summarise(day: DayAvailability): string {
  if (day.closed) return `Closed: ${day.closedReason ?? 'not open'}`
  if (isPastDay(day)) return 'Past'
  if (day.freeHoursCount === 0) return 'Fully booked'
  return `${day.freeHoursCount} of ${day.openHoursCount} hours open`
}

/** The caption under each cell: the number people actually care about. */
export function availabilityCaption(day: DayAvailability): {
  text: string
  tone: 'open' | 'busy' | 'full' | 'closed'
} {
  if (day.closed) return { text: displayFor('closed').label, tone: 'closed' }
  // A day that has simply gone by must not read as "fully booked" -- that tells a
  // customer the court is in higher demand than it is.
  if (isPastDay(day)) return { text: displayFor('past').label, tone: 'closed' }
  if (day.freeHoursCount === 0) return { text: 'FULL', tone: 'full' }
  if (day.freeHoursCount === day.openHoursCount)
    return { text: `${day.openHoursCount}h open`, tone: 'open' }
  return { text: `${day.freeHoursCount}h left`, tone: 'busy' }
}
