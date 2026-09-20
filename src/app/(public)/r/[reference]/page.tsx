import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBookingByToken } from '@/lib/data/booking'
import { getSettings } from '@/lib/data/settings'
import { formatPesoCompact } from '@/lib/domain/money'
import { balanceCents } from '@/lib/domain/pricing'
import { normalizeReference } from '@/lib/domain/reference'
import { customerStatusFor } from '@/lib/domain/status'
import {
  formatDateLong,
  formatHourRange,
  formatInstantManila,
  formatRelative,
  toManilaDate,
} from '@/lib/domain/time'

/**
 * The customer's receipt: /r/UD-7K2MX?t=<token>
 *
 * This is the page they screenshot and the link they keep. Both halves of the URL
 * are required -- the reference is an identifier, the token is the authorisation --
 * and a mismatch renders the same 404 as a booking that never existed.
 */
export const dynamic = 'force-dynamic'

const TONE_CLASSES = {
  neutral: 'border-slate-300 bg-white text-slate-900',
  good: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  bad: 'border-slate-300 bg-slate-100 text-slate-700',
} as const

export default async function BookingStatusPage({
  params,
  searchParams,
}: PageProps<'/r/[reference]'>) {
  const { reference: rawReference } = await params
  const { t } = await searchParams
  const token = typeof t === 'string' ? t : ''
  const reference = normalizeReference(rawReference)
  if (!reference) notFound()

  const [booking, settings] = await Promise.all([
    getBookingByToken(reference, token),
    getSettings(),
  ])
  if (!booking) notFound()

  const status = customerStatusFor(booking.status)
  const date = toManilaDate(booking.booking_date)
  const balance = balanceCents(booking.total_cents, booking.amount_paid_cents)
  const awaitingMoney = booking.status === 'pending' || booking.status === 'approved'
  const holdActive = booking.status === 'pending' && booking.hold_expires_at

  const messengerText = `Hi! I requested booking ${booking.reference_code} for ${formatDateLong(
    date
  )}, ${formatHourRange(booking.start_hour, booking.end_hour)}.`
  const messengerHref = `https://m.me/${encodeURIComponent(
    settings.facebookPage
  )}?text=${encodeURIComponent(messengerText)}`

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header className="text-center">
        <p className="text-xs font-semibold tracking-wider text-slate-500">BOOKING REFERENCE</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-wide text-slate-900">
          {booking.reference_code}
        </p>
        <p className="mt-1 text-sm text-slate-600">Quote this when you message us.</p>
      </header>

      <section
        role="status"
        className={`rounded-lg border p-4 ${TONE_CLASSES[status.tone]}`}
      >
        <p className="font-semibold">{status.title}</p>
        <p className="mt-1 text-sm">{status.detail}</p>
        {holdActive && (
          <p className="mt-2 text-sm font-medium">
            Slot held until {formatInstantManila(booking.hold_expires_at!)} (
            {formatRelative(booking.hold_expires_at!)}).
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-slate-500">Name</dt>
          <dd className="font-medium text-slate-900">{booking.customer_name}</dd>

          <dt className="text-slate-500">Date</dt>
          <dd className="font-medium text-slate-900">{formatDateLong(date)}</dd>

          <dt className="text-slate-500">Time</dt>
          <dd className="font-medium text-slate-900">
            {formatHourRange(booking.start_hour, booking.end_hour)}
            <span className="font-normal text-slate-500">
              {' '}
              · {booking.end_hour - booking.start_hour} hour
              {booking.end_hour - booking.start_hour === 1 ? '' : 's'}
            </span>
          </dd>

          {booking.paddle_count > 0 && (
            <>
              <dt className="text-slate-500">Paddles</dt>
              <dd className="font-medium text-slate-900">{booking.paddle_count}</dd>
            </>
          )}

          <dt className="mt-2 border-t border-slate-200 pt-2 text-slate-500">Total</dt>
          <dd className="mt-2 border-t border-slate-200 pt-2 font-semibold tabular-nums text-slate-900">
            {formatPesoCompact(booking.total_cents)}
          </dd>

          <dt className="text-slate-500">Paid</dt>
          <dd className="tabular-nums text-slate-900">
            {formatPesoCompact(booking.amount_paid_cents)}
          </dd>

          <dt className="text-slate-500">Balance</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {formatPesoCompact(balance)}
          </dd>
        </dl>

        {awaitingMoney && settings.downpaymentCents > 0 && (
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Downpayment to reserve: <strong>{formatPesoCompact(settings.downpaymentCents)}</strong>{' '}
            via GCash or cash. We will send GCash details on Messenger.
          </p>
        )}
      </section>

      <a
        href={messengerHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center rounded-md bg-[#0084FF] px-4 py-3 text-base font-semibold text-white hover:bg-[#0074e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0084FF]"
      >
        Message us on Messenger
      </a>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        Keep this link — it is the only way to see this booking&apos;s status.{' '}
        <Link href="/" className="underline">
          Back to the calendar
        </Link>
      </p>
    </div>
  )
}
