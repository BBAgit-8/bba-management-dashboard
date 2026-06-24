import { NextRequest, NextResponse } from 'next/server'

// Auth is handled client-side in hub pages via supabaseClient.auth.getSession()
// No server-side middleware needed
export async function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
