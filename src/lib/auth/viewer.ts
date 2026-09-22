import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getStaff, type StaffProfile } from './require-staff'

/**
 * Who is looking at a public page.
 *
 * Three answers: nobody, a staff member (has an active staff row), or a customer
 * (any other signed-in user -- in practice, someone who used Google). A customer
 * carries their profile: the name and photo they chose to show, and whether they
 * want to be visible on the calendar. Cached per request so the header, the
 * calendar and the Messenger message all ask once.
 */
export type Viewer =
  | { kind: 'staff'; userId: string; staff: StaffProfile; email: string; avatarUrl: string | null }
  | {
      kind: 'customer'
      userId: string
      name: string
      email: string
      avatarUrl: string | null
      showOnCalendar: boolean
    }
  | null

export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = (data?.claims ?? null) as Record<string, unknown> | null
  if (!claims || typeof claims.sub !== 'string') return null

  const userId = claims.sub
  const email = typeof claims.email === 'string' ? claims.email : ''

  // The profile row is created by trigger on sign-up; the claims are only a
  // fallback for the moment before it exists. Staff have one too -- it holds
  // their photo for the header menu.
  const [staff, { data: profile }] = await Promise.all([
    getStaff(),
    supabase
      .from('profiles')
      .select('display_name, avatar_url, show_on_calendar')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (staff) return { kind: 'staff', userId, staff, email, avatarUrl: profile?.avatar_url ?? null }

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>
  const metaName = [meta.full_name, meta.name].find(
    (v): v is string => typeof v === 'string' && v.trim() !== ''
  )

  return {
    kind: 'customer',
    userId,
    name: profile?.display_name ?? metaName ?? email.split('@')[0] ?? 'there',
    email,
    avatarUrl: profile?.avatar_url ?? (typeof meta.picture === 'string' ? meta.picture : null),
    showOnCalendar: profile?.show_on_calendar ?? true,
  }
})
