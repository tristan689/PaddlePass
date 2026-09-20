'use client'

import { useActionState, useState } from 'react'
import { recordPayment } from '@/app/admin/actions'
import { INITIAL_ACTION_STATE } from '@/lib/actions/state'
import { centavosToPesos, formatPesoCompact } from '@/lib/domain/money'
import { SubmitButton } from '@/components/ui/SubmitButton'

/**
 * Record money received. The amount pre-fills with what is most likely -- the
 * configured downpayment, or the outstanding balance -- and changes when the kind
 * changes, but it is always editable: customers round up, pay partial, or pay
 * the whole thing at once.
 */
export function PaymentForm({
  bookingId,
  isPending,
  balanceCents,
  downpaymentCents,
  hasLiveDownpayment,
  today,
}: {
  bookingId: string
  isPending: boolean
  balanceCents: number
  downpaymentCents: number
  hasLiveDownpayment: boolean
  today: string
}) {
  const defaultKind = hasLiveDownpayment ? 'full_payment' : 'down_payment'
  const suggested = (kind: string) =>
    kind === 'down_payment' && downpaymentCents > 0 && downpaymentCents < balanceCents
      ? downpaymentCents
      : balanceCents

  const [kind, setKind] = useState(defaultKind)
  const [amount, setAmount] = useState(String(centavosToPesos(suggested(defaultKind))))
  const [state, action] = useActionState(recordPayment, INITIAL_ACTION_STATE)

  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="booking_id" value={bookingId} />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="font-medium text-slate-800">Kind</span>
          <select
            name="kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value)
              setAmount(String(centavosToPesos(suggested(e.target.value))))
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="down_payment" disabled={hasLiveDownpayment}>
              Down payment
            </option>
            <option value="full_payment">Full payment</option>
          </select>
        </label>

        <label className="block">
          <span className="font-medium text-slate-800">Method</span>
          <select
            name="method"
            defaultValue="gcash"
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="gcash">GCash</option>
            <option value="cash">Cash</option>
          </select>
        </label>

        <label className="block">
          <span className="font-medium text-slate-800">Amount (₱)</span>
          <input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 tabular-nums"
          />
          <span className="mt-0.5 block text-xs text-slate-500">
            Balance {formatPesoCompact(balanceCents)}
          </span>
        </label>

        <label className="block">
          <span className="font-medium text-slate-800">Received on</span>
          <input
            type="date"
            name="paid_on"
            defaultValue={today}
            max={today}
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="font-medium text-slate-800">
          GCash reference <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <input
          name="external_ref"
          maxLength={80}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono"
        />
      </label>

      <label className="block">
        <span className="font-medium text-slate-800">
          Note <span className="font-normal text-slate-500">(optional)</span>
        </span>
        <input
          name="note"
          maxLength={300}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      {isPending && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="approve" defaultChecked className="h-4 w-4" />
          <span>Approve the request at the same time</span>
        </label>
      )}

      {state.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
          {state.message}
        </p>
      )}

      <SubmitButton pendingLabel="Recording…">Record payment</SubmitButton>
    </form>
  )
}
