'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'
import { loginToEmail, STAFF_LOGIN_DOMAIN } from './login'
import { safeNextPath } from './redirect'

export interface AuthState {
  error?: string
  message?: string
}

const credentials = z.object({
  login: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
})

/**
 * Username (or email) + password sign-in, for staff and players alike.
 *
 * Staff land in the admin (or the admin page they were headed to); everyone else
 * lands in their account, or back on the calendar day they came from.
 */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    login: formData.get('login'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' }
  }

  const email = loginToEmail(parsed.data.login)
  if (!email) return { error: 'Wrong username or password.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })
  if (error || !data.user) {
    // One message for both wrong-username and wrong-password: never confirm which
    // accounts exist.
    return { error: 'Wrong username or password.' }
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('id', data.user.id)
    .eq('active', true)
    .maybeSingle()

  const next = safeNextPath(formData.get('next')?.toString())
  const toAdmin = next.startsWith('/admin')
  redirect(staff ? (toAdmin ? next : '/admin') : toAdmin ? '/account' : next)
}

/**
 * Sign out. Lands on /login by default; the public header passes `to=/` so a
 * staffer who signs out from the calendar stays on the calendar.
 */
export async function signOut(formData?: FormData): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(formData?.get('to') === '/' ? '/' : '/login')
}

/**
 * Sends the reset email. The response is identical whether or not the address
 * exists, for the same reason sign-in errors are vague.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = z.email().safeParse(String(formData.get('email') ?? '').trim())
  if (!email.success) return { error: 'Enter a valid email address.' }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/admin/account`,
  })

  return { message: 'If that address belongs to a staff account, a reset link is on its way.' }
}

const newPassword = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'The two passwords do not match.',
    path: ['confirm'],
  })

/** Used after an invite or a reset link, and from the account page. */
export async function setPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = newPassword.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }

  return { message: 'Password updated.' }
}

const realEmail = z.email('Enter a valid email address.')

/**
 * Give a username-only staff account a real email.
 *
 * Username accounts live at <username>@undefeated.local, an address nobody can
 * receive at -- so password resets never arrive and Google sign-in cannot match.
 * Setting a real email fixes both: Supabase links a Google sign-in to the account
 * with the same verified email. Done through the Admin API so it applies at once,
 * without a confirmation email the old fake address could never receive.
 */
export async function setStaffEmail(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return { error: 'Please sign in again.' }

  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('id', userId)
    .eq('active', true)
    .maybeSingle()
  if (!staff) return { error: 'Only active staff can do this.' }

  const parsed = realEmail.safeParse(String(formData.get('email') ?? '').trim().toLowerCase())
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Enter a valid email.' }
  if (parsed.data.endsWith(`@${STAFF_LOGIN_DOMAIN}`)) {
    return { error: 'Use a real inbox — that domain cannot receive mail.' }
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(userId, {
    email: parsed.data,
    email_confirm: true,
  })
  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      return { error: 'That email already belongs to another account.' }
    }
    console.error('setStaffEmail failed', error)
    return { error: 'Could not save the email. Please try again.' }
  }

  // The session still carries the old email until the token refreshes; sign in
  // again and the header, Google linking and resets all use the new one.
  return {
    message: `Saved. Sign in with ${parsed.data} (or Google on that address) from now on — your username still works too.`,
  }
}

const registration = z.object({
  full_name: z.string().trim().min(1, 'Enter your name.').max(60, 'Please use a shorter name.'),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

/**
 * Player sign-up with email + password. Supabase may require the address to be
 * confirmed first (a link lands on /auth/confirm); when it does not, the session
 * exists immediately and we go straight through. A pre-approved staff email
 * becomes staff here too, via the same trigger as Google sign-ups.
 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registration.safeParse({
    full_name: formData.get('full_name'),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' }
  }
  const next = safeNextPath(formData.get('next')?.toString())
  const dest = next.startsWith('/admin') ? '/account' : next

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent(dest)}`,
    },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: 'That email already has an account — sign in instead.' }
    }
    return { error: error.message }
  }

  // Supabase returns a user with no identities when the email is already taken
  // and confirmation is on (to avoid leaking who has an account). Say the same.
  if (data.user && data.user.identities?.length === 0) {
    return { error: 'That email already has an account — sign in instead.' }
  }

  if (data.session) redirect(dest)
  return {
    message: `Almost there — we sent a confirmation link to ${parsed.data.email}. Open it to finish signing up.`,
  }
}
