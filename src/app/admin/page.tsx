import Link from 'next/link'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import {
  getDashboardMetrics,
  listBookingsOn,
  listPendingBookings,
} from '@/lib/data/admin'
import type { BookingRow } from '@/lib/data/types'
import { formatPesoCompact } from '@/lib/domain/money'
import {
  addDays,
  daysInMonth,
  firstOfMonth,
  formatDateLong,
  formatDateShort,
  formatMonthLong,
  formatRelative,
  formatTimeRange,
  monthOf,
  toManilaDate,
  todayInManila,
} from '@/lib/domain/time'
import { approveBooking, markArrived } from './actions'

export const dynamic = 'force-dynamic'

/**
 * The desk view: what needs a decision, who is playing today, how the month is
 * going. Everything actionable from here is a one-tap approve or arrival; anything
 * that needs a reason or an amount links through to the booking.
 */
export default async function AdminHome() {
  const today = todayInManila()
  const month = monthOf(today)
  const monthStart = firstOfMonth(month)
  const monthEnd = addDays(monthStart, daysInMonth(month) - 1)

  const [pending, todays, metrics] = await Promise.all([
    listPendingBookings(),
    listBookingsOn(today),
    getDashboardMetrics(monthStart, monthEnd),
  ])

  const utilisation =
    metrics.open_hours > 0 ? Math.round((metrics.booked_hours / metrics.open_hours) * 100) : 0

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{formatDateLong(today)}</h1>
          <p className="text-sm text-slate-600">
            {pending.length === 0
              ? 'No requests waiting.'
              : `${pending.length} request${pending.length === 1 ? '' : 's'} waiting for a decision.`}
          </p>
        </div>
        <Link
          href={`/?m=${month}`}
          className="text-sm text-slate-600 underline-offset-2 hover:underline"
          target="_blank"
        >
          Open the public calendar ↗
        </Link>
      </header>

      <section aria-labelledby="month-heading">
        <h2 id="month-heading" className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          {formatMonthLong(month)}
        </h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Collected" value={formatPesoCompact(metrics.collected_cents)} />
          <Stat label="Outstanding" value={formatPesoCompact(metrics.outstanding_cents)} />
          <Stat label="Bookings" value={String(metrics.booking_count)} />
          <Stat
            label="Court used"
            value={`${utilisation}%`}
            hint={`${Math.round(metrics.booked_hours)} of ${metrics.open_hours} open hours`}
          />
          <Stat label="No-shows" value={String(metrics.no_shows)} />
        </dl>
      </section>

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          REQUESTS TO CONFIRM
        </h2>
        {pending.length === 0 ? (
          <Empty>Nothing pending. New requests from the public calendar appear here.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {b.customer_name}{' '}
                    <span className="font-mono text-xs font-normal text-slate-500">{b.reference_code}</span>
                  </p>
                  <p className="text-slate-700">
                    {formatDateShort(toManilaDate(b.booking_date))} · {formatTimeRange(b.start_time, b.end_time)}
                    {b.paddle_count > 0 && ` · ${b.paddle_count} paddle${b.paddle_count === 1 ? '' : 's'}`}
                    {' · '}
                    <span className="font-medium">{formatPesoCompact(b.total_cents)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    FB: {b.facebook_name} · {b.contact} · asked {formatRelative(b.created_at)}
                    {b.hold_expires_at && (
                      <>
                        {' · '}
                        <span className={holdTone(b.hold_expires_at)}>
                          hold ends {formatRelative(b.hold_expires_at)}
                        </span>
                      </>
                    )}
                  </p>
                  {b.customer_note && (
                    <p className="mt-1 text-xs italic text-slate-600">“{b.customer_note}”</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ActionForm action={approveBooking}>
                    <input type="hidden" name="booking_id" value={b.id} />
                    <SubmitButton tone="success" size="sm" pendingLabel="Approving…">
                      Approve
                    </SubmitButton>
                  </ActionForm>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="today-heading">
        <h2 id="today-heading" className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          ON THE COURT TODAY
        </h2>
        {todays.length === 0 ? (
          <Empty>No bookings today.</Empty>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {todays.map((b) => (
              <TodayRow key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function TodayRow({ booking: b }: { booking: BookingRow }) {
  const canArrive =
    !b.checked_in_at && (b.status === 'approved' || b.status === 'downpayment' || b.status === 'paid')
  const balance = Math.max(0, b.total_cents - b.amount_paid_cents)

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
      <p className="w-36 shrink-0 font-semibold tabular-nums text-slate-900">
        {formatTimeRange(b.start_time, b.end_time)}
      </p>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">
          {b.customer_name}{' '}
          <span className="font-mono text-xs font-normal text-slate-500">{b.reference_code}</span>
        </p>
        <p className="text-xs text-slate-600">
          <StatusBadge status={b.status} />
          {balance > 0 && b.status !== 'pending' && (
            <span className="ml-2">balance {formatPesoCompact(balance)}</span>
          )}
          {b.checked_in_at && <span className="ml-2 text-emerald-700">✓ arrived</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {canArrive && (
          <ActionForm action={markArrived}>
            <input type="hidden" name="booking_id" value={b.id} />
            <SubmitButton tone="secondary" size="sm" pendingLabel="…">
              Arrived
            </SubmitButton>
          </ActionForm>
        )}
        <Link
          href={`/admin/bookings/${b.id}`}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
        >
          Details
        </Link>
      </div>
    </li>
  )
}

function holdTone(iso: string): string {
  const minutes = (new Date(iso).getTime() - Date.now()) / 60_000
  return minutes < 20 ? 'font-semibold text-red-700' : 'text-slate-500'
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{value}</dd>
      {hint && <dd className="text-[11px] text-slate-500">{hint}</dd>}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
      {children}
    </p>
  )
}
