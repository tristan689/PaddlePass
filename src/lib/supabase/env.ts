/**
 * Supabase connection details, resolved once with clear errors.
 *
 * Supabase renamed its API keys: `anon` -> publishable (`sb_publishable_...`) and
 * `service_role` -> secret (`sb_secret_...`). The legacy names still work and
 * deprecate at the end of 2026. Accepting either keeps this from being a confusing
 * first-run failure for a project created on either side of that change.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    )
  }
  return value
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}

/** Browser-safe key. Only safe because RLS is enforced on every table. */
export function supabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', key)
}

/**
 * Absolute origin for auth redirect links (invites, password resets). Falls back
 * to the dev server so a fresh checkout works without setting it, but production
 * MUST set NEXT_PUBLIC_SITE_URL or every emailed link will point at localhost.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  return (raw && raw.replace(/\/+$/, '')) || 'http://localhost:3000'
}
