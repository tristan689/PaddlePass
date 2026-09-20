import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { requireStaff } from '@/lib/auth/require-staff'
import { listBlockedDates } from '@/lib/data/admin'
import { formatDateLong, toManilaDate, todayInManila } from '@/lib/domain/time'
import { addClosure, removeClosure } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Whole-day closures: holidays, resurfacing, private events. The public reason is
 * published on the calendar; the internal note never leaves this page.
 */
export default async function ClosuresPage() {
  await requireStaff() // pages render in parallel with the layout's gate
  const today = todayInManila()
  const closures = await listBlockedDates(today)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Closures</h1>
        <p className="text-sm text-slate-600">
          Days the court is shut. Customers see the public reason; the note stays here.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-2 text-xs font-semibold tracking-wider text-slate-500">
            UPCOMING
          </h2>
          {closures.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No upcoming closures.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {closures.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">
                      {formatDateLong(toManilaDate(c.blocked_date))}
                    </p>
                    <p className="text-slate-700">
                      {c.public_reason}
                      {c.internal_note && (
                        <span className="text-slate-500"> · {c.internal_note}</span>
                      )}
                    </p>
                  </div>
                  <ActionForm action={removeClosure}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton tone="secondary" size="sm" pendingLabel="…">
                      Reopen
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500">CLOSE A DAY</h2>
          <ActionForm action={addClosure} resetOnSuccess className="space-y-3 text-sm">
            <label className="block">
              <span className="font-medium text-slate-800">Date</span>
              <input
                type="date"
                name="blocked_date"
                min={today}
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="font-medium text-slate-800">Public reason</span>
              <input
                name="public_reason"
                defaultValue="Closed"
                maxLength={60}
                list="closure-reasons"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              />
              <datalist id="closure-reasons">
                <option value="Closed" />
                <option value="Holiday" />
                <option value="Maintenance" />
                <option value="Private event" />
              </datalist>
              <span className="mt-0.5 block text-xs text-slate-500">
                Shown on the public calendar. Keep it bland.
              </span>
            </label>
            <label className="block">
              <span className="font-medium text-slate-800">
                Internal note <span className="font-normal text-slate-500">(optional)</span>
              </span>
              <input
                name="internal_note"
                maxLength={300}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <SubmitButton pendingLabel="Saving…">Close this day</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  )
}
