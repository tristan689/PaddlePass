'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/lib/actions/state'
import { requireOwner } from '@/lib/auth/require-staff'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'

const invite = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  full_name: z.string().trim().min(1, 'Enter their name.').max(80),
  role: z.enum(['owner', 'staff']),
})

/**
 * Invite a staff member. This is the one place the service key is used for auth:
 * the Admin API sends the email, and the on_auth_user_created trigger mirrors the
 * new user into public.staff with the name and role from the invite metadata.
 */
export async function inviteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOwner()

  const parsed = invite.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the details.' }
  const { email, full_name, role } = parsed.data

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo: `${siteUrl()}/auth/confirm?next=/admin/account`,
  })

  if (error) {
    if (/already/i.test(error.message)) {
      return { error: 'That email already has an account. If they are inactive, reactivate them below.' }
    }
    console.error('inviteStaff failed', error)
    return { error: 'Could not send the invite. Please try again.' }
  }

  refresh()
  return { ok: true, message: `Invite sent to ${email}. They set a password from the link.` }
}

const member = z.object({ id: z.uuid() })

export async function setStaffActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const parsed = member.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { error: 'Missing staff member.' }
  const active = formData.get('active') === 'true'

  if (parsed.data.id === owner.id && !active) {
    return { error: 'You cannot deactivate yourself. Ask another owner to do it.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('staff').update({ active }).eq('id', parsed.data.id)
  if (error) {
    console.error('setStaffActive failed', error)
    return { error: 'Could not update. Please try again.' }
  }

  refresh()
  return { ok: true, message: active ? 'Reactivated.' : 'Deactivated — their next request is refused.' }
}

export async function setStaffRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const parsed = member.extend({ role: z.enum(['owner', 'staff']) }).safeParse({
    id: formData.get('id'),
    role: formData.get('role'),
  })
  if (!parsed.success) return { error: 'Missing staff member or role.' }

  if (parsed.data.id === owner.id && parsed.data.role !== 'owner') {
    return { error: 'You cannot remove your own owner role. Ask another owner to do it.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('staff').update({ role: parsed.data.role }).eq('id', parsed.data.id)
  if (error) {
    console.error('setStaffRole failed', error)
    return { error: 'Could not update. Please try again.' }
  }

  refresh()
  return { ok: true, message: `Now ${parsed.data.role === 'owner' ? 'an owner' : 'staff'}.` }
}
