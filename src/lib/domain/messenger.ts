import { formatDateLong, formatHourRange, type ManilaDate } from './time'

/**
 * The public side books through Facebook Messenger, not a form. Once a customer
 * has picked their hours, the Messenger button is a deep link into the chat with
 * the booking already typed, so the first message carries everything staff need
 * to enter it in the admin.
 */

/** `https://m.me/<page>?text=...`. Tolerates a pasted `@handle`. */
export function messengerHref(page: string, text: string): string {
  const handle = page.trim().replace(/^@/, '')
  return `https://m.me/${encodeURIComponent(handle)}?text=${encodeURIComponent(text)}`
}

export interface MessageCustomer {
  name: string
  email: string
}

/**
 * The prefilled message for a chosen slot. A signed-in customer signs it with
 * their name and account email, which is what lets staff tag the booking to
 * their account when they enter it.
 */
export function bookingMessage(
  date: ManilaDate,
  startHour: number,
  endHour: number,
  customer?: MessageCustomer | null
): string {
  const hours = endHour - startHour
  const body =
    `Hi! I'm booking the court on ${formatDateLong(date)}, ` +
    `${formatHourRange(startHour, endHour)} (${hours} hour${hours === 1 ? '' : 's'}). ` +
    `Please confirm — thank you!`
  return customer ? `${body}\n— ${customer.name} (${customer.email})` : body
}
