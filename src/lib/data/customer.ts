import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BookingStatus } from '@/lib/domain/status'

/** The columns a customer needs to see their own booking and open its status link. */
export interface MyBookingRow {
  id: string
  reference_code: string
  lookup_token: string
  booking_date: string
  start_time: string
  end_time: string
  status: BookingStatus
  paddle_count: number
  total_cents: number
  amount_paid_cents: number
}

/**
 * The signed-in customer's bookings. No email is passed in: the
 * bookings_customer_read policy matches rows to the JWT's email itself, so this
 * cannot be pointed at someone else's history by changing an argument.
 */
export async function listMyBookings(): Promise<MyBookingRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, reference_code, lookup_token, booking_date, start_time, end_time, status, paddle_count, total_cents, amount_paid_cents'
    )
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(100)
  if (error) throw new Error(`Could not load your bookings: ${error.message}`)
  return (data ?? []) as MyBookingRow[]
}
