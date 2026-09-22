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
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Sign in</h1>

          <div className="mt-4">
            <LoginForm next={next} linkError={linkError} />
          </div>

          <div className="my-6 flex items-center gap-3" role="separator" aria-label="or">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <GoogleSignIn next="/account" />
          <p className="mt-2 text-center text-xs text-slate-500">
            Players: keep your bookings in one place. We only use your name and email.
          </p>
        </section>

        <p className="text-center text-xs text-slate-500">
          <Link href="/" className="underline">
            ‹ Back to the calendar
          </Link>
        </p>
      </div>
    </main>
  )
}
