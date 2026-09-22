'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/lib/actions/state'
import { customerMessageFor } from '@/lib/domain/booking-errors'
import { createClient } from '@/lib/supabase/server'

/**
 * Join or leave a confirmed session. Both run as the signed-in member; the
 * database functions hold the rules (confirmed only, not in the past, not your
 * own booking, room left) and raise stable codes this maps to sentences.
 */

async function callRpc(fn: 'join_booking' | 'leave_booking', formData: FormData, success: string): Promise<ActionState> {
  const id = z.uuid().safeParse(String(formData.get('booking_id') ?? ''))
  if (!id.success) return { error: 'That session could not be found.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc(fn, { p_booking_id: id.data })
  if (error) {
    const message = customerMessageFor(error.message)
    if (message === customerMessageFor('')) console.error(`${fn} failed`, error)
    return { error: message }
  }

  refresh()
  return { ok: true, message: success }
}

export async function joinBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return callRpc('join_booking', formData, "You're in. See you on the court!")
}

export async function leaveBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return callRpc('leave_booking', formData, 'You left the session.')
}
