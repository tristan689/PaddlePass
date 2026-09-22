import { displayFor, LEGEND_STATES } from '@/lib/domain/status'
import { StatusDot } from './StatusDot'

/**
 * The key to the calendar, as a row of chips.
 *
 * Not decoration: with five states in play, a customer cannot infer that yellow
 * means "reserved, downpayment still to come" from the colour alone. Each chip
 * carries the swatch, the word, and the full sentence for hover and screen readers.
 */
export function StatusLegend({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="What the colours mean">
      {LEGEND_STATES.map((state) => {
        const display = displayFor(state)
        return (
          <li
            key={state}
            title={display.description}
            aria-label={display.description}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <StatusDot state={state} size="sm" describe={false} />
            {display.label}
          </li>
        )
      })}
    </ul>
  )
}
