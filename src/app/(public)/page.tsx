import { StatusLegend } from '@/components/calendar/StatusLegend'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { DateStrip } from '@/components/calendar/DateStrip'
import { getMonthAvailability, getStripAvailability } from '@/lib/data/availability'
import { formatPesoCompact } from '@/lib/domain/money'
import { formatHour, resolveMonth, todayInManila } from '@/lib/domain/time'

/**
 * The public booking calendar — what a Facebook link opens.
 *
 * View-only by design: it shows WHEN the court is free. A tap on an open day goes
 * to that day's time picker, and from there a single button drops the customer
 * into Messenger with the booking already typed. No form, no account.
 *
 * A Server Component that fetches availability server-side, so the browser is
 * never handed a Supabase key and never receives a row the availability
 * projection did not deliberately expose. Never cached: a stale "open" day that
 * turns out to be full is the worst failure mode this page has.
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
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Book the court</h1>
        <p className="mt-1 text-sm text-slate-600">
          {settings.isConfigured && <>{formatPesoCompact(settings.rateCents)}/hour · </>}
          Open {formatHour(settings.openHour)} – {formatHour(settings.closeHour)}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Tap a day, pick your time, and message us on Messenger to book.
        </p>
      </section>

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
        Grey is being booked, yellow is reserved, green is booked. We confirm on Messenger
        and lock your slot in once the downpayment is in.
      </p>
    </div>
  )
}
