'use client'

import { useRef, useState } from 'react'
import {
  blockerMessage,
  canStartAt,
  isSelectableEnd,
  rangeLimitsFrom,
  type Slot,
} from '@/lib/domain/availability'
import { bookingMessage, messengerHref } from '@/lib/domain/messenger'
import { formatPesoCompact } from '@/lib/domain/money'
import { displayFor, type CalendarState } from '@/lib/domain/status'
import { formatHour, formatHourRange, type ManilaDate } from '@/lib/domain/time'

export interface TimePillsProps {
  date: ManilaDate
  slots: Slot[]
  minHours: number
  maxHours: number
  /** 0 until the owner sets pricing; the price line is then simply omitted. */
  rateCents: number
  facebookPage: string
}

/**
 * Hour pills for one day. Tap a pill for that hour, tap a later one to extend, or
 * press and drag across several. The domain module decides what can be selected,
 * so a range can never straddle a booked hour or break the min/max rules.
 *
 * Nothing is submitted here. The only action is the Messenger button, which is
 * inert until a time is chosen and then opens the chat with the booking typed
 * out. On phones -- where nearly all of this happens -- the button lives in a
 * fixed bar at the bottom so it is always a thumb away.
 */
export function TimePills({
  date,
  slots,
  minHours,
  maxHours,
  rateCents,
  facebookPage,
}: TimePillsProps) {
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ anchor: number; moved: boolean; last: number | null } | null>(null)

  const startable = (hour: number) => canStartAt(slots, hour, minHours, maxHours)

  /** Select from `a` to `b` inclusive, clipped to what is legal from the earlier hour. */
  function selectRange(a: number, b: number) {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const limits = rangeLimitsFrom(slots, lo, minHours, maxHours)
    if (limits.minEnd === null) return
    const wanted = Math.min(hi + 1, limits.maxEnd)
    setStart(lo)
    setEnd(isSelectableEnd(limits, lo, wanted) ? wanted : limits.minEnd)
  }

  function clear() {
    setStart(null)
    setEnd(null)
  }

  /** Which pill is under the pointer, if any. Works for mouse and touch alike. */
  function hourAt(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-hour]')
    if (!el || !gridRef.current?.contains(el)) return null
    return Number(el.dataset.hour)
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const hour = hourAt(e.clientX, e.clientY)
    if (hour === null || !startable(hour)) return
    drag.current = { anchor: hour, moved: false, last: hour }
    gridRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const hour = hourAt(e.clientX, e.clientY)
    if (hour === null || hour === d.last) return
    d.moved = true
    d.last = hour
    selectRange(d.anchor, hour)
  }

  function onPointerUp() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) return // the drag already set the range

    // A plain tap.
    const hour = d.anchor
    if (start !== null && end !== null) {
      if (hour === start) return clear()
      if (hour > start) return selectRange(start, hour) // extend or shrink to here
    }
    selectRange(hour, hour)
  }

  function onPointerCancel() {
    drag.current = null
  }

  const ready = start !== null && end !== null
  const hours = ready ? end - start : 0
  const href = ready ? messengerHref(facebookPage, bookingMessage(date, start, end)) : null

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          {ready ? 'TAP ANOTHER HOUR TO EXTEND, OR DRAG' : 'TAP OR DRAG YOUR HOURS'}
        </h2>

        <div
          ref={gridRef}
          role="group"
          aria-label="Available hours"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="grid touch-none select-none grid-cols-3 gap-2 sm:grid-cols-5"
        >
          {slots.map((slot) => (
            <Pill
              key={slot.hour}
              slot={slot}
              selected={ready && slot.hour >= start && slot.hour < end}
              isStart={slot.hour === start}
              startable={slot.state === 'free' && startable(slot.hour)}
            />
          ))}
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Bookings are {minHours === maxHours ? `${minHours}` : `${minHours}–${maxHours}`} hour
          {maxHours === 1 ? '' : 's'}. Tap your first hour again to clear.
        </p>
      </section>

      <section
        aria-live="polite"
        className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
      >
        {ready ? (
          <>
            <p className="font-semibold text-slate-900">
              {formatHourRange(start, end)}
              <span className="font-normal text-slate-500">
                {' '}
                · {hours} hour{hours === 1 ? '' : 's'}
              </span>
            </p>
            {rateCents > 0 && (
              <p className="mt-1 text-slate-700">
                Court {formatPesoCompact(hours * rateCents)}{' '}
                <span className="text-slate-500">
                  ({hours} × {formatPesoCompact(rateCents)}) — paddles extra if you need them
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-600">Pick your hours above, then message us.</p>
        )}
      </section>

      {/* Fixed thumb bar on phones; inline on wider screens. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto max-w-5xl">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0084FF] px-4 py-3 text-base font-semibold text-white hover:bg-[#0074e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0084FF]"
            >
              <MessengerIcon />
              Message us to book {formatHourRange(start!, end!)}
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md bg-slate-200 px-4 py-3 text-base font-semibold text-slate-500"
            >
              <MessengerIcon />
              Pick a time to message us
            </button>
          )}
          <p className="mt-1.5 text-center text-[11px] text-slate-500 md:text-left">
            Opens Messenger with your booking typed out. We confirm there.
          </p>
        </div>
      </div>
    </div>
  )
}

function Pill({
  slot,
  selected,
  isStart,
  startable,
}: {
  slot: Slot
  selected: boolean
  isStart: boolean
  startable: boolean
}) {
  const free = slot.state === 'free'
  const display = displayFor(slot.state as CalendarState)

  let look: string
  if (selected) {
    look = 'border-slate-900 bg-slate-900 text-white'
  } else if (free) {
    look = startable
      ? 'border-slate-300 bg-white text-slate-900 hover:border-slate-900'
      : 'border-slate-200 bg-white text-slate-400'
  } else {
    look = `${display.className} ${slot.state === 'closed' ? 'hatched' : ''} cursor-not-allowed`
  }

  const spoken = free
    ? `${formatHour(slot.hour)}${selected ? (isStart ? ', start of your booking' : ', in your booking') : ', open'}`
    : `${formatHour(slot.hour)}, ${display.description}`

  return (
    <button
      type="button"
      data-hour={free && startable ? slot.hour : undefined}
      disabled={!free}
      aria-pressed={selected}
      aria-label={spoken}
      title={free ? undefined : blockerMessage(slot.state)}
      className={`flex min-h-12 flex-col items-center justify-center rounded-full border px-3 py-2 text-sm font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed ${look}`}
    >
      <span>{formatHour(slot.hour).replace(':00', '')}</span>
      {!free && (
        <span aria-hidden="true" className="text-[10px] font-medium opacity-80">
          {slot.state === 'past' ? 'past' : display.label}
        </span>
      )}
    </button>
  )
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.15.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.99-.88a.8.8 0 0 1 .53-.04c.91.25 1.88.39 2.9.39 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75a.6.6 0 0 0 .72 0l3.16-2.4c.42-.32.97.18.69.63z" />
    </svg>
  )
}
