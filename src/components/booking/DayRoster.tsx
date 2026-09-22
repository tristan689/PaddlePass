import Link from 'next/link'
import { StatusDot } from '@/components/calendar/StatusDot'
import { ActionForm } from '@/components/ui/ActionForm'
import { Avatar } from '@/components/ui/Avatar'
import { SubmitButton } from '@/components/ui/SubmitButton'
import type { Viewer } from '@/lib/auth/viewer'
import type { RosterRow } from '@/lib/data/roster'
import { calendarStateOf, displayFor } from '@/lib/domain/status'
import { formatHourRange, type ManilaDate } from '@/lib/domain/time'
import { joinBooking, leaveBooking } from '@/app/(public)/actions'

const MAX_JOINERS = 7

/**
 * Who is playing today. Confirmed sessions only. A member who booked shows with
 * their name and photo; a guest shows as just "Booked"; anyone who joined is in
 * the row. Signed-in members can join a session that is not theirs and has room.
 */
export function DayRoster({
  sessions,
  viewer,
  date,
  today,
}: {
  sessions: RosterRow[]
  viewer: Viewer
  date: ManilaDate
  today: ManilaDate
}) {
  if (sessions.length === 0) return null
  const canAct = date >= today

  return (
    <section aria-labelledby="roster-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="roster-heading" className="text-sm font-semibold text-slate-900">
          Who&apos;s playing
        </h2>
        <p className="text-xs text-slate-500">Members can join a session.</p>
      </div>

      <ul className="divide-y divide-slate-100">
        {sessions.map((s) => {
          const state = calendarStateOf(s.status) ?? 'paid'
          const label = displayFor(state).label
          const host = s.host_name ?? null
          const full = s.participant_count >= MAX_JOINERS

          return (
            <li key={s.booking_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <StatusDot state={state} size="sm" describe={false} />
                  {formatHourRange(s.start_hour, s.end_hour)}
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                </p>

                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {host && <Avatar name={host} url={s.host_avatar} size="sm" />}
                    {s.participants.slice(0, 4).map((p, i) => (
                      <Avatar key={`${p.name}-${i}`} name={p.name} url={p.avatar} size="sm" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-600">
                    {host ? <span className="font-medium text-slate-800">{host}</span> : 'Booked'}
                    {s.participant_count > 0 && (
                      <>
                        {' · '}
                        {s.participant_count} joining
                        {s.participants.length > 0 && (
                          <span className="text-slate-500">
                            {' '}
                            ({s.participants.slice(0, 3).map((p) => p.name.split(' ')[0]).join(', ')}
                            {s.participants.length > 3 && ` +${s.participants.length - 3}`})
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {canAct && (
                <div className="w-full sm:w-auto">
                  {!viewer ? (
                    <Link
                      href={`/login?next=${encodeURIComponent(`/?view=day&d=${date}`)}`}
                      className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-900 hover:bg-slate-50 sm:inline-block"
                    >
                      Sign in to join
                    </Link>
                  ) : s.is_host ? (
                    <span className="block text-center text-xs font-medium text-slate-500 sm:inline">Your booking</span>
                  ) : s.joined ? (
                    <ActionForm action={leaveBooking}>
                      <input type="hidden" name="booking_id" value={s.booking_id} />
                      <SubmitButton tone="secondary" size="sm" className="w-full sm:w-auto" pendingLabel="…">
                        Leave
                      </SubmitButton>
                    </ActionForm>
                  ) : full ? (
                    <span className="block text-center text-xs font-medium text-slate-500 sm:inline">Full</span>
                  ) : (
                    <ActionForm action={joinBooking}>
                      <input type="hidden" name="booking_id" value={s.booking_id} />
                      <SubmitButton tone="success" size="sm" className="w-full sm:w-auto" pendingLabel="Joining…">
                        Join
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
