import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/require-auth'

// Return the employee record for the authenticated caller. Identity is taken
// from the verified JWT — never from a query parameter — so one logged-in user
// cannot look up another user's employee row by passing a different email.
export async function GET(req: NextRequest) {
  const gate = await requireAuthUser(req)
  if (gate instanceof NextResponse) return gate

  const email = gate.user.email
  if (!email) {
    return NextResponse.json({ error: 'Authenticated user has no email' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, name')
    .eq('email', email)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  return NextResponse.json({ id: data.id, name: data.name })
}
