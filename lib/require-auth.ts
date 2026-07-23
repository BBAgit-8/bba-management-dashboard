import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Server-side auth gate for API routes.
 *
 * Reads `Authorization: Bearer <jwt>` from the request, validates the JWT
 * against Supabase Auth, and returns either a 401 response (call site should
 * return it directly) or `null` (call site continues).
 *
 * Usage:
 *   export async function GET(req: NextRequest) {
 *     const gate = await requireAuth(req)
 *     if (gate) return gate
 *     // ... existing code
 *   }
 *
 * The browser attaches the JWT automatically via lib/authed-fetch.ts.
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = header.slice(7).trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

/**
 * Same as requireAuth but returns the authenticated user's email/id on success
 * instead of null. Use when the route needs to know who is calling
 * (e.g. /api/hub/me should return the caller's own record, not an arbitrary
 * email passed in a query string).
 */
export async function requireAuthUser(
  req: NextRequest
): Promise<{ user: { id: string; email: string | null } } | NextResponse> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = header.slice(7).trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { user: { id: data.user.id, email: data.user.email ?? null } }
}
