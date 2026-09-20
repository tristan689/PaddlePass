import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { setPassword } from '@/lib/auth/actions'
import { requireStaff } from '@/lib/auth/require-staff'

export const dynamic = 'force-dynamic'

/**
 * Where invite and reset links land once the session exists. Also the place to
 * change a password later.
 */
export default async function AccountPage() {
  const staff = await requireStaff()

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your account</h1>
        <p className="text-sm text-slate-600">
          Signed in as <strong>{staff.fullName}</strong> ({staff.role}).
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-xs font-semibold tracking-wider text-slate-500">PASSWORD</h2>
        <p className="mb-3 text-sm text-slate-600">
          New here? Set a password now so you can sign in next time without a link.
        </p>
        <ActionForm action={setPassword} resetOnSuccess className="space-y-3 text-sm">
          <label className="block">
            <span className="font-medium text-slate-800">New password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <span className="mt-0.5 block text-xs text-slate-500">At least 10 characters.</span>
          </label>
          <label className="block">
            <span className="font-medium text-slate-800">Repeat it</span>
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
        </ActionForm>
      </section>
    </div>
  )
}
