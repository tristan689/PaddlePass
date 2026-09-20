import { createBrowserClient } from '@supabase/ssr'
import { supabasePublishableKey, supabaseUrl } from './env'

/**
 * Browser client.
 *
 * Used ONLY under /admin -- the login form and the realtime channel. The public
 * booking pages are Server Components that never talk to Supabase from the
 * browser, so an anonymous visitor is never handed an API key and never receives
 * a row the availability projection did not deliberately expose.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey())
}
