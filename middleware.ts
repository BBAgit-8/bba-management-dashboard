import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /hub sub-routes — not the login or confirm pages themselves
  if (
    pathname.startsWith('/hub') &&
    pathname !== '/hub' &&
    pathname !== '/hub/confirm'
  ) {
    // Supabase stores session as JSON in sb-<projectRef>-auth-token cookie
    // Check all cookies for any supabase auth token
    const cookies = req.cookies.getAll()
    const authCookie = cookies.find(c =>
      c.name.includes('-auth-token') && c.name.startsWith('sb-')
    )

    if (!authCookie?.value) {
      return NextResponse.redirect(new URL('/hub', req.url))
    }

    // Parse the JSON token value
    try {
      const parsed = JSON.parse(authCookie.value)
      // Token exists and has an access_token — allow through
      if (!parsed?.access_token && !Array.isArray(parsed)) {
        return NextResponse.redirect(new URL('/hub', req.url))
      }
    } catch {
      // Not JSON — might be a legacy bare token, allow it
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/hub/:path*'],
}
