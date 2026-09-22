import { displayFor, type CalendarState, type StateDisplay } from '@/lib/domain/status'

/**
 * Colour + geometry swatch for one state. No glyph characters: the fill pattern
 * (dashed ring, half fill, solid, hatch) carries the meaning without colour, and
 * reads cleanly at 12px where a `◐` does not.
 */
const SWATCH: Record<StateDisplay['fill'], string> = {
  none: 'bg-white border-slate-300',
  dashed: 'bg-slot-pending border-dashed border-slate-400',
  outlined: 'bg-slot-pending border-slate-500',
  half: 'fill-half bg-white border-amber-500',
  full: 'bg-slot-paid border-emerald-600',
  hatched: 'hatched bg-slot-closed border-slate-300',
  faded: 'bg-white border-slate-200 opacity-50',
}

export function StatusDot({
  state,
  size = 'md',
  describe = true,
}: {
  state: CalendarState
  size?: 'sm' | 'md'
  /** Include the spoken description. Off when the parent already names the state. */
  describe?: boolean
}) {
  const display = displayFor(state)
  const box = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  return (
    <span className="inline-flex items-center">
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 rounded-full border-2 ${box} ${SWATCH[display.fill]}`}
      />
      {describe && <span className="sr-only">{display.description}</span>}
    </span>
  )
}
