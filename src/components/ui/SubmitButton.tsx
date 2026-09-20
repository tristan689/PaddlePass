'use client'

import { useFormStatus } from 'react-dom'

const TONES = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900 disabled:bg-slate-400',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-slate-900 disabled:text-slate-400',
  danger:
    'border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:outline-red-700 disabled:text-red-300',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-700 disabled:bg-emerald-300',
} as const

/**
 * A submit button that knows when its form is in flight.
 *
 * `useFormStatus` reads the nearest <form>'s pending state, so this works inside
 * any form -- Server Component or Client -- without threading a prop through.
 * Disabling during submit is what stops a double-tap on a slow connection from
 * recording the same payment twice.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Saving…',
  tone = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...rest
}: {
  children: React.ReactNode
  pendingLabel?: string
  tone?: keyof typeof TONES
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'>) {
  const { pending } = useFormStatus()

  const sizing =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs'
      : size === 'lg'
        ? 'w-full px-4 py-3 text-base'
        : 'px-3.5 py-2 text-sm'

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${sizing} ${TONES[tone]} ${className}`}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}
