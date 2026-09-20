/**
 * Row shapes as PostgREST returns them.
 *
 * Hand-written rather than generated: the schema is eleven migrations and one
 * view, and every column the UI touches is listed in the SQL beside it. Times are
 * Postgres `time` strings (`"14:00:00"`, midnight close is `"24:00:00"`), dates
 * are `YYYY-MM-DD`, instants are ISO strings, money is integer centavos.
 */

import type { BookingStatus, CalendarState } from '@/lib/domain/status'

export type PaymentKind = 'down_payment' | 'full_payment'
export type PaymentMethod = 'cash' | 'gcash'
export type StaffRole = 'owner' | 'staff'

export interface BookingRow {
  id: string
  reference_code: string
  court_id: number
  booking_date: string
  start_time: string
  end_time: string
  status: BookingStatus
  calendar_state: Exclude<CalendarState, 'free' | 'closed' | 'past'> | null
  customer_name: string
  contact: string
  facebook_name: string
  customer_note: string | null
  paddle_count: number
  rate_cents: number
  paddle_fee_cents: number
  total_cents: number
  amount_paid_cents: number
  hold_expires_at: string | null
  approved_by: string | null
  approved_at: string | null
  checked_in_at: string | null
  resolution_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** A booking with the approver's name joined in, for the detail page. */
export interface BookingDetailRow extends BookingRow {
  approver: { full_name: string } | null
}

export interface PaymentRow {
  id: string
  booking_id: string
  kind: PaymentKind
  method: PaymentMethod
  amount_cents: number
  paid_on: string
  external_ref: string | null
  note: string | null
  received_by: string
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  created_at: string
  receiver: { full_name: string } | null
  voider: { full_name: string } | null
}

export interface RescheduleRow {
  id: string
  booking_id: string
  from_date: string
  from_start_time: string
  from_end_time: string
  to_date: string
  to_start_time: string
  to_end_time: string
  reason: string | null
  moved_by: string | null
  created_at: string
  mover: { full_name: string } | null
}

/** One row of public.admin_logbook. */
export interface LogbookRow {
  id: string
  reference_code: string
  customer_name: string
  contact: string
  facebook_name: string
  status: BookingStatus
  calendar_state: string | null
  hours: number
  booking_date: string
  start_time: string
  end_time: string
  paddle_count: number
  rate_cents: number
  paddle_fee_cents: number
  total_cents: number
  amount_paid_cents: number
  balance_cents: number
  down_paid_on: string | null
  down_method: PaymentMethod | null
  down_amount_cents: number | null
  down_received_by: string | null
  full_paid_on: string | null
  full_method: PaymentMethod | null
  full_amount_cents: number | null
  full_received_by: string | null
  arrival_date: string
  checked_in_at: string | null
  moved_from_date: string | null
  approved_by_name: string | null
  approved_at: string | null
  created_at: string
}

export interface StaffRow {
  id: string
  full_name: string
  role: StaffRole
  active: boolean
  created_at: string
}

export interface BlockedDateRow {
  id: string
  blocked_date: string
  public_reason: string
  internal_note: string | null
  created_by: string | null
  created_at: string
}

export interface SettingsRow {
  id: number
  open_hour: number
  close_hour: number
  min_hours: number
  max_hours: number
  closed_weekdays: number[]
  rate_cents: number
  downpayment_cents: number
  paddle_fee_cents: number
  paddles_owned: number
  hold_minutes: number
  facebook_page: string
  court_name: string
  updated_at: string
  updated_by: string | null
}

/** Output of public.dashboard_metrics(). */
export interface DashboardMetrics {
  collected_cents: number
  paddle_cents: number
  outstanding_cents: number
  booking_count: number
  booked_hours: number
  open_hours: number
  no_shows: number
  busiest_hours: Array<{ hour: number; bookings: number }>
}

/** Output of public.get_booking_by_token(). */
export interface PublicBookingRow {
  reference_code: string
  booking_date: string
  start_hour: number
  end_hour: number
  paddle_count: number
  customer_name: string
  status: BookingStatus
  total_cents: number
  amount_paid_cents: number
  hold_expires_at: string | null
}
