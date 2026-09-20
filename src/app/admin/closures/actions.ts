'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/lib/actions/state'
import { requireStaff } from '@/lib/auth/require-staff'
import { isManilaDate, todayInManila } from '@/lib/domain/time'
import { createClient } from '@/lib/supabase/server'

const closure = z.object({
  blocked_date: z.string().refine(isManilaDate, 'Pick a valid date.'),
  public_reason: z.string().trim().min(1).max(60),
  internal_note: z.string().trim().max(300),
})

/** Whole-day closure. Plain table access: RLS lets any active staffer manage these. */
export async function addClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff()

  const parsed = closure.safeParse({
    blocked_date: String(formData.get('blocked_date') ?? ''),
    public_reason: String(formData.get('public_reason') ?? '').trim() || 'Closed',
    internal_note: String(formData.get('internal_note') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the closure.' }

  const c = parsed.data
  if (c.blocked_date < todayInManila()) return { error: 'That date has already passed.' }

  const supabase = await createClient()
  const { error } = await supabase.from('blocked_dates').insert({
    blocked_date: c.blocked_date,
    public_reason: c.public_reason,
    internal_note: c.internal_note || null,
    created_by: staff.id,
  })

  if (error) {
    if (error.code === '23505') return { error: 'That date is already marked closed.' }
    console.error('addClosure failed', error)
    return { error: 'Could not save the closure. Please try again.' }
  }

  refresh()
  return { ok: true, message: `Closed ${c.blocked_date}. Existing bookings on that day are not cancelled — check the logbook.` }
}

export async function removeClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff()
  const id = z.uuid().safeParse(String(formData.get('id') ?? ''))
  if (!id.success) return { error: 'Missing closure.' }

  const supabase = await createClient()
  const { error } = await supabase.from('blocked_dates').delete().eq('id', id.data)
  if (error) {
    console.error('removeClosure failed', error)
    return { error: 'Could not reopen that date. Please try again.' }
  }

  refresh()
  return { ok: true, message: 'Reopened.' }
}
