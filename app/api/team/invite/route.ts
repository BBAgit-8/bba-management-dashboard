import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const employees = (data ?? []).map((e: any) => ({
    id:         e.id,
    name:       e.name,
    email:      e.email ?? null,
    hubAccess:  e.hubAccess ?? false,
    invitedAt:  e.invitedAt ?? null,
    authUserId: e.authUserId ?? null,
  }))

  return NextResponse.json({ employees })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { employeeId, email, name } = body as Record<string, string>
    if (!employeeId || !email) {
      return NextResponse.json({ error: 'Missing employeeId or email' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: `Missing env: url=${!!url} key=${!!key}` }, { status: 500 })
    }

    // Dynamically import to avoid module-level issues
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role: 'employee' },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://bba-management-dashboard.vercel.app'}/hub`,
    })

    if (inviteError) {
      const already = /already (registered|invited|been invited)/i.test(inviteError.message)
      if (!already) return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from('employees')
      .update({
        hubAccess:  true,
        invitedAt:  new Date().toISOString(),
        authUserId: inviteData?.user?.id ?? null,
      })
      .eq('id', employeeId)

    if (updateError) {
      return NextResponse.json({ error: `DB: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err ?? 'unknown') }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { employeeId } = body as Record<string, string>
    if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

    const { data: emp } = await supabase
      .from('employees')
      .select('authUserId')
      .eq('id', employeeId)
      .single()

    if (emp?.authUserId) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
      await admin.auth.admin.deleteUser(emp.authUserId)
    }

    const { error } = await supabase
      .from('employees')
      .update({ hubAccess: false, invitedAt: null, authUserId: null })
      .eq('id', employeeId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err ?? 'unknown') }, { status: 500 })
  }
}
