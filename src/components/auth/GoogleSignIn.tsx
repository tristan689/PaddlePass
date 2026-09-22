'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * "Continue with Google" for customers. Supabase redirects back to /auth/confirm
 * with a PKCE code; the code verifier travels in a cookie the server client can
 * read, so the session lands server-side and `next` is honoured.
 *
 * Before navigating, the authorize URL is probed. When the provider is not
 * enabled Supabase answers 400 with JSON -- which, if the browser had been sent
 * there directly, is the whole page the person would see. The probe turns that
 * into a sentence here instead.
 */
export function GoogleSignIn({
  next = '/account',
  label = 'Continue with Google',
  tone = 'default',
}: {
  next?: string
  label?: string
  tone?: 'default' | 'compact'
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        skipBrowserRedirect: true,
      },
    })
    if (error || !data.url) {
      setError(error?.message ?? 'Could not start Google sign-in.')
      setBusy(false)
      return
    }

    try {
      // Enabled: an opaque redirect (status 0). Disabled: a readable 400.
      const probe = await fetch(data.url, { redirect: 'manual' })
      if (probe.status === 400) {
        setError('Google sign-in is not switched on yet. You can still book as a guest, or message us on Facebook.')
        setBusy(false)
        return
      }
    } catch {
      // Probe blocked (network, extension): fall through and let the browser try.
    }

    window.location.assign(data.url)
  }

  const size = tone === 'compact' ? 'px-3 py-2 text-sm' : 'px-4 py-3 text-sm'

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={`flex w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60 ${size}`}
      >
        <GoogleG />
        {busy ? 'Opening Google…' : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}
    </div>
  )
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
