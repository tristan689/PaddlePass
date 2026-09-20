'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS: Array<{ href: string; label: string; ownerOnly?: boolean }> = [
  { href: '/admin', label: 'Today' },
  { href: '/admin/bookings', label: 'Logbook' },
  { href: '/admin/closures', label: 'Closures' },
  { href: '/admin/settings', label: 'Settings', ownerOnly: true },
  { href: '/admin/staff', label: 'Staff', ownerOnly: true },
]

/** Horizontal nav; scrolls sideways on a phone rather than wrapping. */
export function AdminNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Admin sections"
      className="mx-auto max-w-6xl overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex gap-1">
        {LINKS.filter((l) => isOwner || !l.ownerOnly).map((link) => {
          const active =
            link.href === '/admin'
              ? pathname === '/admin'
              : pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
