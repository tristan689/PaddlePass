'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/supabase/env'
import { loginToEmail } from './login'
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
 * Username (or email) + password sign-in.
 *
 * A valid Supabase user who is not on the active staff roster is signed straight
 * back out. Leaving the session in place would let them sit on /login with a
 * confusing "you are signed in but nothing works" state.
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

  if (!staff) {
    await supabase.auth.signOut()
    return {
      error:
        'That account is not an active staff account. Ask the owner to add you to the roster.',
    }
  }

  redirect(safeNextPath(formData.get('next')?.toString()))
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
