import Link from 'next/link'
import { PinIcon, SocialLinks } from '@/components/social/SocialLinks'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { signOut } from '@/lib/auth/actions'
import { getStaff } from '@/lib/auth/require-staff'
import { BRAND_LINKS } from '@/lib/domain/links'

/**
 * Public shell.
 *
 * Deliberately little chrome. Customers land here from a Facebook link, inside the
 * in-app browser, which has no URL bar — so the page has to say what it is
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-slate-900">
            UNDEFEATED <span className="font-normal text-slate-500">Pickleball</span>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <a
              href={BRAND_LINKS.google}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <PinIcon />
              Find us
            </a>

            {staff ? (
              <>
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
              </>
            ) : (
              <Link href="/login" className="text-xs text-slate-400 hover:text-slate-700">
                Staff
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
          <div className="flex flex-wrap gap-2">
            <a
              href={BRAND_LINKS.google}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <PinIcon />
              Find us on Google
            </a>
            <a
              href={BRAND_LINKS.directions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Get directions
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Undefeated Fitness Center · Book by messaging us on Facebook.
            </p>
            <SocialLinks />
          </div>
        </div>
      </footer>
    </div>
  )
}
