/**
 * The ONE place a booking status becomes a colour, a glyph and a label.
 *
 * The calendar, the slot picker, the admin views, the logbook badges and the print
 * stylesheet all read from here. Renaming a state or retuning a colour is a single
 * edit, and the public and admin sides can never disagree about what yellow means.
 *
 * Accessibility rule this module enforces: colour NEVER carries meaning alone.
 * Every state also has a distinct fill geometry, a glyph, and a text label, so it
 * survives colourblindness, a greyscale printout, and a screen reader.
 */

/** Stored lifecycle status. Irreducible -- cannot be derived from payments alone. */
export type BookingStatus =
  | 'pending' // public submitted, holding the slot, awaiting admin
  | 'approved' // admin said yes; no money recorded yet
  | 'downpayment' // partially paid
  | 'paid' // settled
  | 'completed' // played and settled
  | 'cancelled' // called off after approval
  | 'declined' // admin rejected the request
  | 'expired' // hold ran out before anyone confirmed
  | 'no_show' // booked, paid or not, never turned up

/** What a calendar cell shows. Collapses lifecycle into visual states. */
export type CalendarState =
  | 'free'
  | 'pending'
  | 'approved'
  | 'downpayment'
  | 'paid'
  | 'closed'
  | 'past'

/** Statuses that occupy the slot and therefore appear on the calendar. */
export const BLOCKING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'approved',
  'downpayment',
  'paid',
  'completed',
  'no_show',
] as const

export function isBlocking(status: BookingStatus): boolean {
  return BLOCKING_STATUSES.includes(status)
}

/** Statuses that free the slot again. */
export function isReleased(status: BookingStatus): boolean {
  return !isBlocking(status)
}

export function calendarStateOf(status: BookingStatus): CalendarState | null {
  switch (status) {
    case 'pending':
      return 'pending'
    case 'approved':
      return 'approved'
    case 'downpayment':
      return 'downpayment'
    case 'paid':
    case 'completed':
      return 'paid'
    case 'no_show':
      return 'approved' // still occupied the slot; reads as "not settled"
    case 'cancelled':
    case 'declined':
    case 'expired':
      return null // slot is free again
  }
}

export interface StateDisplay {
  /** Short word on the calendar cell. */
  label: string
  /** Redundant with colour: readable in greyscale and by colourblind users. */
  glyph: string
  /** Fill geometry -- the channel that works with no colour at all. */
  fill: 'none' | 'dashed' | 'outlined' | 'half' | 'full' | 'hatched' | 'faded'
  /** Tailwind classes for the swatch. Tokens are defined in globals.css. */
  className: string
  /** Full sentence for screen readers and `title`. */
  description: string
}

const DISPLAY: Record<CalendarState, StateDisplay> = {
  free: {
    label: 'Open',
    glyph: '·',
    fill: 'none',
    className: 'bg-slot-free border-slate-300 text-slate-900',
    description: 'Open — available to book',
  },
  pending: {
    label: 'Pending',
    glyph: '○',
    fill: 'dashed',
    className: 'bg-slot-pending border-dashed border-slate-400 text-slate-900',
    description: 'Pending — someone has requested this, not yet confirmed',
  },
  // The gym's three-colour rule: grey = being booked, yellow = reserved (we said
  // yes, no money yet), green = booked (downpayment or more received).
  approved: {
    label: 'Reserved',
    glyph: '◐',
    fill: 'half',
    className: 'bg-slot-down border-amber-500 text-slate-900',
    description: 'Reserved — confirmed with us, downpayment still to come',
  },
  downpayment: {
    label: 'Booked',
    glyph: '●',
    fill: 'full',
    className: 'bg-slot-paid border-emerald-600 text-slate-900',
    description: 'Booked — downpayment received',
  },
  paid: {
    label: 'Booked',
    glyph: '●',
    fill: 'full',
    className: 'bg-slot-paid border-emerald-600 text-slate-900',
    description: 'Booked — paid in full',
  },
  closed: {
    label: 'Closed',
    glyph: '✕',
    fill: 'hatched',
    className: 'bg-slot-closed border-slate-300 text-slate-500',
    description: 'Closed — the court is not open at this time',
  },
  past: {
    label: 'Past',
    glyph: '',
    fill: 'faded',
    className: 'bg-slot-free border-slate-200 text-slate-400 opacity-50',
    description: 'Past — this time has already gone',
  },
}

export function displayFor(state: CalendarState): StateDisplay {
  return DISPLAY[state]
}

/**
 * Legend order, public-facing. `past` needs no explaining, and `downpayment`
 * paints identically to `paid`, so one green entry covers both.
 */
export const LEGEND_STATES: readonly CalendarState[] = [
  'free',
  'pending',
  'approved',
  'paid',
  'closed',
] as const

/** Admin-facing wording, which is blunter than what customers see. */
const ADMIN_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  approved: 'Reserved · unpaid',
  downpayment: 'Booked · downpayment',
  paid: 'Booked · fully paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
  expired: 'Expired',
  no_show: 'No-show',
}

export function adminLabelFor(status: BookingStatus): string {
  return ADMIN_LABELS[status]
}

// ---------------------------------------------------------------------------
// Customer-facing wording for the /r/<reference> status page.
//
// Blunter admin labels live above; a customer needs to know what happens next,
// not the lifecycle name. `tone` picks the banner colour and is, as always,
// accompanied by the words.
// ---------------------------------------------------------------------------

export interface CustomerStatus {
  title: string
  detail: string
  tone: 'neutral' | 'good' | 'warn' | 'bad'
}

const CUSTOMER_STATUS: Record<BookingStatus, CustomerStatus> = {
  pending: {
    title: 'Request received — waiting for confirmation',
    detail:
      'Your slot is on hold while we confirm. Message us on Facebook with your reference to speed things up.',
    tone: 'warn',
  },
  approved: {
    title: 'Reserved — downpayment pending',
    detail: 'We have confirmed your slot. Send the downpayment to lock it in as booked.',
    tone: 'warn',
  },
  downpayment: {
    title: 'Booked — downpayment received',
    detail: 'Your court is booked. Pay the balance at the court before you play.',
    tone: 'good',
  },
  paid: {
    title: 'Booked — paid in full',
    detail: 'You are all set. See you on the court!',
    tone: 'good',
  },
  completed: {
    title: 'Completed',
    detail: 'Thanks for playing with us. Book again any time.',
    tone: 'good',
  },
  cancelled: {
    title: 'Cancelled',
    detail: 'This booking was cancelled. Message us on Facebook if that is a surprise.',
    tone: 'bad',
  },
  declined: {
    title: 'Not approved',
    detail: 'We could not take this booking. Message us on Facebook and we will help you find a time.',
    tone: 'bad',
  },
  expired: {
    title: 'Request expired',
    detail: 'The hold on your slot ran out before it was confirmed. You are welcome to book again.',
    tone: 'bad',
  },
  no_show: {
    title: 'Marked as no-show',
    detail: 'We did not see you for this booking. Message us if something went wrong.',
    tone: 'bad',
  },
}

export function customerStatusFor(status: BookingStatus): CustomerStatus {
  return CUSTOMER_STATUS[status]
}

/** Every stored status, for the logbook filter dropdown. */
export const ALL_STATUSES: readonly BookingStatus[] = [
  'pending',
  'approved',
  'downpayment',
  'paid',
  'completed',
  'cancelled',
  'declined',
  'expired',
  'no_show',
] as const
