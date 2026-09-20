'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  customerMessageFor,
  shouldRefreshAvailability,
} from '@/lib/domain/booking-errors'
import { isManilaDate } from '@/lib/domain/time'

export interface BookingFormState {
  error?: string
  /** The slot picker is stale (someone else took the slot); offer a reload. */
  refresh?: boolean
  /** Echoed back so a no-JavaScript submit does not lose what was typed. */
  values?: Record<string, string>
}

const request = z.object({
  date: z.string().refine(isManilaDate, 'Pick a valid date.'),
  start_hour: z.coerce.number().int().min(0).max(23),
  end_hour: z.coerce.number().int().min(1).max(24),
  paddle_count: z.coerce.number().int().min(0).max(50),
  customer_name: z
    .string()
    .trim()
    .min(1, 'Please enter your name.')
    .max(80, 'Please use a shorter name (80 characters max).'),
  contact: z
    .string()
    .trim()
    .min(7, 'Please enter a contact number we can reach you on.')
    .max(40, 'Please use a shorter contact number.'),
  facebook_name: z
    .string()
    .trim()
    .min(1, 'Please enter your Facebook name so we can find you on Messenger.')
    .max(80, 'Please use a shorter Facebook name.'),
  note: z.string().trim().max(500, 'Please keep your note under 500 characters.'),
})

/**
 * Submit a booking request.
 *
 * The real validation lives in create_booking() in the database: hours, closures,
 * paddle stock, the hold, and above all the slot race. This action only makes sure
 * the payload is well-formed enough to send, and turns the database's stable error
 * codes into sentences. It runs as `anon` -- the customer is not signed in -- which
 * is exactly why the function is SECURITY DEFINER and hand-lists its columns.
 */
export async function submitBooking(
  _prev: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const raw = {
    date: String(formData.get('date') ?? ''),
    start_hour: formData.get('start_hour'),
    end_hour: formData.get('end_hour'),
    paddle_count: formData.get('paddle_count') ?? 0,
    customer_name: String(formData.get('customer_name') ?? ''),
    contact: String(formData.get('contact') ?? ''),
    facebook_name: String(formData.get('facebook_name') ?? ''),
    note: String(formData.get('note') ?? ''),
  }
  const values = {
    customer_name: raw.customer_name,
    contact: raw.contact,
    facebook_name: raw.facebook_name,
    note: raw.note,
  }

  if (raw.start_hour === null || raw.start_hour === '') {
    return { error: 'Please pick a start time first.', values }
  }

  const parsed = request.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your details.', values }
  }
  const v = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('create_booking', {
      p_date: v.date,
      p_start_hour: v.start_hour,
      p_end_hour: v.end_hour,
      p_paddle_count: v.paddle_count,
      p_customer_name: v.customer_name,
      p_contact: v.contact,
      p_facebook_name: v.facebook_name,
      p_note: v.note || null,
    })
    .maybeSingle()

  if (error || !data) {
    const message = error?.message
    // Known codes are expected traffic (races, closures). Anything else is a bug
    // or an outage and deserves a log line with the real text.
    if (customerMessageFor(message) === customerMessageFor('')) {
      console.error('create_booking failed', error)
    }
    return {
      error: customerMessageFor(message),
      refresh: shouldRefreshAvailability(message),
      values,
    }
  }

  const created = data as { reference_code: string; lookup_token: string }
  redirect(`/r/${created.reference_code}?t=${created.lookup_token}`)
}
