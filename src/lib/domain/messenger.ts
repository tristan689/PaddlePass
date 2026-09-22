import { formatDateLong, type ManilaDate } from './time'

/**
 * The public side books through Facebook Messenger, not a form. A day on the
 * calendar is a deep link into the conversation with the date already typed, so
 * the customer's first message carries what staff need to look it up.
 */

/** `https://m.me/<page>?text=...`. Tolerates a pasted `@handle`. */
export function messengerHref(page: string, text: string): string {
  const handle = page.trim().replace(/^@/, '')
  return `https://m.me/${encodeURIComponent(handle)}?text=${encodeURIComponent(text)}`
}

/** The prefilled opener for a calendar day. */
export function bookingEnquiry(date: ManilaDate): string {
  return `Hi! I'd like to book the court on ${formatDateLong(date)}. What times are open?`
}
