import { StatusLegend } from '@/components/calendar/StatusLegend'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { DateStrip } from '@/components/calendar/DateStrip'
import { getMonthAvailability, getStripAvailability } from '@/lib/data/availability'
import { formatPesoCompact } from '@/lib/domain/money'
import { formatHour, resolveMonth, todayInManila } from '@/lib/domain/time'

/**
 * The public booking calendar — what a Facebook link opens.
 *
 * A Server Component that fetches availability server-side, so the browser is
 * never handed a Supabase key and never receives a row the availability
 * projection did not deliberately expose. It also means a phone on mobile data
 * gets HTML rather than a spinner.
 *
 * Never cached: a customer seeing a slot that vanished on submit is the worst
 * failure mode this page has.
 */
export const dynamic = 'force-dynamic'

export default async function CalendarPage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams
  const monthParam = typeof params.m === 'string' ? params.m : undefined
  const month = resolveMonth(monthParam)

  const [{ days, settings }, strip] = await Promise.all([
    getMonthAvailability(month),
    getStripAvailability(todayInManila(), 21),
  ])

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Book the court
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {settings.isConfigured ? (
            <>
              {formatPesoCompact(settings.rateCents)}/hour · Open{' '}
              {formatHour(settings.openHour)} – {formatHour(settings.closeHour)}
            </>
          ) : (
            <>Open {formatHour(settings.openHour)} – {formatHour(settings.closeHour)}</>
          )}
        </p>
      </section>

      {!settings.isConfigured && <NotConfiguredNotice />}

      {/* Mobile: filmstrip of the next three weeks. */}
      <section className="md:hidden">
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          PICK A DATE
        </h2>
        <DateStrip days={strip.days} />
      </section>

      {/* Desktop: the full month. */}
      <MonthGrid month={month} days={days} className="hidden md:block" />

      <StatusLegend className="pt-1" />

      <p className="text-xs leading-relaxed text-slate-500">
        Picking a time sends us a request — it is not a confirmed booking. We will
        confirm it with you on Facebook Messenger.
      </p>
    </div>
  )
}

/**
 * First-run state. The court genuinely cannot be booked until an owner sets an
 * hourly rate, so the page says so plainly rather than quoting ₱0 per hour and
 * taking bookings nobody meant to accept.
 */
function NotConfiguredNotice() {
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p className="font-semibold">Online booking is not open yet.</p>
      <p className="mt-1">
        Please message us on Facebook to book the court while we finish setting this up.
      </p>
    </div>
  )
}
