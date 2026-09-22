import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getStaff, type StaffProfile } from './require-staff'

/**
 * Who is looking at a public page.
 *
 * Three answers: nobody, a staff member (has an active staff row), or a customer
 * (any other signed-in user -- in practice, someone who used Google). Cached per
 * request so the header, the calendar and the Messenger message all ask once.
 */
export type Viewer =
  | { kind: 'staff'; staff: StaffProfile; email: string }
  | { kind: 'customer'; name: string; email: string }
  | null

export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = (data?.claims ?? null) as Record<string, unknown> | null
  if (!claims || typeof claims.sub !== 'string') return null

  const email = typeof claims.email === 'string' ? claims.email : ''

  const staff = await getStaff()
  if (staff) return { kind: 'staff', staff, email }

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>
  const fromMeta = [meta.full_name, meta.name].find(
    (v): v is string => typeof v === 'string' && v.trim() !== ''
  )
  return { kind: 'customer', name: fromMeta ?? email.split('@')[0] ?? 'there', email }
})
