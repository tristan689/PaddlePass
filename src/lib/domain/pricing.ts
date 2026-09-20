/**
 * What a booking costs.
 *
 * Two rules worth stating plainly, because both are easy to get wrong later:
 *
 *  1. Paddle rental is a FLAT FEE PER PADDLE PER BOOKING, not per hour. Four
 *     paddles cost the same for a one-hour game as for a six-hour one.
 *
 *  2. `rateCents` and `paddleFeeCents` are SNAPSHOTTED onto each booking when it
 *     is created. Raising the rate next month must never retroactively rewrite
 *     what an old logbook row says the customer owed. So pricing always takes
 *     explicit rates as arguments -- never reads current settings itself.
 */

export interface PriceInput {
  hours: number
  paddleCount: number
  /** Snapshot of the hourly rate at booking time. */
  rateCents: number
  /** Snapshot of the per-paddle fee at booking time. */
  paddleFeeCents: number
}

export interface PriceBreakdown {
  hours: number
  paddleCount: number
  courtCents: number
  paddleCents: number
  totalCents: number
}

export function priceBooking(input: PriceInput): PriceBreakdown {
  const { hours, paddleCount, rateCents, paddleFeeCents } = input

  const courtCents = hours * rateCents
  const paddleCents = paddleCount * paddleFeeCents // per booking, NOT per hour

  return {
    hours,
    paddleCount,
    courtCents,
    paddleCents,
    totalCents: courtCents + paddleCents,
  }
}

/** Never negative: an overpayment leaves a zero balance, not a negative one. */
export function balanceCents(totalCents: number, paidCents: number): number {
  return Math.max(0, totalCents - paidCents)
}

/** How much was paid beyond the total, if any. Surfaced to staff as a warning. */
export function overpaidCents(totalCents: number, paidCents: number): number {
  return Math.max(0, paidCents - totalCents)
}

export function isSettled(totalCents: number, paidCents: number): boolean {
  return totalCents > 0 && paidCents >= totalCents
}
