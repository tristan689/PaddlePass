'use client'

import { useActionState, useState } from 'react'
import {
  blockerMessage,
  canStartAt,
  isSelectableEnd,
  rangeLimitsFrom,
  type Slot,
} from '@/lib/domain/availability'
import { formatPesoCompact } from '@/lib/domain/money'
import { priceBooking } from '@/lib/domain/pricing'
import { displayFor, type CalendarState } from '@/lib/domain/status'
import { formatHour, formatHourRange } from '@/lib/domain/time'
import { submitBooking, type BookingFormState } from '@/app/(public)/book/actions'
import { SubmitButton } from '@/components/ui/SubmitButton'

export interface SlotPickerProps {
  date: string
  dateLabel: string
  slots: Slot[]
  minHours: number
  maxHours: number
  paddlesOwned: number
  rateCents: number
  paddleFeeCents: number
  downpaymentCents: number
  holdMinutes: number
}

const INITIAL: BookingFormState = {}

/**
 * Pick a start hour, then tap the last hour you want. The domain module decides
 * which buttons are live, so the picker can never offer a range that skips over a
 * booked hour or breaks the min/max rules -- the server would reject it, and an
 * error for something the UI invited is the one kind we refuse to show.
 *
 * The request form sits underneath, in the same <form>, so a customer on a phone
 * scrolls once and submits once.
 */
