import Link from 'next/link'
import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { requireStaff } from '@/lib/auth/require-staff'
import { getSettingsRow } from '@/lib/data/admin'
import { formatPesoCompact } from '@/lib/domain/money'
import { formatHour, isManilaDate, todayInManila } from '@/lib/domain/time'
import { createStaffBooking } from '../../actions'

export const dynamic = 'force-dynamic'

/**
 * Record a booking agreed on Messenger. It is born approved -- staff are the
 * confirmation -- and lands on its detail page, where the payment gets recorded
 * and the customer's status link can be copied into the chat.
 */
export default async function NewBookingPage({ searchParams }: PageProps<'/admin/bookings/new'>) {
  await requireStaff()
  const [params, s] = await Promise.all([searchParams, getSettingsRow()])

  const today = todayInManila()
  const requested = typeof params.date === 'string' ? params.date : ''
  const defaultDate = isManilaDate(requested) ? requested : today

  const starts = Array.from({ length: s.close_hour - s.open_hour }, (_, i) => s.open_hour + i)
  const ends = Array.from({ length: s.close_hour - s.open_hour }, (_, i) => s.open_hour + i + 1)

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <nav className="text-sm">
        <Link href="/admin/bookings" className="text-slate-600 hover:text-slate-900">
          ‹ Logbook
        </Link>
      </nav>

      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">New booking</h1>
        <p className="text-sm text-slate-600">
          For a customer you have confirmed with on Messenger. It is saved as approved; record
          the payment on the next screen.
        </p>
      </header>

      {s.rate_cents === 0 && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          The hourly rate is ₱0, so this booking will total ₱0. Set pricing in Settings first
          if money is changing hands.
        </p>
      )}

      <ActionForm action={createStaffBooking} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="font-medium text-slate-800">Date</span>
            <input
              type="date"
              name="date"
              defaultValue={defaultDate}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="font-medium text-slate-800">From</span>
            <select name="start_hour" defaultValue={s.open_hour} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {starts.map((h) => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-slate-800">To</span>
            <select name="end_hour" defaultValue={s.open_hour + 1} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {ends.map((h) => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="font-medium text-slate-800">Customer name</span>
          <input
            name="customer_name"
            required
            maxLength={80}
            autoComplete="off"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="font-medium text-slate-800">
              Facebook name <span className="font-normal text-slate-500">(optional)</span>
            </span>
            <input name="facebook_name" maxLength={80} autoComplete="off" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="font-medium text-slate-800">
              Mobile <span className="font-normal text-slate-500">(optional)</span>
            </span>
            <input name="contact" type="tel" maxLength={40} autoComplete="off" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
        </div>

        {s.paddles_owned > 0 ? (
          <label className="block">
            <span className="font-medium text-slate-800">Paddles to rent</span>
            <select name="paddle_count" defaultValue={0} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {Array.from({ length: s.paddles_owned + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : `${n} · ${formatPesoCompact(n * s.paddle_fee_cents)} flat`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="paddle_count" value={0} />
        )}

        <label className="block">
          <span className="font-medium text-slate-800">
            Note <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <textarea name="note" rows={2} maxLength={500} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>

        <p className="text-xs text-slate-500">
          {formatPesoCompact(s.rate_cents)}/hour. Closed days and the min/max-hours rules are not
          applied to staff bookings — only “no double booking” is.
        </p>

        <SubmitButton size="lg" pendingLabel="Saving…">Save booking</SubmitButton>
      </ActionForm>
    </div>
  )
}
