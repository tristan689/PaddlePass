'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Avatar } from './Avatar'

export interface UserMenuItem {
  href: string
  label: string
  /** Secondary line under the label. */
  hint?: string
}

/**
 * Avatar button in the header; tap it for a small menu of account links and
 * Sign out. Closes on outside tap, Escape, or choosing an item. Sign out is a
 * real <form> posting to the Server Action, so it works without JavaScript too.
 */
export function UserMenu({
  name,
  email,
  avatarUrl,
  items,
  signOutAction,
  signOutTo = '/',
}: {
  name: string
  email?: string
  avatarUrl?: string | null
  items: UserMenuItem[]
  signOutAction: (formData: FormData) => void | Promise<void>
  /** Where to land after signing out. */
  signOutTo?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account menu for ${name}`}
        className="flex items-center gap-1 rounded-full p-0.5 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <Avatar name={name} url={avatarUrl} size="md" className="ring-slate-200" />
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg animate-rise"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
            <Avatar name={name} url={avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
              {email && <p className="truncate text-xs text-slate-500">{email}</p>}
            </div>
          </div>

          <ul className="py-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
                >
                  {item.label}
                  {item.hint && <span className="block text-xs text-slate-500">{item.hint}</span>}
                </Link>
              </li>
            ))}
          </ul>

          <form action={signOutAction} className="border-t border-slate-100 p-1">
            <input type="hidden" name="to" value={signOutTo} />
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
