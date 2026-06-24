import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalize fields that may or may not exist in DB
  const employees = (data ?? []).map((e: any) => ({
    id:         e.id,
    name:       e.name,
    email:      e.email ?? null,
    hubAccess:  e.hubAccess ?? e.hub_access ?? false,
    invitedAt:  e.invitedAt ?? e.invited_at ?? null,
    authUserId: e.authUserId ?? e.auth_user_id ?? null,
  }))

  return NextResponse.json({ employees })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { employeeId, email, name } = body
  if (!employeeId || !email) {
    return NextResponse.json({ error: 'Missing employeeId or email' }, { status: 400 })
  }

  // Send Supabase invite email
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { name, role: 'employee' },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://bba-management-dashboard.vercel.app'}/hub`,
  })

  if (inviteError) {
    const alreadyExists = inviteError.message.toLowerCase().includes('already registered')
      || inviteError.message.toLowerCase().includes('already been invited')
    if (!alreadyExists) {
      console.error('[Invite] Auth error:', inviteError.message)
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }
    // User already exists — just grant access without re-sending
  }

  // Update employee record — try camelCase first (matches our DB naming)
  const { error: updateError } = await supabase
    .from('employees')
    .update({
      hubAccess:  true,
      invitedAt:  new Date().toISOString(),
      authUserId: inviteData?.user?.id ?? null,
    })
    .eq('id', employeeId)

  if (updateError) {
    console.error('[Invite] Update error:', updateError.message)
    return NextResponse.json({ error: `DB update failed: ${updateError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { employeeId } = body
  if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

  const { data: emp } = await supabase
    .from('employees')
    .select('authUserId')
    .eq('id', employeeId)
    .single()

  if (emp?.authUserId) {
    await supabaseAdmin.auth.admin.deleteUser(emp.authUserId)
  }

  const { error } = await supabase
    .from('employees')
    .update({ hubAccess: false, invitedAt: null, authUserId: null })
    .eq('id', employeeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
