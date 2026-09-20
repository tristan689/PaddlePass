import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { requireOwner } from '@/lib/auth/require-staff'
import { listStaff } from '@/lib/data/admin'
import { formatDateCompact, toManilaDate } from '@/lib/domain/time'
import { inviteStaff, setStaffActive, setStaffRole } from './actions'

export const dynamic = 'force-dynamic'

/**
 * The roster. Owner-only. There is no public sign-up: people get here by invite,
 * and they leave by being deactivated -- which takes effect on their next request,
 * not when their token expires.
 */
export default async function StaffPage() {
  const me = await requireOwner()
  const staff = await listStaff()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Staff</h1>
        <p className="text-sm text-slate-600">
          Owners can change settings and manage this list. Staff can take bookings and payments.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Since</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((m) => {
                const isMe = m.id === me.id
                return (
                  <tr key={m.id} className={m.active ? '' : 'text-slate-400'}>
                    <td className="px-3 py-2 font-medium">
                      {m.full_name}
                      {isMe && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
                    </td>
                    <td className="px-3 py-2 capitalize">{m.role}</td>
                    <td className="px-3 py-2">{m.active ? 'Active' : 'Deactivated'}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateCompact(toManilaDate(m.created_at.slice(0, 10)))}
                    </td>
                    <td className="px-3 py-2">
                      {!isMe && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionForm action={setStaffRole}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="role" value={m.role === 'owner' ? 'staff' : 'owner'} />
                            <SubmitButton tone="secondary" size="sm" pendingLabel="…">
                              {m.role === 'owner' ? 'Make staff' : 'Make owner'}
                            </SubmitButton>
                          </ActionForm>
                          <ActionForm action={setStaffActive}>
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="active" value={m.active ? 'false' : 'true'} />
                            <SubmitButton tone={m.active ? 'danger' : 'secondary'} size="sm" pendingLabel="…">
                              {m.active ? 'Deactivate' : 'Reactivate'}
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500">INVITE</h2>
          <ActionForm action={inviteStaff} resetOnSuccess className="space-y-3 text-sm">
            <label className="block">
              <span className="font-medium text-slate-800">Full name</span>
              <input
                name="full_name"
                required
                maxLength={80}
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="font-medium text-slate-800">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="font-medium text-slate-800">Role</span>
              <select
                name="role"
                defaultValue="staff"
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <SubmitButton pendingLabel="Sending…">Send invite</SubmitButton>
            <p className="text-xs text-slate-500">
              They receive an email link, set a password, and land in the admin.
            </p>
          </ActionForm>
        </section>
      </div>
    </div>
  )
}
