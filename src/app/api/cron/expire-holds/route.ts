import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Fallback hold-expiry sweep, for when pg_cron is not available on the project.
 *
 * pg_cron (see 20260920121100_cron.sql) is the primary mechanism and runs inside
 * the database every minute. This route exists so Vercel Cron -- or anything that
 * can make an HTTP request on a schedule -- can drive the same function instead.
 * It is idempotent and safe to run as often as you like; each call only flips
 * pending holds whose deadline has passed.
 *
 * Guarded by a shared secret in the Authorization header, which is exactly what
 * Vercel Cron sends when CRON_SECRET is set in the project's environment.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 })
  }

  if (!authorised(request.headers.get('authorization'), secret)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('expire_stale_holds')

  if (error) {
    console.error('expire_stale_holds failed', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ expired: Number(data ?? 0), at: new Date().toISOString() })
}

/** Constant-time compare so the secret cannot be guessed byte by byte. */
function authorised(header: string | null, secret: string): boolean {
  if (!header?.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice('Bearer '.length))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
