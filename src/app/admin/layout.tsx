import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminNav } from '@/components/admin/AdminNav'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { signOut } from '@/lib/auth/actions'
import { requireStaff } from '@/lib/auth/require-staff'

export const metadata: Metadata = { title: 'Admin — PaddlePass' }

/**
 * Admin shell. `requireStaff()` here is the second gate after the proxy redirect
 * and, unlike the proxy, checks the live `active` flag -- a deactivated staffer is
 * out on their very next request. Every Server Action checks it again.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const staff = await requireStaff()

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="text-sm font-bold tracking-tight text-slate-900">
            UNDEFEATED <span className="font-normal text-slate-500">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/admin/account"
              className="hidden text-slate-600 hover:text-slate-900 sm:inline"
            >
              {staff.fullName}
              <span className="text-slate-400"> · {staff.role}</span>
            </Link>
            <form action={signOut}>
              <SubmitButton tone="secondary" size="sm" pendingLabel="…">
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
        <AdminNav isOwner={staff.role === 'owner'} />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
    </div>
  )
}
