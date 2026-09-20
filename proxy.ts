import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`, and the exported
 * function with it. The edge runtime is not supported here; proxy always runs on
 * Node.js, which suits us -- the Supabase SSR client is happier there anyway.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images.
     *
     * /api is deliberately NOT excluded: the logbook CSV export needs the session
     * cookie refreshed like any other route.
     *
     * Without a matcher, proxy would also run on _next/static and public files,
     * and the /admin redirect would start blocking CSS and JS.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
