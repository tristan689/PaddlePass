'use client'

import { useActionState } from 'react'
import { requestPasswordReset, signIn, type AuthState } from '@/lib/auth/actions'
import { SubmitButton } from '@/components/ui/SubmitButton'

const EMPTY: AuthState = {}

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action] = useActionState(signIn, EMPTY)
  const [resetState, resetAction] = useActionState(requestPasswordReset, EMPTY)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">Sign in</h1>

      {linkError && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          That link has expired or was already used. Sign in below, or request a fresh one.
        </p>
      )}

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="next" value={next} />

        <label className="block">
          <span className="text-sm font-medium text-slate-800">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-800">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {state.error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </p>
        )}

        <SubmitButton size="lg" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
          Forgot your password?
        </summary>
        <form action={resetAction} className="mt-3 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Your staff email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {resetState.error && (
            <p role="alert" className="text-sm text-red-700">
              {resetState.error}
            </p>
          )}
          {resetState.message && (
            <p role="status" className="text-sm text-emerald-700">
              {resetState.message}
            </p>
          )}
          <SubmitButton tone="secondary" pendingLabel="Sending…">
            Email me a reset link
          </SubmitButton>
        </form>
      </details>
    </div>
  )
}
