import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import { LoginForm } from '@/components/auth/LoginForm'
import { safeNextPath } from '@/lib/auth/redirect'
import { getViewer } from '@/lib/auth/viewer'

export const metadata: Metadata = { title: 'Sign in — Undefeated Pickleball' }
export const dynamic = 'force-dynamic'

/**
 * One door, two kinds of people. Customers continue with Google and land on their
 * bookings; staff use a username and password and land in the admin. Anyone
 * already signed in is sent straight on.
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const next = safeNextPath(params.next)
  const linkError = params.error === 'link'

  const viewer = await getViewer()
  if (viewer?.kind === 'staff') redirect(next.startsWith('/admin') ? next : '/admin')
  if (viewer?.kind === 'customer') redirect('/account')

  return (
    <main className="flex flex-1 items-start justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <Link href="/" className="text-sm font-bold tracking-tight text-slate-900">
            UNDEFEATED <span className="font-normal text-slate-500">Pickleball</span>
          </Link>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Players</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in to keep your bookings in one place. We only use your name and email.
          </p>
          <div className="mt-4">
            <GoogleSignIn next="/account" />
          </div>
        </section>

        <details className="group rounded-lg border border-slate-200 bg-white shadow-sm" open={next.startsWith('/admin')}>
          <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-slate-700 group-open:border-b group-open:border-slate-200">
            Staff sign in
          </summary>
          <div className="p-6 pt-4">
            <LoginForm next={next} linkError={linkError} />
          </div>
        </details>

        <p className="text-center text-xs text-slate-500">
          <Link href="/" className="underline">
            ‹ Back to the calendar
          </Link>
        </p>
      </div>
    </main>
  )
}
