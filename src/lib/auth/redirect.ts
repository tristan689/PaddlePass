/**
 * Where to send someone after they sign in.
 *
 * The `next` query parameter is attacker-controllable (it is in the URL), so it is
 * never trusted as-is. Only a same-origin path into the admin or the customer
 * account area is honoured; anything else -- an absolute URL, a protocol-relative
 * `//evil.example`, a path elsewhere on the site -- collapses to the default. An
 * open redirect on a login page is exactly the kind of thing a phishing link exploits.
 */
export const DEFAULT_AFTER_LOGIN = '/admin'

const ALLOWED_PREFIXES = ['/admin', '/account'] as const

export function safeNextPath(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return DEFAULT_AFTER_LOGIN

  // Must be a single-slash-rooted path: rejects `//host`, `http://`, `\\host`.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_AFTER_LOGIN
  }
  if (!ALLOWED_PREFIXES.some((p) => value === p || value.startsWith(`${p}/`))) {
    return DEFAULT_AFTER_LOGIN
  }

  // Strip anything that could smuggle a second URL or control characters.
  if (/[\s<>"']/.test(value)) return DEFAULT_AFTER_LOGIN

  return value
}
