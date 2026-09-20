import Link from 'next/link'

/**
 * Sits at the root so it also covers /r/<ref> with a wrong or missing token, where
 * "not found" is deliberately indistinguishable from "not yours".
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs font-semibold tracking-wider text-slate-500">404</p>
      <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
        We couldn&apos;t find that page.
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        If you followed a booking link, check that you copied the whole address — the
        part after <code className="rounded bg-slate-100 px-1">?t=</code> matters.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Go to the calendar
      </Link>
    </main>
  )
}
