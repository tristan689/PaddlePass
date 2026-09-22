import Link from 'next/link'
import { DayRoster } from '@/components/booking/DayRoster'
import { TimePills } from '@/components/booking/TimePills'
import { MonthGrid } from '@/components/calendar/MonthGrid'
import { StatusLegend } from '@/components/calendar/StatusLegend'
import { pickView, ViewSwitcher } from '@/components/calendar/ViewSwitcher'
import { WeekView } from '@/components/calendar/WeekView'
import { FindUs } from '@/components/social/FindUs'
import { getViewer, type Viewer } from '@/lib/auth/viewer'
import {
  getDayAvailability,
  getMonthAvailability,
  getStripAvailability,
} from '@/lib/data/availability'
import { getDayRoster, type RosterRow } from '@/lib/data/roster'
import type { PublicSettings } from '@/lib/data/settings'
import { formatPesoCompact } from '@/lib/domain/money'
import {
  addDays,
  firstOfMonth,
  formatDateLong,
  formatHour,
  isManilaDate,
  monthOf,
  resolveMonth,
  todayInManila,
  weekdayOf,
  type ManilaDate,
} from '@/lib/domain/time'

/**
 * The public booking calendar — what a Facebook link opens.
 *
 * One page, three views, all in the URL: ?view=day|week|month with an anchor
 * date. View-only by design: it shows WHEN the court is free, and once hours are
 * picked a single button drops the customer into Messenger with the booking
 * already typed. No form.
 *
 * A Server Component: availability is fetched server-side so the browser never
 * sees a Supabase key or a customer name. Never cached -- a stale "open" hour
 * quoted to staff is the worst failure mode this page has.
 */
export const dynamic = 'force-dynamic'

export default async function CalendarPage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams
  const view = pickView(params.view)
  const today = todayInManila()

  const requested = typeof params.d === 'string' ? params.d : ''
  const anchor: ManilaDate = isManilaDate(requested) ? requested : today
  const month = resolveMonth(
    typeof params.m === 'string' ? params.m : view === 'month' ? undefined : monthOf(anchor)
  )
  // Switching from Month back to Day/Week should land somewhere in that month.
  const switcherAnchor = view === 'month' ? (monthOf(today) === month ? today : firstOfMonth(month)) : anchor

  const viewer = await getViewer()
  const customer = viewer?.kind === 'customer' ? { name: viewer.name, email: viewer.email } : null
  // From "Book as a guest instead" on the sign-in page: open the name step directly.
  const guest = params.guest === '1'

  let settings: PublicSettings
  let body: React.ReactNode

  if (view === 'day') {
    const [result, roster] = await Promise.all([getDayAvailability(anchor), getDayRoster(anchor)])
    settings = result.settings
    body = (
      <DayView
        date={anchor}
        today={today}
        day={result.day}
        settings={settings}
        customer={customer}
        roster={roster}
        viewer={viewer}
        guest={guest}
      />
    )
  } else if (view === 'month') {
    const result = await getMonthAvailability(month)
    settings = result.settings
    body = <MonthGrid month={month} days={result.days} />
  } else {
    const weekStart = addDays(anchor, -weekdayOf(anchor))
    const result = await getStripAvailability(weekStart, 7)
    settings = result.settings
    body = <WeekView days={result.days} today={today} />
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Book the court</h1>
          <p className="mt-1 text-sm text-slate-600">
            {settings.isConfigured && <>{formatPesoCompact(settings.rateCents)}/hour · </>}
            Open {formatHour(settings.openHour)} – {formatHour(settings.closeHour)}
          </p>
        </div>
        <ViewSwitcher view={view} anchor={switcherAnchor} month={month} />
      </section>

      {body}

      <StatusLegend />

      <FindUs />
    </div>
  )
}

/** The Day view: date navigation plus the hour pills, or a plain reason there are none. */
function DayView({
  date,
  today,
  day,
  settings,
  customer,
  roster,
  viewer,
  guest,
}: {
  date: ManilaDate
  today: ManilaDate
  day: Awaited<ReturnType<typeof getDayAvailability>>['day']
  settings: PublicSettings
  customer: { name: string; email: string } | null
  roster: RosterRow[]
  viewer: Viewer
  guest: boolean
}) {
  const nav = 'rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900'

  return (
    <section aria-label={formatDateLong(date)} className="space-y-4">
      <header className="flex items-center justify-between">
        <Link
          href={`/?view=day&d=${addDays(date, -1)}`}
          rel="prev"
          aria-disabled={date <= today || undefined}
          className={`${nav} ${date <= today ? 'pointer-events-none opacity-30' : ''}`}
        >
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Previous day</span>
        </Link>
        <h2 className="text-center text-sm font-semibold tracking-widest text-slate-900">
          {formatDateLong(date).toUpperCase()}
          {date === today && <span className="ml-2 font-normal text-slate-500">TODAY</span>}
        </h2>
        <Link href={`/?view=day&d=${addDays(date, 1)}`} rel="next" className={nav}>
          <span aria-hidden="true">›</span>
          <span className="sr-only">Next day</span>
        </Link>
      </header>

      {date < today ? (
        <Notice title="That date has passed.">Pick an upcoming day from the Week or Month view.</Notice>
      ) : day.closed ? (
        <Notice title={day.closedReason ?? 'Closed'}>The court is not open on this date.</Notice>
      ) : day.freeHoursCount === 0 ? (
        <Notice title="Fully booked.">Every hour on this day is taken or has passed.</Notice>
      ) : (
        <TimePills
          date={date}
          slots={day.slots}
          minHours={settings.minHours}
          maxHours={settings.maxHours}
          rateCents={settings.rateCents}
          facebookPage={settings.facebookPage}
          customer={customer}
          initialGuest={guest}
        />
      )}

      <DayRoster sessions={roster} viewer={viewer} date={date} today={today} />
    </section>
  )
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}
