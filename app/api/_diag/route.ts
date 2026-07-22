import { NextResponse } from 'next/server'

// Diagnostic-only route. Reads process.env with no other imports so we
// can tell whether the Worker's env is populated independent of any
// module-load failures elsewhere in the app.
export async function GET() {
  const envKeys = Object.keys(process.env).sort()
  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    envKeyCount: envKeys.length,
    envKeys,
    supabase: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
    },
  })
}
