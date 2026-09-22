import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { ActionForm } from '@/components/ui/ActionForm'
import { Avatar } from '@/components/ui/Avatar'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { getViewer } from '@/lib/auth/viewer'
import { listMyBookings } from '@/lib/data/customer'
import { formatPesoCompact } from '@/lib/domain/money'
import { balanceCents } from '@/lib/domain/pricing'
import { formatDateShort, formatTimeRange, toManilaDate } from '@/lib/domain/time'
import { updateProfile } from './actions'

export const metadata: Metadata = { title: 'My account — Undefeated Pickleball' }
export const dynamic = 'force-dynamic'

/**
 * A member's own corner: the name and photo other players see, whether to show
 * on the calendar at all, and their bookings. Rows arrive here only because
 * staff tagged them with this account's email; the RLS policy does the matching.
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
      <header className="flex items-center gap-4">
        <Avatar name={viewer.name} url={viewer.avatarUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{viewer.name}</h1>
          <p className="truncate text-sm text-slate-600">{viewer.email}</p>
        </div>
      </header>

      <section aria-labelledby="profile-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="profile-heading" className="mb-3 text-xs font-semibold tracking-wider text-slate-500">
          YOUR PROFILE
        </h2>
        <ActionForm action={updateProfile} className="space-y-4 text-sm">
          <label className="block">
            <span className="font-medium text-slate-800">Name other players see</span>
            <input
              name="display_name"
              defaultValue={viewer.name}
              required
              maxLength={60}
              autoComplete="nickname"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="font-medium text-slate-800">Photo</span>
            <input
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-900 hover:file:bg-slate-50"
            />
            <span className="mt-1 block text-xs text-slate-500">JPG, PNG or WebP, up to 2 MB. Square photos look best.</span>
          </label>

          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              name="show_on_calendar"
              defaultChecked={viewer.showOnCalendar}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-slate-800">Show me on the calendar</span>
              <span className="mt-0.5 block text-xs text-slate-600">
                Other players see your name and photo on sessions you booked or joined, and can join
                yours. Turn this off to book like a guest — just “Booked”, no name.
              </span>
            </span>
          </label>

          <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
        </ActionForm>
      </section>

      <section aria-labelledby="my-bookings">
        <h2 id="my-bookings" className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          MY BOOKINGS
        </h2>

        {bookings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Nothing here yet.</p>
            <p className="mt-1">
              When you book, your Messenger message is signed with{' '}
              <span className="font-mono text-xs">{viewer.email}</span> — staff use that to file the
              booking under your account, and it appears here.
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
