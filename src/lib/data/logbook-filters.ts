import type { LogbookFilters } from './admin'
import { ALL_STATUSES, type BookingStatus } from '@/lib/domain/status'
import { isManilaDate } from '@/lib/domain/time'

type ParamSource = Record<string, string | string[] | undefined> | URLSearchParams

function read(source: ParamSource, key: string): string {
  if (source instanceof URLSearchParams) return source.get(key) ?? ''
  const value = source[key]
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/**
 * The logbook page and its CSV export read the same query string, so they must
 * agree on what it means. Anything malformed is dropped rather than erroring:
 * a bad date in a shared link should show the unfiltered logbook, not a 500.
 */
export function parseLogbookFilters(source: ParamSource): LogbookFilters {
  const q = read(source, 'q').trim().slice(0, 80)
  const status = read(source, 'status')
  const from = read(source, 'from')
  const to = read(source, 'to')

  return {
    q: q || undefined,
    status: (ALL_STATUSES as readonly string[]).includes(status) ? (status as BookingStatus) : '',
    from: isManilaDate(from) ? from : undefined,
    to: isManilaDate(to) ? to : undefined,
  }
}

export function parsePage(source: ParamSource): number {
  const n = Number(read(source, 'page'))
  return Number.isInteger(n) && n > 0 ? n : 1
}

/** Rebuild the query string for pagination links and the export link. */
export function logbookQuery(filters: LogbookFilters, page?: number): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.status) params.set('status', filters.status)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (page && page > 1) params.set('page', String(page))
  const s = params.toString()
  return s ? `?${s}` : ''
}
