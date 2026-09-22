import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { getViewer } from '@/lib/auth/viewer'
import { listMyBookings } from '@/lib/data/customer'
import { formatPesoCompact } from '@/lib/domain/money'
import { balanceCents } from '@/lib/domain/pricing'
import { formatDateShort, formatTimeRange, toManilaDate } from '@/lib/domain/time'

export const metadata: Metadata = { title: 'My bookings — Undefeated Pickleball' }
export const dynamic = 'force-dynamic'

/**
 * A customer's own bookings. Rows arrive here only because staff tagged them
 * with this account's email; the RLS policy does the matching, so nothing on
 * this page could show someone else's history.
 */
export default async function AccountPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/login?next=/account')

  if (viewer.kind === 'staff') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">You are signed in as staff</h1>
        <p className="text-sm text-slate-600">
          Customer bookings live in the admin.{' '}
          <Link href="/admin" className="font-semibold underline">
            Open the admin
          </Link>
          .
        </p>
      </div>
    )
  }

  const bookings = await listMyBookings()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Hi, {viewer.name}</h1>
        <p className="text-sm text-slate-600">{viewer.email}</p>
      </header>

      <section aria-labelledby="my-bookings">
        <h2 id="my-bookings" className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          MY BOOKINGS
        </h2>

        {bookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Nothing here yet.</p>
            <p className="mt-1">
              When you book, your Messenger message is signed with{' '}
              <span className="font-mono text-xs">{viewer.email}</span> — staff use that to
              file the booking under your account, and it appears here.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open the calendar
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {bookings.map((b) => {
              const balance = balanceCents(b.total_cents, b.amount_paid_cents)
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {formatDateShort(toManilaDate(b.booking_date))} · {formatTimeRange(b.start_time, b.end_time)}
                    </p>
                    <p className="text-xs text-slate-600">
                      <span className="font-mono">{b.reference_code}</span>
                      {' · '}
                      {formatPesoCompact(b.total_cents)}
                      {balance > 0 && b.status !== 'pending' && ` · balance ${formatPesoCompact(balance)}`}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                  <Link
                    href={`/r/${b.reference_code}?t=${b.lookup_token}`}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Details
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
