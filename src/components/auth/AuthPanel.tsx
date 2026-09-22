'use client'

import { useActionState, useState } from 'react'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { requestPasswordReset, signIn, signUp, type AuthState } from '@/lib/auth/actions'

export type AuthMode = 'choose' | 'signin' | 'signup'

const EMPTY: AuthState = {}

const input =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-base sm:text-sm'

/**
 * One card, three screens. The first asks the only question that matters --
 * do you have an account? -- and shows nothing else, so nobody is confronted
 * with a username field they do not have. Each form then offers Google first
 * and email/password beneath.
 */
export function AuthPanel({
  initialMode,
  next,
  linkError,
}: {
  initialMode: AuthMode
  next: string
  linkError: boolean
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [signInState, signInAction] = useActionState(signIn, EMPTY)
  const [signUpState, signUpAction] = useActionState(signUp, EMPTY)
  const [resetState, resetAction] = useActionState(requestPasswordReset, EMPTY)

  const customerNext = next.startsWith('/admin') ? '/account' : next

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {linkError && (
        <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          That link has expired or was already used. Sign in below, or request a fresh one.
        </p>
      )}

      {mode === 'choose' && (
        <div className="animate-rise">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Welcome</h1>
          <p className="mt-1 text-sm text-slate-600">Do you already have an account?</p>
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="rounded-md bg-slate-900 px-4 py-3 text-base font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Sign up
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">
            Players book faster with an account; staff sign in with their username.
          </p>
        </div>
      )}

      {mode === 'signin' && (
        <div className="animate-rise">
          <Heading title="Sign in" onBack={() => setMode('choose')} />

          <div className="mt-4">
            <GoogleSignIn next={customerNext} label="Continue with Google" />
          </div>
          <Separator />

          <form action={signInAction} className="space-y-3">
            <input type="hidden" name="next" value={next} />
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Email or username</span>
              <input
                name="login"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                className={input}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Password</span>
              <input name="password" type="password" autoComplete="current-password" required className={input} />
            </label>
            {signInState.error && <Alert>{signInState.error}</Alert>}
            <SubmitButton size="lg" pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
          </form>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Forgot your password?</summary>
            <form action={resetAction} className="mt-3 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Your email</span>
                <input name="email" type="email" autoComplete="email" required className={input} />
              </label>
              {resetState.error && <Alert>{resetState.error}</Alert>}
              {resetState.message && <Notice>{resetState.message}</Notice>}
              <SubmitButton tone="secondary" pendingLabel="Sending…">
                Email me a reset link
              </SubmitButton>
            </form>
          </details>

          <p className="mt-5 text-center text-sm text-slate-600">
            New here?{' '}
            <button type="button" onClick={() => setMode('signup')} className="font-semibold text-slate-900 underline">
              Sign up
            </button>
          </p>
        </div>
      )}

      {mode === 'signup' && (
        <div className="animate-rise">
          <Heading title="Sign up" onBack={() => setMode('choose')} />
          <p className="mt-1 text-sm text-slate-600">
            Keep your bookings in one place and join other players&apos; sessions.
          </p>

          <div className="mt-4">
            <GoogleSignIn next={customerNext} label="Sign up with Google" />
          </div>
          <Separator />

          {signUpState.message ? (
            <Notice>{signUpState.message}</Notice>
          ) : (
            <form action={signUpAction} className="space-y-3">
              <input type="hidden" name="next" value={next} />
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Your name</span>
                <input name="full_name" autoComplete="name" required maxLength={60} className={input} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Email</span>
                <input name="email" type="email" autoComplete="email" inputMode="email" required className={input} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Password</span>
                <input name="password" type="password" autoComplete="new-password" minLength={8} required className={input} />
                <span className="mt-1 block text-xs text-slate-500">At least 8 characters.</span>
              </label>
              {signUpState.error && <Alert>{signUpState.error}</Alert>}
              <SubmitButton size="lg" pendingLabel="Creating your account…">
                Create account
              </SubmitButton>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <button type="button" onClick={() => setMode('signin')} className="font-semibold text-slate-900 underline">
              Sign in
            </button>
          </p>
        </div>
      )}
    </section>
  )
}

function Heading({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        ‹
      </button>
      <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
    </div>
  )
}

function Separator() {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {children}
    </p>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {children}
    </p>
  )
}
