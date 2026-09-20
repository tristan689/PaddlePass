import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { PublicBookingRow } from './types'

/**
 * The one public read of a single booking.
 *
 * Both halves are required: the reference is short and guessable by design, the
 * token is the secret. get_booking_by_token() returns nothing at all on a mismatch,
 * so a wrong token is indistinguishable from a booking that never existed -- an
 * attacker learns nothing from probing.
 */
export async function getBookingByToken(
  reference: string,
  token: string
): Promise<PublicBookingRow | null> {
  // Tokens are 64 hex characters; anything else cannot match and is not worth a
  // round trip.
  if (!/^[0-9a-f]{64}$/i.test(token)) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('get_booking_by_token', { p_reference: reference, p_token: token })
    .maybeSingle()

  if (error) throw new Error(`Could not load booking: ${error.message}`)
  return (data as PublicBookingRow | null) ?? null
}
