import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BookingStatus } from '@/lib/domain/status'
import type { ManilaDate } from '@/lib/domain/time'

export interface RosterParticipant {
  name: string
  avatar: string | null
}

/** One confirmed session on a day, as the public may see it. */
export interface RosterRow {
  booking_id: string
  start_hour: number
  end_hour: number
  status: Extract<BookingStatus, 'approved' | 'downpayment' | 'paid'>
  /** Null for a guest booking or a member who chose not to be shown. */
  host_name: string | null
  host_avatar: string | null
  participants: RosterParticipant[]
  participant_count: number
  /** For the signed-in caller; always false for anonymous visitors. */
  joined: boolean
  is_host: boolean
}

/**
 * Who is playing on a date. Runs as whoever is looking (anon or a member), and
 * get_day_roster() decides what they may see -- names and photos only for members
 * who opted in, never a contact detail, never a guest's name.
 */
export async function getDayRoster(date: ManilaDate): Promise<RosterRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_day_roster', { p_date: date })
  if (error) throw new Error(`Could not load who is playing: ${error.message}`)
  return (data ?? []) as RosterRow[]
}
