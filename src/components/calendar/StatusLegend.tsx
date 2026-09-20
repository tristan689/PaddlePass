import { displayFor, LEGEND_STATES } from '@/lib/domain/status'
import { StatusDot } from './StatusDot'

/**
 * The key to the calendar.
 *
 * Not decoration: with five states in play, a customer cannot infer that amber
 * means "someone paid a downpayment" from the colour alone. Spelling it out is
 * also what keeps the colour coding from being the only carrier of meaning.
 */
export function StatusLegend({ className = '' }: { className?: string }) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 ${className}`}
      aria-label="What the colours mean"
    >
      {LEGEND_STATES.map((state) => (
        <li key={state} className="flex items-center gap-1.5">
          <StatusDot state={state} size="sm" />
          <span>{displayFor(state).label}</span>
        </li>
      ))}
    </ul>
  )
}
