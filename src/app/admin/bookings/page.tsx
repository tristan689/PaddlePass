import Link from 'next/link'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { LOGBOOK_PAGE_SIZE, queryLogbook } from '@/lib/data/admin'
import { logbookQuery, parseLogbookFilters, parsePage } from '@/lib/data/logbook-filters'
import type { LogbookRow } from '@/lib/data/types'
import { formatPesoCompact } from '@/lib/domain/money'
import { adminLabelFor, ALL_STATUSES } from '@/lib/domain/status'
import { formatDateCompact, formatTimeRange, toManilaDate } from '@/lib/domain/time'

export const dynamic = 'force-dynamic'

const METHOD_LABEL = { cash: 'Cash', gcash: 'GCash' } as const

/**
 * The logbook: the paper ledger's seven columns, one row per booking, with both
 * payments flattened by the admin_logbook view. Filters live in the URL so a
 * search can be shared and the CSV export sees exactly what the screen shows.
 */
export default async function LogbookPage({ searchParams }: PageProps<'/admin/bookings'>) {
  const params = await searchParams
  const filters = parseLogbookFilters(params)
  const page = parsePage(params)
  const result = await queryLogbook(filters, page)

  const first = result.total === 0 ? 0 : (result.page - 1) * LOGBOOK_PAGE_SIZE + 1
  const last = Math.min(result.total, result.page * LOGBOOK_PAGE_SIZE)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Logbook</h1>
          <p className="text-sm text-slate-600">
            {result.total === 0
              ? 'No bookings match.'
              : `Showing ${first}–${last} of ${result.total}.`}
          </p>
        </div>
        <a
          href={`/api/logbook.csv${logbookQuery(filters)}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Export CSV
        </a>
      </header>

      <form method="get" className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="col-span-2 sm:col-span-1">
          <span className="sr-only">Search</span>
          <input
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Name or reference"
            className="block w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ''}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Any status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {adminLabelFor(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ''}
            className="block w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label>
          <span className="sr-only">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ''}
            className="block w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <button
            type="submit"
            className="flex-1 rounded-md bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-800"
          >
            Filter
          </button>
          {(filters.q || filters.status || filters.from || filters.to) && (
            <Link
              href="/admin/bookings"
              className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Date · Time</th>
              <th className="px-3 py-2 text-right">Hours</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Down payment</th>
              <th className="px-3 py-2">Full payment</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2">Arrival</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.rows.map((row) => (
              <LogbookLine key={row.id} row={row} />
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Nothing to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result.pageCount > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pages">
          {result.page > 1 ? (
            <Link href={`/admin/bookings${logbookQuery(filters, result.page - 1)}`} className="text-slate-700 hover:underline" rel="prev">
              ‹ Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-slate-500">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={`/admin/bookings${logbookQuery(filters, result.page + 1)}`} className="text-slate-700 hover:underline" rel="next">
              Older ›
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}

function LogbookLine({ row }: { row: LogbookRow }) {
  return (
    <tr className="align-top hover:bg-slate-50">
      <td className="px-3 py-2">
        <Link href={`/admin/bookings/${row.id}`} className="font-medium text-slate-900 hover:underline">
          {row.customer_name}
        </Link>
        <div className="font-mono text-[11px] text-slate-500">{row.reference_code}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-800">
        {formatDateCompact(toManilaDate(row.booking_date))}
        <div className="text-xs text-slate-500">{formatTimeRange(row.start_time, row.end_time)}</div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-800">{Number(row.hours)}</td>
      <td className="px-3 py-2">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2">
        <PaymentCell
          paidOn={row.down_paid_on}
          method={row.down_method}
          amountCents={row.down_amount_cents}
          by={row.down_received_by}
        />
      </td>
      <td className="px-3 py-2">
        <PaymentCell
          paidOn={row.full_paid_on}
          method={row.full_method}
          amountCents={row.full_amount_cents}
          by={row.full_received_by}
        />
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
        {row.balance_cents > 0 ? (
          <span className="font-medium text-amber-700">{formatPesoCompact(row.balance_cents)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-800">
        {row.checked_in_at ? (
          <span className="text-emerald-700">✓ {formatDateCompact(toManilaDate(row.arrival_date))}</span>
        ) : (
          <span className="text-slate-500">{formatDateCompact(toManilaDate(row.arrival_date))}</span>
        )}
        {row.moved_from_date && (
          <div className="text-xs text-slate-500">
            moved from {formatDateCompact(toManilaDate(row.moved_from_date))}
          </div>
        )}
      </td>
    </tr>
  )
}

function PaymentCell({
  paidOn,
  method,
  amountCents,
  by,
}: {
  paidOn: string | null
  method: 'cash' | 'gcash' | null
  amountCents: number | null
  by: string | null
}) {
  if (!paidOn || amountCents === null) return <span className="text-slate-400">—</span>
  return (
    <div className="whitespace-nowrap">
      <div className="text-slate-800">{formatDateCompact(toManilaDate(paidOn))}</div>
      <div className="text-xs text-slate-600">
        {method ? METHOD_LABEL[method] : ''} · {formatPesoCompact(amountCents)}
        {by && <span className="text-slate-400"> · {by}</span>}
      </div>
    </div>
  )
}
