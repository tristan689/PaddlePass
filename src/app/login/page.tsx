import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { signOut } from '@/lib/auth/actions'
import { safeNextPath } from '@/lib/auth/redirect'
import { getStaff } from '@/lib/auth/require-staff'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Staff sign in — PaddlePass' }
export const dynamic = 'force-dynamic'

/**
 * Staff sign-in.
 *
 * Three states, decided here rather than in the proxy so they cannot loop:
 *   - not signed in            -> the form
 *   - signed in, active staff  -> straight to where they were going
 *   - signed in, NOT staff     -> say so, offer sign-out
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const next = safeNextPath(params.next)
  const linkError = params.error === 'link'

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  if (signedIn) {
    const staff = await getStaff()
    if (staff) redirect(next)
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <p className="text-sm font-bold tracking-tight text-slate-900">
            UNDEFEATED <span className="font-normal text-slate-500">Pickleball · Staff</span>
          </p>
        </header>

        {signedIn ? <NotStaff /> : <LoginForm next={next} linkError={linkError} />}

        <p className="text-center text-xs text-slate-500">
          <Link href="/" className="underline">
            ‹ Public calendar
          </Link>
        </p>
      </div>
    </main>
  )
}

function NotStaff() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">This account is not on the staff roster.</p>
      <p className="mt-1">
        You are signed in, but the owner has not added you as active staff — or has
        deactivated you. Ask them to check the Staff page, then sign in again.
      </p>
      <form action={signOut} className="mt-4">
        <SubmitButton tone="secondary" pendingLabel="Signing out…">
          Sign out
        </SubmitButton>
      </form>
    </div>
  )
}
