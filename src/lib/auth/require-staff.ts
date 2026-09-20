import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface StaffProfile {
  id: string
  fullName: string
  role: 'owner' | 'staff'
}

/**
 * The signed-in staff member, or null.
 *
 * Wrapped in React.cache so the whole render tree costs one database round trip
 * no matter how many components ask -- the admin layout, the page and each action
 * all call this.
 *
 * The `active` check is deliberately a live query rather than a JWT claim. A
 * deactivated staffer's token stays technically valid until it expires; joining
 * the staff table means revocation takes effect on their very next request.
 */
export const getStaff = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) return null

  const { data } = await supabase
    .from('staff')
    .select('id, full_name, role')
    .eq('id', userId)
    .eq('active', true)
    .maybeSingle()

  if (!data) return null

  return { id: data.id, fullName: data.full_name, role: data.role }
})

/**
 * Guard for admin pages and every Server Action.
 *
 * Called in addition to the proxy redirect, not instead of it. Server Actions are
 * POSTs to the page they live on, so a matcher change could stop the proxy from
 * covering them -- this check does not depend on routing at all.
 */
export async function requireStaff(): Promise<StaffProfile> {
  const staff = await getStaff()
  if (!staff) redirect('/login')
  return staff
}

/** Settings and the staff roster are owner-only: both change what customers pay. */
export async function requireOwner(): Promise<StaffProfile> {
  const staff = await requireStaff()
  if (staff.role !== 'owner') redirect('/admin')
  return staff
}
