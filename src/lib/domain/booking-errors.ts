/**
 * The database raises stable, machine-readable codes (`raise exception 'SLOT_TAKEN'`)
 * and this module is the ONLY place they become sentences a customer or a staff
 * member can act on. Keeping the mapping here means the SQL never has to know how
 * the UI phrases things, and the UI never has to parse Postgres error text.
 *
 * Anything unrecognised gets a generic message: an unexpected error's raw text is
 * for the server log, not for a customer's phone screen.
 */

const CUSTOMER_MESSAGES: Record<string, string> = {
  NOT_CONFIGURED:
    'Online booking is not open yet. Please message us on Facebook to book the court.',
  MISSING_DETAILS: 'Please fill in your name, contact number and Facebook name.',
  DETAILS_TOO_LONG: 'One of your details is too long. Please shorten it and try again.',
  DATE_PAST: 'That date has already passed.',
  TIME_PAST: 'That time has already passed. Please pick a later hour.',
  OUTSIDE_HOURS: 'That time is outside our opening hours.',
  INVALID_RANGE: 'The end time must be after the start time.',
  BELOW_MIN_HOURS: 'That booking is shorter than our minimum.',
  ABOVE_MAX_HOURS: 'That booking is longer than our maximum.',
  CLOSED_WEEKDAY: 'The court is closed on that day of the week.',
  DATE_BLOCKED: 'The court is closed on that date.',
  INVALID_PADDLES: 'Please choose a valid number of paddles.',
  PADDLES_UNAVAILABLE: 'We do not have that many paddles to rent. Please choose fewer.',
  SLOT_TAKEN:
    'Sorry — someone else just took that time. The calendar has been refreshed; please pick another slot.',
}

const STAFF_MESSAGES: Record<string, string> = {
  NOT_STAFF: 'Your account is not an active staff account.',
  NOT_FOUND: 'That booking no longer exists.',
  NOT_PENDING: 'Only a pending request can be approved. Refresh to see its current status.',
  INVALID_STATUS: 'That is not a valid resolution.',
  INVALID_AMOUNT: 'Enter an amount greater than zero.',
  INVALID_KIND: 'Choose whether this is a downpayment or a full payment.',
  INVALID_METHOD: 'Choose cash or GCash.',
  REASON_REQUIRED: 'A reason is required.',
  INVALID_RANGE: 'The end time must be after the start time.',
  OUTSIDE_HOURS: 'That time is outside opening hours.',
  SLOT_TAKEN: 'Another booking already occupies that time. Pick a different slot.',
}

const GENERIC_CUSTOMER =
  'Something went wrong on our side. Please try again, or message us on Facebook.'
const GENERIC_STAFF = 'Something went wrong. Please try again.'

/**
 * The first UPPER_SNAKE token in the message that is a code we know. Postgres
 * usually hands the code over bare, but PostgREST and some drivers prefix
 * `ERROR:` -- scanning for a *known* token rather than the first uppercase word
 * is what keeps that prefix from swallowing the real code.
 */
function knownCode(raw: string | undefined | null, table: Record<string, string>): string | null {
  if (!raw) return null
  for (const token of raw.match(/\b[A-Z][A-Z_]{2,}\b/g) ?? []) {
    if (token in table) return token
  }
  return null
}

export function customerMessageFor(raw: string | undefined | null): string {
  const code = knownCode(raw, CUSTOMER_MESSAGES)
  return code ? CUSTOMER_MESSAGES[code] : GENERIC_CUSTOMER
}

export function staffMessageFor(raw: string | undefined | null): string {
  const code = knownCode(raw, STAFF_MESSAGES)
  if (code) return STAFF_MESSAGES[code]
  // Payments ledger uniqueness: one live downpayment / full payment per booking.
  if (raw && /payments_one_live_(down|full)_idx/.test(raw)) {
    return 'That kind of payment is already recorded on this booking. Void the old one first.'
  }
  return GENERIC_STAFF
}

/** True when the failure means the slot picker should be redrawn, not just retried. */
export function shouldRefreshAvailability(raw: string | undefined | null): boolean {
  const code = knownCode(raw, CUSTOMER_MESSAGES)
  return code === 'SLOT_TAKEN' || code === 'TIME_PAST' || code === 'DATE_BLOCKED'
}
