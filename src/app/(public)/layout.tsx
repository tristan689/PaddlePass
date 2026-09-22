import Link from 'next/link'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { signOut } from '@/lib/auth/actions'
import { getStaff } from '@/lib/auth/require-staff'

/**
 * Public shell.
 *
 * Deliberately almost no chrome. Customers land here from a Facebook link, inside
 * the in-app browser, which has no URL bar — so the page has to say what it is
 * immediately, and every navigation has to be a real route with working back.
 *
 * Customers have no accounts, so the only session that can exist here is a staff
 * one. When it does, the header offers the admin and a sign-out; otherwise just a
 * quiet way in for staff. `getStaff()` is a local JWT check for anonymous
 * visitors and costs them no database round trip.
 */
export default async function PublicLayout({ children }: LayoutProps<'/'>) {
  const staff = await getStaff()

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-slate-900">
            UNDEFEATED <span className="font-normal text-slate-500">Pickleball</span>
          </Link>

          {staff ? (
            <div className="flex items-center gap-3 text-sm">
              <Link
                href="/admin"
                className="font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline"
              >
                Admin
              </Link>
              <form action={signOut}>
                <input type="hidden" name="to" value="/" />
                <SubmitButton tone="secondary" size="sm" pendingLabel="…">
                  Sign out
                </SubmitButton>
              </form>
            </div>
          ) : (
            <Link href="/login" className="text-xs text-slate-400 hover:text-slate-700">
              Staff
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-500">
          Undefeated Fitness Center · Bookings are confirmed over Facebook Messenger.
        </div>
      </footer>
    </div>
  )
}
