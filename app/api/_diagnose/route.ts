import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TEMPORARY DIAGNOSTIC — remove after debugging.
// Shows the environment shape and what Supabase says about the JWT the browser
// is sending, without leaking secret values.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''

  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  const info: any = {
    hasAuthHeader: !!authHeader,
    tokenLength: token.length,
    tokenPrefix: token.slice(0, 20),
    envSupabaseUrl: url,
    envServiceKeyLength: key.length,
    envServiceKeyPrefix: key.slice(0, 20),
    envServiceKeyLooksLikeAnonKey: false,
    envAnonKeyLength: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length,
  }

  // Detect if someone pasted the anon key into the service role slot
  try {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    info.envServiceKeyLooksLikeAnonKey = key === anonKey
  } catch {}

  if (!url || !key) {
    info.error = 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY at runtime'
    return NextResponse.json(info)
  }

  if (!token) {
    info.error = 'No bearer token in Authorization header'
    return NextResponse.json(info)
  }

  const admin = createClient(url, key)
  const { data, error } = await admin.auth.getUser(token)
  info.getUserResult = {
    hasUser: !!data?.user,
    userEmail: data?.user?.email ?? null,
    errorName: error?.name ?? null,
    errorMessage: error?.message ?? null,
    errorStatus: (error as any)?.status ?? null,
  }

  return NextResponse.json(info)
}
