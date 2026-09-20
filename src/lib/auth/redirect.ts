/**
 * Where to send someone after they sign in.
 *
 * The `next` query parameter is attacker-controllable (it is in the URL), so it is
 * never trusted as-is. Only a same-origin path under /admin is honoured; anything
 * else -- an absolute URL, a protocol-relative `//evil.example`, a path outside
 * the admin area -- collapses to the dashboard. An open redirect on a login page
 * is exactly the kind of thing a phishing link exploits.
 */
export const DEFAULT_AFTER_LOGIN = '/admin'

export function safeNextPath(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return DEFAULT_AFTER_LOGIN

  // Must be a single-slash-rooted path: rejects `//host`, `http://`, `\\host`.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_AFTER_LOGIN
  }
  // Only the admin area is a sensible destination after logging in.
  if (value !== '/admin' && !value.startsWith('/admin/')) return DEFAULT_AFTER_LOGIN

  // Strip anything that could smuggle a second URL or control characters.
  if (/[\s<>"']/.test(value)) return DEFAULT_AFTER_LOGIN

  return value
}
