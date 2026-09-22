import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PaymentForm } from '@/components/admin/PaymentForm'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { ActionForm } from '@/components/ui/ActionForm'
import { CopyButton } from '@/components/ui/CopyButton'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { requireStaff } from '@/lib/auth/require-staff'
import { siteUrl } from '@/lib/supabase/env'
import {
  getBookingById,
  getSettingsRow,
  listPayments,
  listReschedules,
} from '@/lib/data/admin'
import type { BookingDetailRow, PaymentRow } from '@/lib/data/types'
import { formatPesoCompact } from '@/lib/domain/money'
import { balanceCents, overpaidCents, priceBooking } from '@/lib/domain/pricing'
import {
  formatDateCompact,
  formatDateLong,
  formatHour,
  formatInstantManila,
  formatTimeRange,
  hourOfTime,
  toManilaDate,
  todayInManila,
} from '@/lib/domain/time'
import { approveBooking, markArrived, releaseBooking, rescheduleBooking, voidPayment } from '../../actions'

export const dynamic = 'force-dynamic'

const METHOD_LABEL = { cash: 'Cash', gcash: 'GCash' } as const
const KIND_LABEL = { down_payment: 'Down payment', full_payment: 'Full payment' } as const

/**
 * Everything about one booking, and every action staff can take on it. The
 * actions offered depend on the lifecycle status; the database re-checks each one,
 * so a stale tab that still shows "Approve" gets a clear sentence, not a mess.
 */
