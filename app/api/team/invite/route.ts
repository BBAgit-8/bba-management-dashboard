import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Admin client needed to invite users via Auth
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET — list all employees with hub access status
export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, email, "hubAccess", "invitedAt", "authUserId"')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data ?? [] })
}

// POST — send invite
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { employeeId, email, name } = await req.json()
  if (!employeeId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Invite via Supabase Auth (sends magic link / setup email)
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name, role: 'employee' },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/hub`,
  })

  if (inviteError) {
    // If user already exists just update access
    if (!inviteError.message.includes('already registered')) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }
  }

  // Mark employee as having hub access
  const { error: updateError } = await supabase
    .from('employees')
    .update({
      hubAccess:  true,
      invitedAt:  new Date().toISOString(),
      authUserId: inviteData?.user?.id ?? null,
    })
    .eq('id', employeeId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — revoke access
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { employeeId } = await req.json()
  if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

  // Get authUserId first
  const { data: emp } = await supabase
    .from('employees')
    .select('authUserId')
    .eq('id', employeeId)
    .single()

  // Delete from Supabase Auth if exists
  if (emp?.authUserId) {
    await supabaseAdmin.auth.admin.deleteUser(emp.authUserId)
  }

  // Remove hub access
  const { error } = await supabase
    .from('employees')
    .update({ hubAccess: false, invitedAt: null, authUserId: null })
    .eq('id', employeeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
