import { z } from 'zod'

/**
 * Supabase Auth only knows email addresses. Staff sign in with a short username
 * (`admin`), which is mapped onto this private domain before it reaches Supabase.
 * A full email address is accepted as-is, so staff with real inboxes keep the
 * password-reset flow. Must match scripts/create-staff.mjs.
 *
 * Plain module (no 'use server') so it can be unit-tested and imported anywhere.
 */
export const STAFF_LOGIN_DOMAIN = 'undefeated.local'

const USERNAME = /^[a-z0-9][a-z0-9._-]{0,63}$/

/** `admin` -> `admin@undefeated.local`; a valid email passes through; junk -> null. */
export function loginToEmail(login: string): string | null {
  const value = login.trim().toLowerCase()
  if (value.includes('@')) return z.email().safeParse(value).success ? value : null
  return USERNAME.test(value) ? `${value}@${STAFF_LOGIN_DOMAIN}` : null
}
