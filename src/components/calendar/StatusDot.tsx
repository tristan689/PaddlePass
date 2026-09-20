import { displayFor, type CalendarState } from '@/lib/domain/status'

/**
 * One status swatch: colour + glyph + accessible label, from a single source.
 *
 * The glyph is what makes this work without colour -- printed in greyscale, or
 * seen by someone with deuteranopia, the shape still distinguishes the states.
 * `aria-hidden` on the visual part plus an sr-only sentence avoids a screen
 * reader announcing a meaningless bullet character.
 */
export function StatusDot({
  state,
  size = 'md',
}: {
  state: CalendarState
  size?: 'sm' | 'md'
}) {
  const display = displayFor(state)
  const box = size === 'sm' ? 'h-3.5 w-3.5 text-[9px]' : 'h-5 w-5 text-xs'

  return (
    <span className="inline-flex items-center">
      <span
        aria-hidden="true"
        className={[
          box,
          'inline-flex items-center justify-center rounded-full border font-bold leading-none',
          display.className,
          state === 'closed' ? 'hatched' : '',
        ].join(' ')}
      >
        {display.glyph}
      </span>
      <span className="sr-only">{display.description}</span>
    </span>
  )
}
