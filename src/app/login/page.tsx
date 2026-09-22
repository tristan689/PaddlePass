import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthPanel, type AuthMode } from '@/components/auth/AuthPanel'
import { safeNextPath } from '@/lib/auth/redirect'
import { getViewer } from '@/lib/auth/viewer'

export const metadata: Metadata = { title: 'Sign in or sign up — Undefeated Pickleball' }
export const dynamic = 'force-dynamic'

/**
 * One door. The first screen only asks "sign in or sign up?"; the forms come
 * after. ?mode=signin|signup deep-links straight to a form. Anyone already
 * signed in is sent on to where they were going.
 */
/** The calendar (or the day they were on), asking the picker to open guest mode. */
function guestHref(next: string): string {
  const calendar = next === '/' || next.startsWith('/?') ? next : '/'
  return `${calendar}${calendar.includes('?') ? '&' : '?'}guest=1`
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const next = safeNextPath(params.next)
  const linkError = params.error === 'link'
  const mode: AuthMode =
    params.mode === 'signin' || params.mode === 'signup' ? params.mode : 'choose'

  const viewer = await getViewer()
  if (viewer?.kind === 'staff') redirect(next.startsWith('/admin') ? next : '/admin')
  if (viewer?.kind === 'customer') redirect(next.startsWith('/admin') ? '/account' : next)

  return (
    <main className="flex flex-1 items-start justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <Link href="/" className="text-sm font-bold tracking-tight text-slate-900">
            UNDEFEATED <span className="font-normal text-slate-500">Pickleball</span>
          </Link>
        </header>

        <AuthPanel initialMode={mode} next={next} linkError={linkError} />

        {/* No account needed to book: hand them straight back to the calendar day
            they came from, with the guest name step already open. */}
        <Link
          href={guestHref(next)}
          className="block rounded-md border border-dashed border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Book as a guest instead
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            Just your name — no account.
          </span>
        </Link>
      </div>
    </main>
  )
}