export function SlotPicker({
  date,
  dateLabel,
  slots,
  minHours,
  maxHours,
  paddlesOwned,
  rateCents,
  paddleFeeCents,
  downpaymentCents,
  holdMinutes,
}: SlotPickerProps) {
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [paddles, setPaddles] = useState(0)
  const [state, formAction] = useActionState(submitBooking, INITIAL)

  const limits = start === null ? null : rangeLimitsFrom(slots, start, minHours, maxHours)

  function beginAt(hour: number) {
    const l = rangeLimitsFrom(slots, hour, minHours, maxHours)
    if (l.minEnd === null) return
    setStart(hour)
    setEnd(l.minEnd)
  }

  function pick(hour: number) {
    if (start === null || limits === null || hour < start) {
      beginAt(hour)
      return
    }
    if (hour === start) {
      setStart(null)
      setEnd(null)
      return
    }
    // Tapping the last hour you want: extend, or shrink back to it.
    const candidateEnd = hour + 1
    if (isSelectableEnd(limits, start, candidateEnd)) {
      setEnd(candidateEnd)
      return
    }
    // Inside the current range but not a legal end (shorter than the minimum):
    // ignore. Beyond reach: treat as a fresh start.
    if (end !== null && hour < end) return
    beginAt(hour)
  }

  const hours = start !== null && end !== null ? end - start : 0
  const price = priceBooking({ hours, paddleCount: paddles, rateCents, paddleFeeCents })
  const ready = start !== null && end !== null

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="start_hour" value={start ?? ''} />
      <input type="hidden" name="end_hour" value={end ?? ''} />
      {paddlesOwned === 0 && <input type="hidden" name="paddle_count" value={0} />}

      <fieldset>
        <legend className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          {start === null ? 'TAP A START TIME' : 'TAP THE LAST HOUR YOU WANT'}
        </legend>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" role="group">
          {slots.map((slot) => {
            const selected = ready && slot.hour >= start! && slot.hour < end!
            const free = slot.state === 'free'

            let enabled = false
            if (free) {
              if (start === null || limits === null || slot.hour < start) {
                enabled = canStartAt(slots, slot.hour, minHours, maxHours)
              } else if (slot.hour === start) {
                enabled = true
              } else {
                enabled =
                  isSelectableEnd(limits, start, slot.hour + 1) ||
                  (end !== null && slot.hour < end)
              }
            }

            return (
              <HourButton
                key={slot.hour}
                slot={slot}
                selected={selected}
                enabled={enabled}
                isStart={slot.hour === start}
                onPick={() => pick(slot.hour)}
              />
            )
          })}
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Bookings are {minHours === maxHours ? `${minHours}` : `${minHours}–${maxHours}`} hour
          {maxHours === 1 ? '' : 's'}. Tap your start time again to clear it.
        </p>
      </fieldset>

      <section
        aria-live="polite"
        className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
      >
        {ready ? (
          <>
            <p className="font-semibold text-slate-900">
              {dateLabel} · {formatHourRange(start!, end!)}
            </p>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-slate-700">
              <dt>
                Court · {hours} hour{hours === 1 ? '' : 's'} × {formatPesoCompact(rateCents)}
              </dt>
              <dd className="text-right tabular-nums">{formatPesoCompact(price.courtCents)}</dd>
              {paddles > 0 && (
                <>
                  <dt>
                    Paddles · {paddles} × {formatPesoCompact(paddleFeeCents)}
                  </dt>
                  <dd className="text-right tabular-nums">
                    {formatPesoCompact(price.paddleCents)}
                  </dd>
                </>
              )}
              <dt className="mt-1 border-t border-slate-200 pt-1 font-semibold text-slate-900">
                Total
              </dt>
              <dd className="mt-1 border-t border-slate-200 pt-1 text-right font-semibold tabular-nums text-slate-900">
                {formatPesoCompact(price.totalCents)}
              </dd>
            </dl>
            {downpaymentCents > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                A downpayment of {formatPesoCompact(downpaymentCents)} reserves the slot once we
                confirm. Your request holds it for about {Math.round(holdMinutes / 60) || 1} hour
                {holdMinutes >= 90 ? 's' : ''}.
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-600">Pick a time above to see the price.</p>
        )}
      </section>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-semibold tracking-wider text-slate-500">
          YOUR DETAILS
        </legend>

        <Field label="Full name" name="customer_name" autoComplete="name" required maxLength={80} defaultValue={state.values?.customer_name} />
        <Field
          label="Mobile number"
          name="contact"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="09xx xxx xxxx"
          required
          maxLength={40}
          defaultValue={state.values?.contact}
        />
        <Field
          label="Facebook name"
          name="facebook_name"
          hint="Exactly as it appears on your profile, so we can find you on Messenger."
          required
          maxLength={80}
          defaultValue={state.values?.facebook_name}
        />

        {paddlesOwned > 0 && (
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Rent paddles</span>
            <select
              name="paddle_count"
              value={paddles}
              onChange={(e) => setPaddles(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {Array.from({ length: paddlesOwned + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n === 0
                    ? 'No, we have our own'
                    : `${n} paddle${n === 1 ? '' : 's'} · ${formatPesoCompact(n * paddleFeeCents)} flat`}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-800">
            Note <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <textarea
            name="note"
            rows={2}
            maxLength={500}
            defaultValue={state.values?.note}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </fieldset>

      {state.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <p>{state.error}</p>
          {state.refresh && (
            <a href={`/book/${date}`} className="mt-1 inline-block font-semibold underline">
              Reload the latest availability
            </a>
          )}
        </div>
      )}

      <SubmitButton size="lg" disabled={!ready} pendingLabel="Sending your request…">
        {ready ? `Request ${formatHourRange(start!, end!)}` : 'Pick a time to continue'}
      </SubmitButton>

      <p className="text-xs leading-relaxed text-slate-500">
        This sends a request, not a confirmed booking. We will confirm on Facebook Messenger.
      </p>
    </form>
  )
}

function HourButton({
  slot,
  selected,
  enabled,
  isStart,
  onPick,
}: {
  slot: Slot
  selected: boolean
  enabled: boolean
  isStart: boolean
  onPick: () => void
}) {
  const free = slot.state === 'free'
  const display = displayFor(slot.state as CalendarState)

  const base =
    'flex min-h-14 flex-col items-center justify-center rounded-lg border px-1 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900'

  let look: string
  if (selected) {
    look = 'border-slate-900 bg-slate-900 text-white'
  } else if (free) {
    look = enabled
      ? 'border-slate-300 bg-white text-slate-900 hover:border-slate-900'
      : 'border-slate-200 bg-white text-slate-400'
  } else {
    look = `${display.className} ${slot.state === 'closed' ? 'hatched' : ''} cursor-not-allowed`
  }

  const label = free
    ? `${formatHour(slot.hour)}${selected ? (isStart ? ', start of your booking' : ', in your booking') : ', open'}`
    : `${formatHour(slot.hour)}, ${display.description}`

  return (
    <button
      type="button"
      disabled={!enabled}
      aria-pressed={selected}
      aria-label={label}
      title={free ? undefined : blockerMessage(slot.state)}
      onClick={onPick}
      className={`${base} ${look} disabled:cursor-not-allowed`}
    >
      <span className="font-semibold leading-tight">{formatHour(slot.hour).replace(':00', '')}</span>
      {!free && (
        <span aria-hidden="true" className="mt-0.5 text-[10px] leading-none opacity-80">
          {slot.state === 'past' ? 'past' : display.label}
        </span>
      )}
    </button>
  )
}

function Field({
  label,
  hint,
  name,
  ...input
}: {
  label: string
  hint?: string
  name: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input
        name={name}
        type={input.type ?? 'text'}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        {...input}
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}
