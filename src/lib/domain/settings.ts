/**
 * Court settings. Every operating rule lives here rather than in code, so the
 * owner can change hours, rates and paddle stock without a deploy.
 *
 * Money is integer centavos everywhere. Floats are never used for pesos --
 * 0.1 + 0.2 problems in a payment ledger are not recoverable after the fact.
 */

export interface Settings {
  /** First bookable hour, 0-23. */
  openHour: number
  /** Last hour is `closeHour - 1`. 22 means the 21:00-22:00 slot is the last. */
  closeHour: number
  /** Shortest booking, in whole hours. */
  minHours: number
  /** Longest booking, in whole hours. */
  maxHours: number
  /** Weekdays the court is shut, 0 = Sunday .. 6 = Saturday. */
  closedWeekdays: number[]

  /** Court rate, centavos per hour. */
  rateCents: number
  /** Fixed downpayment required to hold a booking, centavos. */
  downpaymentCents: number

  /** Flat fee per paddle for the whole booking -- NOT per hour. */
  paddleFeeCents: number
  /** How many paddles the gym owns. Caps what a customer can request. */
  paddlesOwned: number

  /** Minutes a pending request holds its slot before auto-releasing. */
  holdMinutes: number

  /** Facebook page handle for the m.me link, without the domain. */
  facebookPage: string
  /** Shown on the public header. */
  courtName: string
}

/**
 * Seeded on first run. Money is deliberately zero: the owner sets real figures
 * in Settings before going live, and `isConfigured()` drives the setup prompt.
 * Shipping a plausible-looking fake rate would be worse than an obvious blank.
 */
export const DEFAULT_SETTINGS: Settings = {
  openHour: 6,
  closeHour: 22,
  minHours: 1,
  maxHours: 6,
  closedWeekdays: [],

  rateCents: 0,
  downpaymentCents: 0,

  paddleFeeCents: 0,
  paddlesOwned: 0,

  holdMinutes: 120, // 2 hours

  facebookPage: 'undefeated.fitnesscenter',
  courtName: 'Undefeated Pickleball',
}

/** True once the owner has entered a real hourly rate. Gates the setup banner. */
export function isConfigured(settings: Settings): boolean {
  return settings.rateCents > 0
}

/** Every bookable hour on an open day, ascending. */
export function openHours(settings: Settings): number[] {
  const count = Math.max(0, settings.closeHour - settings.openHour)
  return Array.from({ length: count }, (_, i) => settings.openHour + i)
}

/** Total bookable hours in one open day -- the utilization denominator. */
export function hoursPerDay(settings: Settings): number {
  return Math.max(0, settings.closeHour - settings.openHour)
}

export function isClosedWeekday(settings: Settings, weekday: number): boolean {
  return settings.closedWeekdays.includes(weekday)
}

/**
 * Validation for the Settings form itself. Returns human-readable problems;
 * an empty array means the settings are coherent.
 *
 * `closeHour` may be 24 (midnight) but never wraps past it -- a slot crossing
 * midnight would break the single-day range model the booking table relies on.
 */
export function validateSettings(s: Settings): string[] {
  const issues: string[] = []

  if (!Number.isInteger(s.openHour) || s.openHour < 0 || s.openHour > 23)
    issues.push('Opening time must be a whole hour between 0 and 23.')
  if (!Number.isInteger(s.closeHour) || s.closeHour < 1 || s.closeHour > 24)
    issues.push('Closing time must be a whole hour between 1 and 24.')
  if (s.closeHour <= s.openHour)
    issues.push('Closing time must be later than opening time.')

  if (s.minHours < 1) issues.push('Minimum booking must be at least 1 hour.')
  if (s.maxHours < s.minHours)
    issues.push('Maximum booking cannot be shorter than the minimum.')
  if (s.maxHours > hoursPerDay(s))
    issues.push(
      `Maximum booking (${s.maxHours}h) is longer than the court is open (${hoursPerDay(s)}h).`
    )

  if (s.closedWeekdays.length >= 7)
    issues.push('The court cannot be closed every day of the week.')
  if (s.closedWeekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    issues.push('Closed weekdays must be between 0 (Sunday) and 6 (Saturday).')

  if (s.rateCents < 0) issues.push('Hourly rate cannot be negative.')
  if (s.downpaymentCents < 0) issues.push('Downpayment cannot be negative.')
  if (s.paddleFeeCents < 0) issues.push('Paddle fee cannot be negative.')
  if (s.paddlesOwned < 0) issues.push('Paddles owned cannot be negative.')

  if (s.holdMinutes < 5)
    issues.push('Hold time must be at least 5 minutes, or requests expire before anyone sees them.')

  if (!s.facebookPage.trim())
    issues.push('A Facebook page handle is needed for the "Message the admin" button.')

  return issues
}
