'use client'

import { useRef, useState } from 'react'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import {
  blockerMessage,
  canStartAt,
  isSelectableEnd,
  rangeLimitsFrom,
  type Slot,
} from '@/lib/domain/availability'
import { bookingMessage, messengerHref, type MessageCustomer } from '@/lib/domain/messenger'
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
  /** Signed-in customer, so the message can be signed with their name and email. */
  customer?: MessageCustomer | null
  /** Open the guest name step straight away (arrived via "Book as a guest instead"). */
  initialGuest?: boolean
}

/**
 * Hour pills for one day. Tap a pill for that hour, tap a later one to extend,
 * or press and drag across several. The domain module decides what can be
 * selected, so a range can never straddle a booked hour or break the min/max
 * rules.
 *
 * Taps are plain click events -- the most reliable input on every phone browser.
 * Drag is layered on with pointer events and deliberately does NOT take pointer
 * capture: capture stops the click from being generated on some mobile browsers,
 * and touch pointers are implicitly captured to their first target anyway.
 *
 * Nothing is submitted here. The only action is the Messenger button, which
 * appears inside the summary once a time is chosen and opens the chat with the
 * booking typed out.
 */
export function TimePills({
  date,
  slots,
  minHours,
  maxHours,
  rateCents,
  facebookPage,
  customer = null,
  initialGuest = false,
}: TimePillsProps) {
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  // Guest flow: "Book as guest" reveals a name field; the name is remembered on
  // this device so a regular does not retype it every visit. The field is not in
  // the server-rendered tree (nothing is selected yet), so reading storage in the
  // initializer cannot cause a hydration mismatch.
  const [guestMode, setGuestMode] = useState(initialGuest)
  const [guestName, setGuestName] = useState(() => {
    if (!initialGuest || typeof window === 'undefined') return ''
    try {
      return localStorage.getItem(GUEST_NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })

  function startGuest() {
    try {
      const saved = localStorage.getItem(GUEST_NAME_KEY)
      if (saved) setGuestName(saved)
    } catch {
      // Storage blocked (private mode): they simply type it.
    }
    setGuestMode(true)
  }
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ anchor: number; moved: boolean; last: number } | null>(null)
  const swallowNextClick = useRef(false)

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

  /** A tap on a pill. */
  function tap(hour: number) {
    if (swallowNextClick.current) {
      // The click that trails a drag; the drag already set the range.
      swallowNextClick.current = false
      return
    }
    if (!startable(hour)) return
    if (start !== null && end !== null) {
      if (hour === start) return clear()
      if (hour > start) return selectRange(start, hour) // extend, or shrink back to here
    }
    selectRange(hour, hour)
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

  function endDrag() {
    const d = drag.current
    drag.current = null
    if (d?.moved) {
      // The browser fires `click` right after `pointerup`; let tap() ignore it,
      // and clear the flag on the next tick in case no click follows at all.
      swallowNextClick.current = true
      setTimeout(() => {
        swallowNextClick.current = false
      }, 0)
    }
  }

  const ready = start !== null && end !== null
  const hours = ready ? end - start : 0

  // The hour right after the selection, if it can legally be added. It gets the
  // nudge animation and is named in the hint, so "you can make this longer" is
  // shown rather than explained.
  const nextHour =
    ready && isSelectableEnd(rangeLimitsFrom(slots, start, minHours, maxHours), start, end + 1)
      ? end
      : null

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Pick your hours</h2>
          <p className="text-xs text-slate-500">
            {ready ? 'Tap the next hour to extend, or drag.' : 'Tap an hour, or drag across several.'}
          </p>
        </div>

        <div
          ref={gridRef}
          role="group"
          aria-label="Available hours"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
          className="grid touch-none select-none grid-cols-3 gap-2 sm:grid-cols-5"
        >
          {slots.map((slot) => (
            <Pill
              key={slot.hour}
              slot={slot}
              selected={ready && slot.hour >= start && slot.hour < end}
              isStart={slot.hour === start}
              startable={slot.state === 'free' && startable(slot.hour)}
              nudge={slot.hour === nextHour}
              onTap={() => tap(slot.hour)}
            />
          ))}
        </div>

        {ready ? (
          // Keyed on the selection so the hint re-animates each time it changes.
          <p key={`${start}-${end}`} className="mt-3 text-xs leading-relaxed text-slate-600 animate-rise">
            <span aria-hidden="true" className="mr-1.5 text-sm leading-none">↔</span>
            {nextHour !== null ? (
              <>
                Adjust your time: tap <strong>{pillLabel(nextHour)}</strong> to extend, or tap{' '}
                <strong>{pillLabel(start)}</strong> again to clear.
              </>
            ) : (
              <>That&apos;s as long as this slot can go. Tap <strong>{pillLabel(start)}</strong> again to clear.</>
            )}
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Bookings are {minHours === maxHours ? `${minHours}` : `${minHours}–${maxHours}`} hour
            {maxHours === 1 ? '' : 's'}. Each pill is one hour.
          </p>
        )}
      </section>

      <section
        aria-live="polite"
        className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
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
            {customer ? (
              <MessengerButton
                href={messengerHref(facebookPage, bookingMessage(date, start, end, customer))}
                range={formatHourRange(start, end)}
                as={customer.name}
              />
            ) : guestMode ? (
              <div className="mt-3 space-y-2 animate-rise">
                <label className="block">
                  <span className="text-sm font-medium text-slate-800">Your name</span>
                  <input
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value)
                      try {
                        localStorage.setItem(GUEST_NAME_KEY, e.target.value)
                      } catch {
                        // fine without it
                      }
                    }}
                    autoFocus
                    autoComplete="name"
                    maxLength={80}
                    placeholder="So we know who's booking"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                {guestName.trim().length >= 2 ? (
                  <MessengerButton
                    href={messengerHref(facebookPage, bookingMessage(date, start, end, { name: guestName }))}
                    range={formatHourRange(start, end)}
                    as={guestName.trim()}
                  />
                ) : (
                  <p className="text-xs text-slate-500">Enter your name to continue to Messenger.</p>
                )}
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 animate-rise">
                <button
                  type="button"
                  onClick={startGuest}
                  className="flex w-full items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Book as guest
                </button>
                <GoogleSignIn next={`/?view=day&d=${date}`} label="Sign in with Google" tone="compact" />
              </div>
            )}
          </>
        ) : (
          <p className="text-slate-600">Pick your hours above, then message us.</p>
        )}
      </section>
    </div>
  )
}

