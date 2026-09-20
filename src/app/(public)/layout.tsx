import Link from 'next/link'

/**
 * Public shell.
 *
 * Deliberately almost no chrome. Customers land here from a Facebook link, inside
 * the in-app browser, which has no URL bar — so the page has to say what it is
 * immediately, and every navigation has to be a real route with working back.
 */
export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-bold tracking-tight text-slate-900">
            UNDEFEATED <span className="font-normal text-slate-500">Pickleball</span>
          </Link>
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
