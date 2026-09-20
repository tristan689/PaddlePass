import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabasePublishableKey, supabaseUrl } from './env'

/**
 * Server client for Server Components, Server Actions and Route Handlers.
 *
 * Only `getAll` / `setAll` are implemented. The older `get`/`set`/`remove` cookie
 * shape is not merely deprecated -- it silently breaks session refresh, and
 * Supabase's own docs flag it as something never to generate.
 */
export async function createClient() {
  const cookieStore = await cookies() // async since Next 15

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies. Safe to swallow: proxy.ts has
          // already refreshed the session on this request. Throwing here would
          // break every page that merely reads the session.
        }
      },
    },
  })
}
