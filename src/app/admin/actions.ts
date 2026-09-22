'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ActionState } from '@/lib/actions/state'
import { requireStaff } from '@/lib/auth/require-staff'
import { staffMessageFor } from '@/lib/domain/booking-errors'
import { parsePesoInput } from '@/lib/domain/money'
import { isManilaDate } from '@/lib/domain/time'
import { createClient } from '@/lib/supabase/server'

/**
 * Booking mutations. Thin on purpose: each one authenticates, shapes the form
 * data, calls the matching RPC as the signed-in staff member (so RLS applies and
 * `received_by` / `approved_by` are trustworthy) and maps the database's stable
 * error codes to sentences.
 */

const uuid = z.uuid()

async function callRpc(
  fn: string,
  args: Record<string, unknown>,
  success: string
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(fn, args)

  if (error) {
    const message = staffMessageFor(error.message)
    // Known codes are normal traffic; anything generic is worth a real log line.
    if (message === staffMessageFor('')) console.error(`${fn} failed`, error)
    return { error: message }
  }

  refresh()
  return { ok: true, message: success }
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

// ---------------------------------------------------------------------------

export async function approveBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()
  const id = uuid.safeParse(field(formData, 'booking_id'))
  if (!id.success) return { error: 'Missing booking.' }

  return callRpc('approve_booking', { p_booking_id: id.data }, 'Approved. Let the customer know on Messenger.')
}

const release = z.object({
  booking_id: uuid,
  status: z.enum(['declined', 'cancelled', 'no_show']),
  reason: z.string().trim().max(300),
})

export async function releaseBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()
  const parsed = release.safeParse({
    booking_id: field(formData, 'booking_id'),
    status: field(formData, 'status'),
    reason: field(formData, 'reason'),
  })
  if (!parsed.success) return { error: 'Choose an outcome and check the reason.' }

  const { booking_id, status, reason } = parsed.data
  // The database allows an empty reason; the logbook is more useful when there
  // is one for a decline or a cancellation. A no-show is self-explanatory.
  if (status !== 'no_show' && reason.length < 2) {
    return { error: 'Please give a short reason — it shows up in the booking history.' }
  }

  const said = { declined: 'Declined.', cancelled: 'Cancelled.', no_show: 'Marked as a no-show.' }
  return callRpc(
    'release_booking',
    { p_booking_id: booking_id, p_status: status, p_reason: reason || null },
    `${said[status]} The slot is open again.`
  )
}

export async function markArrived(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()
  const id = uuid.safeParse(field(formData, 'booking_id'))
  if (!id.success) return { error: 'Missing booking.' }

  return callRpc('mark_arrived', { p_booking_id: id.data }, 'Arrival recorded.')
}

// ---------------------------------------------------------------------------

const payment = z.object({
  booking_id: uuid,
  kind: z.enum(['down_payment', 'full_payment']),
  method: z.enum(['cash', 'gcash']),
  paid_on: z.string().refine(isManilaDate, 'Pick the date the money was received.'),
  external_ref: z.string().trim().max(80),
  note: z.string().trim().max(300),
  approve: z.boolean(),
})

export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()

  const amountCents = parsePesoInput(field(formData, 'amount'))
  if (amountCents === null || amountCents <= 0) {
    return { error: 'Enter the amount received, in pesos.' }
  }

  const parsed = payment.safeParse({
    booking_id: field(formData, 'booking_id'),
    kind: field(formData, 'kind'),
    method: field(formData, 'method'),
    paid_on: field(formData, 'paid_on'),
    external_ref: field(formData, 'external_ref'),
    note: field(formData, 'note'),
    approve: formData.get('approve') === 'on',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the payment details.' }
  }
  const p = parsed.data

  return callRpc(
    'record_payment',
    {
      p_booking_id: p.booking_id,
      p_kind: p.kind,
      p_method: p.method,
      p_amount_cents: amountCents,
      p_paid_on: p.paid_on,
      p_external_ref: p.external_ref || null,
      p_note: p.note || null,
      p_approve: p.approve,
    },
    'Payment recorded.'
  )
}

export async function voidPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()
  const id = uuid.safeParse(field(formData, 'payment_id'))
  const reason = field(formData, 'reason')
  if (!id.success) return { error: 'Missing payment.' }
  if (reason.length < 2) return { error: 'Say why this payment is being voided.' }

  return callRpc(
    'void_payment',
    { p_payment_id: id.data, p_reason: reason },
    'Payment voided. The booking totals have been recalculated.'
  )
}

// ---------------------------------------------------------------------------

const reschedule = z.object({
  booking_id: uuid,
  date: z.string().refine(isManilaDate, 'Pick a valid date.'),
  start_hour: z.coerce.number().int().min(0).max(23),
  end_hour: z.coerce.number().int().min(1).max(24),
  reason: z.string().trim().max(200),
})

export async function rescheduleBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()
  const parsed = reschedule.safeParse({
    booking_id: field(formData, 'booking_id'),
    date: field(formData, 'date'),
    start_hour: field(formData, 'start_hour'),
    end_hour: field(formData, 'end_hour'),
    reason: field(formData, 'reason'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the new slot.' }
  }
  const r = parsed.data
  if (r.end_hour <= r.start_hour) return { error: 'The end time must be after the start time.' }

  return callRpc(
    'reschedule_booking',
    {
      p_booking_id: r.booking_id,
      p_date: r.date,
      p_start_hour: r.start_hour,
      p_end_hour: r.end_hour,
      p_reason: r.reason || null,
    },
    'Moved. The reference code and payments stay with the booking.'
  )
}

// ---------------------------------------------------------------------------
// Staff-entered bookings: the customer agreed it on Messenger, staff type it in.
// ---------------------------------------------------------------------------

const staffBooking = z.object({
  date: z.string().refine(isManilaDate, 'Pick a valid date.'),
  start_hour: z.coerce.number().int().min(0).max(23),
  end_hour: z.coerce.number().int().min(1).max(24),
  paddle_count: z.coerce.number().int().min(0).max(50),
  customer_name: z.string().trim().min(1, "Enter the customer's name.").max(80),
  contact: z.string().trim().max(40),
  facebook_name: z.string().trim().max(80),
  note: z.string().trim().max(500),
})

/** Creates the booking already approved and lands on its detail page. */
export async function createStaffBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()
  const parsed = staffBooking.safeParse({
    date: field(formData, 'date'),
    start_hour: field(formData, 'start_hour'),
    end_hour: field(formData, 'end_hour'),
    paddle_count: field(formData, 'paddle_count') || '0',
    customer_name: field(formData, 'customer_name'),
    contact: field(formData, 'contact'),
    facebook_name: field(formData, 'facebook_name'),
    note: field(formData, 'note'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the booking details.' }
  }
  const b = parsed.data
  if (b.end_hour <= b.start_hour) return { error: 'The end time must be after the start time.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_staff_booking', {
    p_date: b.date,
    p_start_hour: b.start_hour,
    p_end_hour: b.end_hour,
    p_paddle_count: b.paddle_count,
    p_customer_name: b.customer_name,
    p_contact: b.contact,
    p_facebook_name: b.facebook_name,
    p_note: b.note || null,
  })

  if (error) {
    const message = staffMessageFor(error.message)
    if (message === staffMessageFor('')) console.error('create_staff_booking failed', error)
    return { error: message }
  }

  // redirect() throws, so it stays outside any try/catch and is the last thing here.
  redirect(`/admin/bookings/${(data as { id: string }).id}`)
}
