import { ActionForm } from '@/components/ui/ActionForm'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { requireOwner } from '@/lib/auth/require-staff'
import { getSettingsRow } from '@/lib/data/admin'
import { centavosToPesos } from '@/lib/domain/money'
import { formatHour, WEEKDAY_LABELS } from '@/lib/domain/time'
import { saveSettings } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Every operating rule, editable without a deploy. Owner-only, because each of
 * these changes what a customer pays or when they can play.
 */
export default async function SettingsPage() {
  await requireOwner()
  const s = await getSettingsRow()

  const hours = Array.from({ length: 25 }, (_, h) => h)
  const pesos = (cents: number) => String(centavosToPesos(cents))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Changes apply to new bookings immediately. Existing bookings keep the rate they were made at.
        </p>
      </header>

      {s.rate_cents === 0 && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Online booking is closed</strong> until the hourly rate is set above zero.
        </p>
      )}

      <ActionForm action={saveSettings} className="space-y-6">
        <Section title="Pricing">
          <Money label="Court rate per hour (₱)" name="rate" defaultValue={pesos(s.rate_cents)} />
          <Money label="Downpayment to reserve (₱)" name="downpayment" defaultValue={pesos(s.downpayment_cents)} />
          <Money
            label="Paddle rental, per paddle per booking (₱)"
            name="paddle_fee"
            defaultValue={pesos(s.paddle_fee_cents)}
            hint="A flat fee for the whole booking — not per hour."
          />
          <Num label="Paddles owned" name="paddles_owned" defaultValue={s.paddles_owned} min={0} max={50} />
        </Section>

        <Section title="Hours">
          <label className="block text-sm">
            <span className="font-medium text-slate-800">Opens</span>
            <select name="open_hour" defaultValue={s.open_hour} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {hours.slice(0, 24).map((h) => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-800">Closes</span>
            <select name="close_hour" defaultValue={s.close_hour} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              {hours.slice(1).map((h) => (
                <option key={h} value={h}>{h === 24 ? '12:00 AM (midnight)' : formatHour(h)}</option>
              ))}
            </select>
            <span className="mt-0.5 block text-xs text-slate-500">The last bookable slot ends at closing time.</span>
          </label>
          <Num label="Shortest booking (hours)" name="min_hours" defaultValue={s.min_hours} min={1} max={24} />
          <Num label="Longest booking (hours)" name="max_hours" defaultValue={s.max_hours} min={1} max={24} />

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-800">Closed every</legend>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {WEEKDAY_LABELS.map((label, i) => (
                <label key={label} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="closed_weekdays"
                    value={i}
                    defaultChecked={s.closed_weekdays.includes(i)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section title="Requests">
          <Num
            label="Hold a request for (minutes)"
            name="hold_minutes"
            defaultValue={s.hold_minutes}
            min={5}
            max={24 * 60}
            hint="How long a pending request blocks its slot before it expires on its own."
          />
        </Section>

        <Section title="Identity">
          <label className="block text-sm">
            <span className="font-medium text-slate-800">Court name</span>
            <input name="court_name" defaultValue={s.court_name} maxLength={60} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-800">Facebook page</span>
            <input name="facebook_page" defaultValue={s.facebook_page} maxLength={100} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2" />
            <span className="mt-0.5 block text-xs text-slate-500">
              The handle after facebook.com/ — drives the “Message us” button.
            </span>
          </label>
        </Section>

        <SubmitButton size="lg" pendingLabel="Saving…">Save settings</SubmitButton>
      </ActionForm>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-slate-500">{title.toUpperCase()}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Money({ label, name, defaultValue, hint }: { label: string; name: string; defaultValue: string; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <input
        name={name}
        inputMode="decimal"
        defaultValue={defaultValue}
        required
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 tabular-nums"
      />
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

function Num({
  label,
  name,
  defaultValue,
  min,
  max,
  hint,
}: {
  label: string
  name: string
  defaultValue: number
  min: number
  max: number
  hint?: string
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={1}
        required
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 tabular-nums"
      />
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}