export default async function BookingDetailPage({ params }: PageProps<'/admin/bookings/[id]'>) {
  await requireStaff() // pages render in parallel with the layout's gate
  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) notFound()

  const [payments, reschedules, settings] = await Promise.all([
    listPayments(id),
    listReschedules(id),
    getSettingsRow(),
  ])

  const today = todayInManila()
  const date = toManilaDate(booking.booking_date)
  const hours = hourOfTime(booking.end_time) - hourOfTime(booking.start_time)
  const price = priceBooking({
    hours,
    paddleCount: booking.paddle_count,
    rateCents: booking.rate_cents,
    paddleFeeCents: booking.paddle_fee_cents,
  })
  const balance = balanceCents(booking.total_cents, booking.amount_paid_cents)
  const overpaid = overpaidCents(booking.total_cents, booking.amount_paid_cents)
  const hasLiveDownpayment = payments.some((p) => p.kind === 'down_payment' && !p.voided_at)

  const s = booking.status
  const isPending = s === 'pending'
  const isLive = s === 'approved' || s === 'downpayment' || s === 'paid'
  const canPay = (isPending || isLive) && balance > 0
  const canArrive = isLive && !booking.checked_in_at
  const canMove = isPending || isLive
  const canNoShow = isLive && date <= today
  const customerLink = `${siteUrl()}/r/${booking.reference_code}?t=${booking.lookup_token}`

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/admin/bookings" className="text-slate-600 hover:text-slate-900">
          ‹ Logbook
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-500">{booking.reference_code}</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{booking.customer_name}</h1>
          <p className="mt-1 text-sm text-slate-700">
            {formatDateLong(date)} · {formatTimeRange(booking.start_time, booking.end_time)} · {hours} hour
            {hours === 1 ? '' : 's'}
          </p>
        </div>
        <StatusBadge status={s} className="text-sm" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Customer">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Mobile</dt>
              <dd>
                <a href={`tel:${booking.contact}`} className="text-slate-900 underline-offset-2 hover:underline">
                  {booking.contact}
                </a>
              </dd>
              <dt className="text-slate-500">Facebook</dt>
              <dd className="text-slate-900">{booking.facebook_name || '—'}</dd>
              {booking.customer_email && (
                <>
                  <dt className="text-slate-500">Account</dt>
                  <dd className="text-slate-900">{booking.customer_email}</dd>
                </>
              )}
              {booking.customer_note && (
                <>
                  <dt className="text-slate-500">Note</dt>
                  <dd className="italic text-slate-800">“{booking.customer_note}”</dd>
                </>
              )}
            </dl>
          </Card>

          <Card title="Charges">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
              <dt className="text-slate-700">
                Court · {hours} h × {formatPesoCompact(booking.rate_cents)}
              </dt>
              <dd className="text-right tabular-nums">{formatPesoCompact(price.courtCents)}</dd>
              {booking.paddle_count > 0 && (
                <>
                  <dt className="text-slate-700">
                    Paddles · {booking.paddle_count} × {formatPesoCompact(booking.paddle_fee_cents)} flat
                  </dt>
                  <dd className="text-right tabular-nums">{formatPesoCompact(price.paddleCents)}</dd>
                </>
              )}
              <dt className="border-t border-slate-200 pt-1 font-semibold">Total</dt>
              <dd className="border-t border-slate-200 pt-1 text-right font-semibold tabular-nums">
                {formatPesoCompact(booking.total_cents)}
              </dd>
              <dt className="text-slate-700">Paid</dt>
              <dd className="text-right tabular-nums">{formatPesoCompact(booking.amount_paid_cents)}</dd>
              <dt className="font-semibold">Balance</dt>
              <dd className={`text-right font-semibold tabular-nums ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {formatPesoCompact(balance)}
              </dd>
            </dl>
            {overpaid > 0 && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Overpaid by {formatPesoCompact(overpaid)}. Check the ledger below.
              </p>
            )}
          </Card>

          <Card title="Payments">
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <PaymentLine key={p.id} payment={p} />
                ))}
              </ul>
            )}
          </Card>

          <Card title="History">
            <ol className="space-y-1.5 text-sm text-slate-700">
              <li>
                <Time iso={booking.created_at} /> — requested
                {booking.created_by ? ' by staff' : ' from the public calendar'}
              </li>
              {booking.approved_at && (
                <li>
                  <Time iso={booking.approved_at} /> — approved
                  {booking.approver?.full_name && ` by ${booking.approver.full_name}`}
                </li>
              )}
              {reschedules.map((r) => (
                <li key={r.id}>
                  <Time iso={r.created_at} /> — moved from{' '}
                  {formatDateCompact(toManilaDate(r.from_date))} {formatTimeRange(r.from_start_time, r.from_end_time)} to{' '}
                  {formatDateCompact(toManilaDate(r.to_date))} {formatTimeRange(r.to_start_time, r.to_end_time)}
                  {r.reason && ` (${r.reason})`}
                  {r.mover?.full_name && ` by ${r.mover.full_name}`}
                </li>
              ))}
              {booking.checked_in_at && (
                <li>
                  <Time iso={booking.checked_in_at} /> — customer arrived
                </li>
              )}
              {booking.resolution_note && (
                <li>
                  <span className="text-slate-500">Resolution:</span> {booking.resolution_note}
                </li>
              )}
              {booking.status === 'expired' && <li>Hold expired before confirmation.</li>}
            </ol>
          </Card>
        </div>

        <aside className="space-y-4">
          {(isPending || isLive) && (
            <Card title="Customer link">
              <p className="mb-2 text-xs text-slate-600">
                Paste this into the Messenger chat. It shows their status, total and balance —
                nothing else, and only with this exact link.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={customerLink}
                  aria-label="Customer status link"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700"
                />
                <CopyButton text={customerLink} />
              </div>
            </Card>
          )}

          {isPending && (
            <Card title="Decide">
              <ActionForm action={approveBooking} className="mb-3">
                <input type="hidden" name="booking_id" value={booking.id} />
                <SubmitButton tone="success" className="w-full" pendingLabel="Approving…">
                  Approve request
                </SubmitButton>
              </ActionForm>
              <ReleaseForm bookingId={booking.id} status="declined" label="Decline request" />
            </Card>
          )}

          {canPay && (
            <Card title={isPending ? 'Record payment (and approve)' : 'Record payment'}>
              <PaymentForm
                bookingId={booking.id}
                isPending={isPending}
                balanceCents={balance}
                downpaymentCents={settings.downpayment_cents}
                hasLiveDownpayment={hasLiveDownpayment}
                today={today}
              />
            </Card>
          )}

          {canArrive && (
            <Card title="At the court">
              <ActionForm action={markArrived}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <SubmitButton tone="secondary" className="w-full" pendingLabel="…">
                  Customer has arrived
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          {canMove && (
            <Card title="Move to another slot">
              <RescheduleForm booking={booking} openHour={settings.open_hour} closeHour={settings.close_hour} />
            </Card>
          )}

          {isLive && (
            <Card title="Release the slot">
              <div className="space-y-4">
                <ReleaseForm bookingId={booking.id} status="cancelled" label="Cancel booking" />
                {canNoShow && (
                  <ReleaseForm bookingId={booking.id} status="no_show" label="Mark as no-show" optionalReason />
                )}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}

function ReleaseForm({
  bookingId,
  status,
  label,
  optionalReason = false,
}: {
  bookingId: string
  status: 'declined' | 'cancelled' | 'no_show'
  label: string
  optionalReason?: boolean
}) {
  return (
    <details className="rounded-md border border-slate-200 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-red-700">{label}…</summary>
      <ActionForm action={releaseBooking} className="mt-3 space-y-2">
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="status" value={status} />
        <label className="block">
          <span className="text-slate-800">
            Reason {optionalReason && <span className="text-slate-500">(optional)</span>}
          </span>
          <input
            name="reason"
            maxLength={300}
            required={!optionalReason}
            list={`reasons-${status}`}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <datalist id={`reasons-${status}`}>
            {status === 'declined' && (
              <>
                <option value="No reply on Messenger" />
                <option value="Court unavailable" />
                <option value="Duplicate request" />
              </>
            )}
            {status === 'cancelled' && (
              <>
                <option value="Customer request" />
                <option value="Rain" />
                <option value="Court issue" />
              </>
            )}
          </datalist>
        </label>
        <SubmitButton tone="danger" pendingLabel="Saving…">
          {label}
        </SubmitButton>
      </ActionForm>
    </details>
  )
}

function RescheduleForm({
  booking,
  openHour,
  closeHour,
}: {
  booking: BookingDetailRow
  openHour: number
  closeHour: number
}) {
  const starts = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i)
  const ends = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i + 1)

  return (
    <ActionForm action={rescheduleBooking} className="space-y-2 text-sm">
      <input type="hidden" name="booking_id" value={booking.id} />
      <label className="block">
        <span className="text-slate-800">New date</span>
        <input
          type="date"
          name="date"
          defaultValue={booking.booking_date}
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-slate-800">From</span>
          <select
            name="start_hour"
            defaultValue={hourOfTime(booking.start_time)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {starts.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-slate-800">To</span>
          <select
            name="end_hour"
            defaultValue={hourOfTime(booking.end_time)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {ends.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-slate-800">
          Reason <span className="text-slate-500">(optional)</span>
        </span>
        <input
          name="reason"
          maxLength={200}
          list="move-reasons"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <datalist id="move-reasons">
          <option value="Rain" />
          <option value="Customer request" />
          <option value="Court issue" />
        </datalist>
      </label>
      <p className="text-xs text-slate-500">
        Closed days and the min/max rules are not re-checked for a move — only “no double
        booking” is.
      </p>
      <SubmitButton tone="secondary" pendingLabel="Moving…">
        Move booking
      </SubmitButton>
    </ActionForm>
  )
}

function PaymentLine({ payment: p }: { payment: PaymentRow }) {
  const voided = Boolean(p.voided_at)
  return (
    <li className={`py-2 text-sm ${voided ? 'text-slate-400' : 'text-slate-800'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className={voided ? 'line-through' : ''}>
          {formatDateCompact(toManilaDate(p.paid_on))} · {KIND_LABEL[p.kind]} · {METHOD_LABEL[p.method]}
          {p.external_ref && <span className="font-mono text-xs"> · {p.external_ref}</span>}
        </span>
        <span className={`font-semibold tabular-nums ${voided ? 'line-through' : ''}`}>
          {formatPesoCompact(p.amount_cents)}
        </span>
      </div>
      <div className="text-xs">
        received by {p.receiver?.full_name ?? 'staff'}
        {p.note && ` · ${p.note}`}
        {voided && (
          <>
            {' · '}
            <span className="text-red-700">
              voided {p.voided_at && formatInstantManila(p.voided_at)}
              {p.voider?.full_name && ` by ${p.voider.full_name}`}
              {p.void_reason && `: ${p.void_reason}`}
            </span>
          </>
        )}
      </div>
      {!voided && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-red-700">Void this payment…</summary>
          <ActionForm action={voidPayment} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="payment_id" value={p.id} />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Reason</span>
              <input
                name="reason"
                required
                maxLength={200}
                placeholder="Why? (kept in the ledger)"
                className="block w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              />
            </label>
            <SubmitButton tone="danger" size="sm" pendingLabel="Voiding…">
              Void
            </SubmitButton>
          </ActionForm>
        </details>
      )}
    </li>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500">{title.toUpperCase()}</h2>
      {children}
    </section>
  )
}

function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} className="tabular-nums text-slate-500">
      {formatInstantManila(iso)}
    </time>
  )
}
