import {
  adminLabelFor,
  calendarStateOf,
  displayFor,
  type BookingStatus,
} from '@/lib/domain/status'

/**
 * Lifecycle status as a pill. Occupying statuses reuse the calendar's colour +
 * glyph so the admin and the public never disagree; released ones are muted.
 */
export function StatusBadge({ status, className = '' }: { status: BookingStatus; className?: string }) {
  const state = status === 'no_show' ? null : calendarStateOf(status)
  const display = state ? displayFor(state) : null

  const look = display
    ? display.className
    : status === 'no_show'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-100 text-slate-500'

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${look} ${className}`}
    >
      {adminLabelFor(status)}
    </span>
  )
}
