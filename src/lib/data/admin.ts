import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BookingStatus } from '@/lib/domain/status'
import { isValidReference, normalizeReference } from '@/lib/domain/reference'
import type { ManilaDate } from '@/lib/domain/time'
import type {
  BlockedDateRow,
  BookingDetailRow,
  BookingRow,
  DashboardMetrics,
  LogbookRow,
  PaymentRow,
  RescheduleRow,
  SettingsRow,
  StaffRow,
} from './types'

/**
 * Admin-side reads.
 *
 * Every query here runs as the signed-in staff member through the SSR client, so
 * RLS applies. Nothing in this file uses the service key: if a read fails for a
 * staffer, that is the policy doing its job, and the fix belongs in SQL.
 */

function fail(what: string, error: { message: string }): never {
  throw new Error(`Could not load ${what}: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/** The approval queue, newest request first. */
export async function listPendingBookings(): Promise<BookingRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) fail('pending requests', error)
  return (data ?? []) as BookingRow[]
}

/** Everything occupying the court on a date, in play order. */
export async function listBookingsOn(date: ManilaDate): Promise<BookingRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('booking_date', date)
    .eq('blocks_availability', true)
    .order('start_time')
  if (error) fail(`bookings on ${date}`, error)
  return (data ?? []) as BookingRow[]
}

export async function getBookingById(id: string): Promise<BookingDetailRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*, approver:staff!bookings_approved_by_fkey(full_name)')
    .eq('id', id)
    .maybeSingle()
  if (error) fail('booking', error)
  return (data as BookingDetailRow | null) ?? null
}

export async function listPayments(bookingId: string): Promise<PaymentRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select(
      '*, receiver:staff!payments_received_by_fkey(full_name), voider:staff!payments_voided_by_fkey(full_name)'
    )
    .eq('booking_id', bookingId)
    .order('created_at')
  if (error) fail('payments', error)
  return (data ?? []) as PaymentRow[]
}

export async function listReschedules(bookingId: string): Promise<RescheduleRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_reschedules')
    .select('*, mover:staff!booking_reschedules_moved_by_fkey(full_name)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) fail('reschedule history', error)
  return (data ?? []) as RescheduleRow[]
}

// ---------------------------------------------------------------------------
// Logbook
// ---------------------------------------------------------------------------

export interface LogbookFilters {
  /** Reference code or (part of) a customer name. */
  q?: string
  status?: BookingStatus | ''
  from?: ManilaDate
  to?: ManilaDate
}

export const LOGBOOK_PAGE_SIZE = 50

/** Characters PostgREST's filter grammar treats specially. Never let them through. */
function sanitizePattern(raw: string): string {
  return raw.replace(/[,().*%\\]/g, ' ').trim()
}

/** The four PostgREST filter methods the logbook uses, so the helper works on any builder shape. */
interface Filterable<T> {
  eq(column: string, value: string): T
  gte(column: string, value: string): T
  lte(column: string, value: string): T
  or(filters: string): T
}

function applyLogbookFilters<T extends Filterable<T>>(query: T, filters: LogbookFilters): T {
  let q = query

  const search = filters.q?.trim()
  if (search) {
    const ref = normalizeReference(search)
    if (ref && isValidReference(ref)) {
      q = q.eq('reference_code', ref)
    } else {
      const pattern = sanitizePattern(search)
      if (pattern) {
        // Matches "dela cruz" against "Dela Cruz, Juan" and a partial reference
        // like "7K2" against "UD-7K2MX". The trigram index backs the name side.
        q = q.or(`customer_name.ilike.%${pattern}%,reference_code.ilike.%${pattern}%`)
      }
    }
  }
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.from) q = q.gte('booking_date', filters.from)
  if (filters.to) q = q.lte('booking_date', filters.to)

  return q
}

export interface LogbookPage {
  rows: LogbookRow[]
  total: number
  page: number
  pageCount: number
}

export async function queryLogbook(filters: LogbookFilters, page = 1): Promise<LogbookPage> {
  const supabase = await createClient()
  const safePage = Math.max(1, Math.floor(page))
  const from = (safePage - 1) * LOGBOOK_PAGE_SIZE

  const base = supabase.from('admin_logbook').select('*', { count: 'exact' })
  const { data, error, count } = await applyLogbookFilters(base, filters)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .range(from, from + LOGBOOK_PAGE_SIZE - 1)

  if (error) fail('logbook', error)

  const total = count ?? 0
  return {
    rows: (data ?? []) as LogbookRow[],
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / LOGBOOK_PAGE_SIZE)),
  }
}

/** Every matching row, for the CSV export. Capped so a typo cannot pull years. */
export async function exportLogbook(filters: LogbookFilters, cap = 5000): Promise<LogbookRow[]> {
  const supabase = await createClient()
  const base = supabase.from('admin_logbook').select('*')
  const { data, error } = await applyLogbookFilters(base, filters)
    .order('booking_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(cap)
  if (error) fail('logbook export', error)
  return (data ?? []) as LogbookRow[]
}

// ---------------------------------------------------------------------------
// Dashboard, closures, roster, settings
// ---------------------------------------------------------------------------

export async function getDashboardMetrics(
  from: ManilaDate,
  to: ManilaDate
): Promise<DashboardMetrics> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dashboard_metrics', { p_from: from, p_to: to })
  if (error) fail('dashboard metrics', error)
  return data as DashboardMetrics
}

export async function listBlockedDates(from: ManilaDate): Promise<BlockedDateRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .gte('blocked_date', from)
    .order('blocked_date')
  if (error) fail('closures', error)
  return (data ?? []) as BlockedDateRow[]
}

export async function listStaff(): Promise<StaffRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('staff').select('*').order('created_at')
  if (error) fail('staff roster', error)
  return (data ?? []) as StaffRow[]
}

/** The full settings row -- staff-only, via RLS. The public reads a projection. */
export async function getSettingsRow(): Promise<SettingsRow> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (error) fail('settings', error)
  return data as SettingsRow
}

// ---------------------------------------------------------------------------
// Pre-approved staff emails (owner-only via RLS).
// ---------------------------------------------------------------------------

export interface AllowlistRow {
  email: string
  full_name: string | null
  role: 'owner' | 'staff'
  created_at: string
}

export async function listStaffAllowlist(): Promise<AllowlistRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff_allowlist')
    .select('email, full_name, role, created_at')
    .order('created_at')
  if (error) fail('pre-approved emails', error)
  return (data ?? []) as AllowlistRow[]
}

// ---------------------------------------------------------------------------
// Members who joined a session (staff can read all participants and profiles).
// ---------------------------------------------------------------------------

export interface ParticipantRow {
  profile_id: string
  created_at: string
  profile: { display_name: string; avatar_url: string | null } | null
}

export async function listParticipants(bookingId: string): Promise<ParticipantRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_participants')
    .select('profile_id, created_at, profile:profiles(display_name, avatar_url)')
    .eq('booking_id', bookingId)
    .order('created_at')
  if (error) fail('participants', error)
  return (data ?? []) as unknown as ParticipantRow[]
}
