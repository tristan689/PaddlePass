import { StatusLegend } from '@/components/calendar/StatusLegend'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { DateStrip } from '@/components/calendar/DateStrip'
import { getMonthAvailability, getStripAvailability } from '@/lib/data/availability'
import { formatPesoCompact } from '@/lib/domain/money'
import { formatHour, resolveMonth, todayInManila } from '@/lib/domain/time'

/**
 * The public booking calendar — what a Facebook link opens.
 *
 * View-only by design: it shows WHEN the court is free, and a tap on an open day
 * drops the customer into Messenger with the date already typed. Staff take it
 * from there and record the booking in the admin. No form, no account, nothing
 * for a customer to get wrong.
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
          Tap a day with open hours and we&apos;ll pick it up on Facebook Messenger.
        </p>
      </section>

      {/* Mobile: filmstrip of the next three weeks. */}
      <section className="md:hidden">
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-slate-500">
          PICK A DATE
        </h2>
        <DateStrip days={strip.days} facebookPage={settings.facebookPage} />
      </section>

      {/* Desktop: the full month. */}
      <MonthGrid
        month={month}
        days={days}
        facebookPage={settings.facebookPage}
        className="hidden md:block"
      />

      <StatusLegend className="pt-1" />

      <p className="text-xs leading-relaxed text-slate-500">
        Bookings are arranged and confirmed on Messenger — we&apos;ll reply with the open
        times for your day and how to pay.
      </p>
    </div>
  )
}