const GUEST_NAME_KEY = 'paddlepass.guestName'

function MessengerButton({ href, range, as }: { href: string; range: string; as: string }) {
  return (
    <div className="mt-3 animate-rise">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0084FF] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0074e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0084FF] sm:text-base"
      >
        <MessengerIcon />
        <span>
          Message us to book <span className="whitespace-nowrap">{range}</span>
        </span>
      </a>
      <p className="mt-1.5 text-center text-xs text-slate-500">Booking as {as}</p>
    </div>
  )
}

/** `15` -> `"3 – 4 PM"`, `23` -> `"11 PM – 12 AM"`: the hour block a pill stands for. */
function pillLabel(hour: number): string {
  return formatHourRange(hour, hour + 1).replace(/:00/g, '')
}

function Pill({
  slot,
  selected,
  isStart,
  startable,
  nudge,
  onTap,
}: {
  slot: Slot
  selected: boolean
  isStart: boolean
  startable: boolean
  /** Breathe a ring for a moment: this is the hour that would extend the booking. */
  nudge: boolean
  onTap: () => void
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
    ? `${pillLabel(slot.hour)}${selected ? (isStart ? ', start of your booking' : ', in your booking') : ', open'}`
    : `${formatHour(slot.hour)}, ${display.description}`

  return (
    <button
      type="button"
      data-hour={free ? slot.hour : undefined}
      disabled={!free}
      aria-pressed={selected}
      aria-label={spoken}
      title={free ? undefined : blockerMessage(slot.state)}
      onClick={onTap}
      className={`flex min-h-12 flex-col items-center justify-center rounded-full border px-3 py-2 text-sm font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed ${look} ${
        nudge ? 'animate-nudge border-slate-900' : ''
      }`}
    >
      <span>{pillLabel(slot.hour)}</span>
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
