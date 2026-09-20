import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SlotPicker } from '@/components/booking/SlotPicker'
import { StatusLegend } from '@/components/calendar/StatusLegend'
import { getDayAvailability } from '@/lib/data/availability'
import {
  addDays,
  formatDateLong,
  isManilaDate,
  monthOf,
  todayInManila,
} from '@/lib/domain/time'

/**
 * One day: pick your hours, tell us who you are, send the request.
 *
 * The availability read here is the one immediately before a submit, so it is
 * never cached. It is still only advisory -- the EXCLUDE constraint decides the
 * race -- which is why the picker also knows how to say "someone just took that".
 */
export const dynamic = 'force-dynamic'

export default async function BookDayPage({ params }: PageProps<'/book/[date]'>) {
  const { date: raw } = await params
  if (!isManilaDate(raw)) notFound()
  const date = raw

  const today = todayInManila()
  const { day, settings } = await getDayAvailability(date)

  const backHref = `/?m=${monthOf(date)}`
  const heading = formatDateLong(date)

  return (
    <div className="space-y-5">
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
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{heading}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {settings.courtName} · {settings.isConfigured ? 'Pick your hours below.' : ''}
        </p>
      </header>

      {!settings.isConfigured ? (
        <Notice tone="warn" title="Online booking is not open yet.">
          Please message us on Facebook to book the court while we finish setting this up.
        </Notice>
      ) : date < today ? (
        <Notice tone="muted" title="That date has passed.">
          <Link href={backHref} className="font-semibold underline">
            Back to the calendar
          </Link>{' '}
          to pick an upcoming day.
        </Notice>
      ) : day.closed ? (
        <Notice tone="muted" title={day.closedReason ?? 'Closed'}>
          The court is not open on this date.{' '}
          <Link href={`/book/${addDays(date, 1)}`} className="font-semibold underline">
            Try the next day
          </Link>
          .
        </Notice>
      ) : day.freeHoursCount === 0 ? (
        <Notice tone="muted" title="Fully booked.">
          Every hour on this day is taken or has passed.{' '}
          <Link href={`/book/${addDays(date, 1)}`} className="font-semibold underline">
            Try the next day
          </Link>
          .
        </Notice>
      ) : (
        <>
          <SlotPicker
            date={date}
            dateLabel={heading}
            slots={day.slots}
            minHours={settings.minHours}
            maxHours={settings.maxHours}
            paddlesOwned={settings.paddlesOwned}
            rateCents={settings.rateCents}
            paddleFeeCents={settings.paddleFeeCents}
            downpaymentCents={settings.downpaymentCents}
            holdMinutes={settings.holdMinutes}
          />
          <StatusLegend className="pt-1" />
        </>
      )}
    </div>
  )
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: 'warn' | 'muted'
  title: string
  children: React.ReactNode
}) {
  const look =
    tone === 'warn'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-slate-200 bg-white text-slate-700'
  return (
    <div role="status" className={`rounded-lg border p-4 text-sm ${look}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}
