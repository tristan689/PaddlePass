import type { NextRequest } from 'next/server'
import { getStaff } from '@/lib/auth/require-staff'
import { exportLogbook } from '@/lib/data/admin'
import { parseLogbookFilters } from '@/lib/data/logbook-filters'
import { csvDocument } from '@/lib/domain/csv'
import { formatPesoPlain } from '@/lib/domain/money'
import { adminLabelFor } from '@/lib/domain/status'
import { hourOfTime, todayInManila } from '@/lib/domain/time'

/**
 * The logbook as a spreadsheet. Same filters as the page, so "export what I am
 * looking at" is literally true. Runs as the signed-in staffer -- RLS applies --
 * and refuses anyone else with a 401 rather than a redirect, since this is a file
 * download, not a page.
 */
export async function GET(request: NextRequest) {
  const staff = await getStaff()
  if (!staff) return new Response('Sign in to export the logbook.', { status: 401 })

  const filters = parseLogbookFilters(request.nextUrl.searchParams)
  const rows = await exportLogbook(filters)

  const header = [
    'Reference',
    'Name',
    'Contact',
    'Facebook',
    'Date',
    'Start',
    'End',
    'Hours',
    'Paddles',
    'Status',
    'Total (PHP)',
    'Down payment date',
    'Down payment MOP',
    'Down payment (PHP)',
    'Down payment received by',
    'Full payment date',
    'Full payment MOP',
    'Full payment (PHP)',
    'Full payment received by',
    'Balance (PHP)',
    'Date of arrival',
    'Checked in',
    'Moved from',
    'Approved by',
    'Requested at',
  ]

  const body = rows.map((r) => [
    r.reference_code,
    r.customer_name,
    r.contact,
    r.facebook_name,
    r.booking_date,
    `${String(hourOfTime(r.start_time)).padStart(2, '0')}:00`,
    `${String(hourOfTime(r.end_time)).padStart(2, '0')}:00`,
    Number(r.hours),
    r.paddle_count,
    adminLabelFor(r.status),
    formatPesoPlain(r.total_cents),
    r.down_paid_on,
    r.down_method,
    r.down_amount_cents === null ? '' : formatPesoPlain(r.down_amount_cents),
    r.down_received_by,
    r.full_paid_on,
    r.full_method,
    r.full_amount_cents === null ? '' : formatPesoPlain(r.full_amount_cents),
    r.full_received_by,
    formatPesoPlain(r.balance_cents),
    r.arrival_date,
    r.checked_in_at ? 'yes' : '',
    r.moved_from_date,
    r.approved_by_name,
    r.created_at,
  ])

  return new Response(csvDocument(header, body), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="paddlepass-logbook-${todayInManila()}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
