import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { setPassword, setStaffEmail } from '@/lib/auth/actions'
import { STAFF_LOGIN_DOMAIN } from '@/lib/auth/login'
import { requireStaff } from '@/lib/auth/require-staff'
import { getViewer } from '@/lib/auth/viewer'

export const dynamic = 'force-dynamic'

/**
 * Where invite and reset links land once the session exists. Also the place to
 * change a password, and -- for username-only accounts -- to add a real email so
 * Google sign-in and password resets can reach them.
 */
export default async function AccountPage() {
  const staff = await requireStaff()
  const viewer = await getViewer()
  const email = viewer?.email ?? ''
  const usernameOnly = email.endsWith(`@${STAFF_LOGIN_DOMAIN}`)

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Your account</h1>
        <p className="text-sm text-slate-600">
          Signed in as <strong>{staff.fullName}</strong> ({staff.role}).
          {!usernameOnly && email && (
            <>
              {' '}
              <span className="text-slate-500">{email}</span>
            </>
          )}
        </p>
      </header>

      <section className={`rounded-lg border p-4 ${usernameOnly ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
        <h2 className="mb-1 text-xs font-semibold tracking-wider text-slate-500">EMAIL</h2>
        {usernameOnly ? (
          <p className="mb-3 text-sm text-amber-900">
            Your account is username-only (<span className="font-mono">{email.split('@')[0]}</span>).
            Add a real email so you can sign in with Google and reset your password if you forget it.
          </p>
        ) : (
          <p className="mb-3 text-sm text-slate-600">Change the email you sign in and get resets with.</p>
        )}
        <ActionForm action={setStaffEmail} className="space-y-3 text-sm">
          <label className="block">
            <span className="font-medium text-slate-800">Email address</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={usernameOnly ? '' : email}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <SubmitButton tone={usernameOnly ? 'primary' : 'secondary'} pendingLabel="Saving…">
            Save email
          </SubmitButton>
        </ActionForm>
      </section>

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
