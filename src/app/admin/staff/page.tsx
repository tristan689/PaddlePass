import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { requireOwner } from '@/lib/auth/require-staff'
import { listStaff, listStaffAllowlist } from '@/lib/data/admin'
import { formatDateCompact, toManilaDate } from '@/lib/domain/time'
import {
  allowStaffEmail,
  inviteStaff,
  revokeStaffEmail,
  setStaffActive,
  setStaffRole,
} from './actions'

export const dynamic = 'force-dynamic'

/**
 * The roster. Owner-only. There is no public sign-up into staff: people get here
 * by invite, by the bootstrap script, or by having their email pre-approved so
 * their first Google sign-in makes them staff. They leave by being deactivated,
 * which takes effect on their next request, not when their token expires.
 */
export default async function StaffPage() {
  const me = await requireOwner()
  const [staff, allowlist] = await Promise.all([listStaff(), listStaffAllowlist()])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Staff</h1>
        <p className="text-sm text-slate-600">
          Owners (super admins) can change settings and manage this list. Staff can take
          bookings and payments.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-3 py-2 text-xs font-semibold tracking-wider text-slate-500">
              ROSTER
            </h2>
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

          <section className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-3 py-2 text-xs font-semibold tracking-wider text-slate-500">
              PRE-APPROVED EMAILS
            </h2>
            <p className="px-3 pt-3 text-xs text-slate-500">
              Whoever signs in with one of these — with Google or a password — becomes staff at
              that role. This is how a Google account becomes an admin.
            </p>
            {allowlist.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">None yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {allowlist.map((a) => (
                  <li key={a.email} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{a.email}</p>
                      <p className="text-xs text-slate-500">
                        {a.full_name ?? '—'} · <span className="capitalize">{a.role}</span>
                      </p>
                    </div>
                    <ActionForm action={revokeStaffEmail}>
                      <input type="hidden" name="email" value={a.email} />
                      <SubmitButton tone="secondary" size="sm" pendingLabel="…">
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500">PRE-APPROVE AN EMAIL</h2>
            <ActionForm action={allowStaffEmail} resetOnSuccess className="space-y-3 text-sm">
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
                <span className="font-medium text-slate-800">
                  Name <span className="font-normal text-slate-500">(optional)</span>
                </span>
                <input
                  name="full_name"
                  maxLength={80}
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
                  <option value="owner">Owner (super admin)</option>
                </select>
              </label>
              <SubmitButton pendingLabel="Saving…">Pre-approve</SubmitButton>
              <p className="text-xs text-slate-500">
                Best for Google accounts. If they already signed in as a customer, they become
                staff immediately.
              </p>
            </ActionForm>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500">INVITE BY EMAIL</h2>
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
                  <option value="owner">Owner (super admin)</option>
                </select>
              </label>
              <SubmitButton tone="secondary" pendingLabel="Sending…">Send invite</SubmitButton>
              <p className="text-xs text-slate-500">
                Sends an email link; they set a password and land in the admin.
              </p>
            </ActionForm>
          </section>
        </aside>
      </div>
    </div>
  )
}
