import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /hub routes (not /hub login page itself)
  if (pathname.startsWith('/hub') && pathname !== '/hub' && pathname !== '/hub/confirm') {
    const token = req.cookies.get('sb-access-token')?.value
      ?? req.cookies.get(`sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`)?.value

    if (!token) {
      return NextResponse.redirect(new URL('/hub', req.url))
    }

    // Verify token is valid
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return NextResponse.redirect(new URL('/hub', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/hub/:path*'],
}
