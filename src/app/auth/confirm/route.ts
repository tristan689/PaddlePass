import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth/redirect'
import { createClient } from '@/lib/supabase/server'

/**
 * Where emailed auth links land: staff invites and password resets.
 *
 * Supabase can deliver either shape depending on the project's email template:
 *   - PKCE: `?code=...`                         -> exchangeCodeForSession
 *   - token hash: `?token_hash=...&type=invite`  -> verifyOtp
 * Both end with a session cookie and a redirect to `next` (validated -- it comes
 * from the URL), which for invites and resets is /admin/account to set a password.
 *
 * A failed or reused link goes back to /login with a flag; the login page words it.
 */

type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'
const OTP_TYPES: ReadonlySet<string> = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const next = safeNextPath(params.get('next'))

  const supabase = await createClient()
  let ok = false

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    })
    ok = !error
  }

  // redirect() throws; it must be the last thing here and outside any try/catch.
  redirect(ok ? next : '/login?error=link')
}
