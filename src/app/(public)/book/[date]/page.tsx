import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TimePills } from '@/components/booking/TimePills'
import { StatusLegend } from '@/components/calendar/StatusLegend'
import { getDayAvailability } from '@/lib/data/availability'
import { formatPesoCompact } from '@/lib/domain/money'
import {
  addDays,
  formatDateLong,
  formatHour,
  isManilaDate,
  monthOf,
  todayInManila,
} from '@/lib/domain/time'

/**
 * One day: pick your hours, then one button opens Messenger with the booking
 * typed out. The availability read is never cached -- it is what the customer is
 * about to quote to staff.
 */
export const dynamic = 'force-dynamic'

export default async function BookDayPage({ params }: PageProps<'/book/[date]'>) {
  const { date: raw } = await params
  if (!isManilaDate(raw)) notFound()
  const date = raw

  const today = todayInManila()
  const { day, settings } = await getDayAvailability(date)
  const backHref = `/?m=${monthOf(date)}`

  return (
    // Bottom padding keeps the fixed Messenger bar on phones from covering content.
    <div className="space-y-5 pb-28 md:pb-0">
      <nav className="flex items-center justify-between text-sm">
        <Link href={backHref} className="text-slate-600 hover:text-slate-900">
          ‹ Calendar
        </Link>
        <div className="flex gap-3">
          {date > today && (
            <Link href={`/book/${addDays(date, -1)}`} className="text-slate-600 hover:text-slate-900" rel="prev">
              ‹ Day before
            </Link>
          )}
          <Link href={`/book/${addDays(date, 1)}`} className="text-slate-600 hover:text-slate-900" rel="next">
            Day after ›
          </Link>
        </div>
      </nav>

      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{formatDateLong(date)}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Open {formatHour(settings.openHour)} – {formatHour(settings.closeHour)}
          {settings.isConfigured && <> · {formatPesoCompact(settings.rateCents)}/hour</>}
        </p>
      </header>

      {date < today ? (
        <Notice title="That date has passed.">
          <Link href={backHref} className="font-semibold underline">
            Back to the calendar
          </Link>{' '}
          to pick an upcoming day.
        </Notice>
      ) : day.closed ? (
        <Notice title={day.closedReason ?? 'Closed'}>
          The court is not open on this date.{' '}
          <Link href={`/book/${addDays(date, 1)}`} className="font-semibold underline">
            Try the next day
          </Link>
          .
        </Notice>
      ) : day.freeHoursCount === 0 ? (
        <Notice title="Fully booked.">
          Every hour on this day is taken or has passed.{' '}
          <Link href={`/book/${addDays(date, 1)}`} className="font-semibold underline">
            Try the next day
          </Link>
          .
        </Notice>
      ) : (
        <>
          <TimePills
            date={date}
            slots={day.slots}
            minHours={settings.minHours}
            maxHours={settings.maxHours}
            rateCents={settings.rateCents}
            facebookPage={settings.facebookPage}
          />
          <StatusLegend className="pt-1" />
        </>
      )}
    </div>
  )
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}
