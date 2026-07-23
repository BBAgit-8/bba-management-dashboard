import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

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
  const gate = await requireAuth(req); if (gate) return gate;

  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { employeeId, email, name } = body as Record<string, string>
    if (!employeeId || !email) {
      return NextResponse.json({ error: 'Missing employeeId or email' }, { status: 400 })
    }

    // Step 1: Send invite via Supabase Admin API
    let authUserId: string | null = null
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name, role: 'employee' },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/hub/confirm`,
      })
      if (error) {
        const already = /already (registered|invited|been invited)/i.test(error.message)
        if (!already) {
          const isRateLimit = (error as any).code === 'over_email_send_rate_limit' || (error as any).status === 429
          const msg = isRateLimit
            ? 'Email rate limit reached — wait an hour and try again.'
            : `${error.message || '(no message)'} | status=${(error as any).status ?? '?'} code=${(error as any).code ?? '?'}`
          return NextResponse.json({ error: msg }, { status: 500 })
        }
      } else {
        authUserId = data?.user?.id ?? null
      }
    } catch (authErr: any) {
      return NextResponse.json({ error: `Auth exception: ${String(authErr?.message ?? authErr)}` }, { status: 500 })
    }

    // Step 2: Mark employee as invited in DB
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        hubAccess:  true,
        invitedAt:  new Date().toISOString(),
        authUserId: authUserId,
      })
      .eq('id', employeeId)

    if (updateError) {
      return NextResponse.json({ error: `DB: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: `Unexpected: ${String(err?.message ?? err)}` }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

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
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        await admin.auth.admin.deleteUser(emp.authUserId)
      } catch {}
    }

    const { error } = await supabase
      .from('employees')
      .update({ hubAccess: false, invitedAt: null, authUserId: null })
      .eq('id', employeeId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
