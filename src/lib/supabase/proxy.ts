import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabasePublishableKey, supabaseUrl } from './env'

/**
 * Refresh the auth session on every request, and bounce anonymous visitors away
 * from /admin.
 *
 * SECURITY BOUNDARY, stated clearly: this is a UX redirect, NOT the security
 * boundary. Server Actions are POSTs to whatever route they are used on, so a
 * change to the matcher below can silently stop protecting them. The real
 * boundary is `requireStaff()` inside every action plus RLS in the database.
 * Both of those still hold if this file is deleted entirely.
 *
 * Deliberately NOT redirecting a signed-in visitor away from /login. A user can
 * hold a valid session and still not be active staff (deactivated, or invited but
 * never added to the roster). /login is where that case is explained and a
 * sign-out offered; bouncing them to /admin would loop straight back here.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // MUST be the first call after creating the client, with no logic in between.
  // This is what actually refreshes the token; separating it from the client
  // construction is the classic cause of users being logged out at random.
  //
  // getClaims() verifies the JWT locally against the JWKS endpoint instead of
  // calling the auth server on every request.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin') && !claims) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname) // return here after signing in
    return NextResponse.redirect(url)
  }

  // Return `response` as-is. If you ever need to build a different response,
  // copy the cookies across first:
  //   mine.cookies.setAll(response.cookies.getAll())
  // Dropping them discards the refreshed session.
  return response
}
