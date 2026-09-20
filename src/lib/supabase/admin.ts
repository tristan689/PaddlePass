import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { supabaseUrl } from './env'

/**
 * Privileged client. Bypasses Row Level Security entirely.
 *
 * `import 'server-only'` on the first line is the guardrail: if any Client
 * Component ever imports this file, transitively or otherwise, the BUILD FAILS.
 * That turns a leaked service key from a code-review miss into a compile error.
 *
 * Used in exactly two places, both without a user session:
 *   - inviting staff via the Auth Admin API (src/app/admin/staff/actions.ts)
 *   - the secret-guarded hold-expiry cron route (src/app/api/cron/expire-holds)
 * If you find yourself reaching for it anywhere a staffer is signed in, the RLS
 * policy is wrong; fix that instead of escalating around it.
 */
export function createAdminClient() {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    throw new Error(
      'Missing SUPABASE_SECRET_KEY. Set it in .env.local and as a Sensitive variable in Vercel.'
    )
  }

  return createSupabaseClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
