import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// POST /api/employees/offboard
// Full off-boarding: archive employee, unassign everywhere, revoke hub access.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const body = await req.json().catch(() => null)
  if (!body?.employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

  const { employeeId } = body

  // 1. Look up the employee — need name (clients match by name) and authUserId (hub access)
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id, name, authUserId')
    .eq('id', employeeId)
    .single()

  if (empErr || !emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // 2. Revoke hub access — delete the Supabase auth user if one exists.
  //    Wrapped in try/catch: if the auth user was already deleted or the admin
  //    call fails, we still want the rest of the offboarding to proceed.
  if (emp.authUserId) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      await admin.auth.admin.deleteUser(emp.authUserId)
    } catch (err) {
      console.error('Auth user deletion failed (continuing):', err)
    }
  }

  // 3. Archive the employee record + clear hub fields + drop pod membership.
  //    We keep the row (not deleted) so historical time logs / rate history
  //    still resolve; isActive=false hides them from the active roster.
  const { error: updateErr } = await supabase
    .from('employees')
    .update({
      isActive:   false,
      hubAccess:  false,
      invitedAt:  null,
      authUserId: null,
      podId:      null,
      updatedAt:  new Date().toISOString(),
    })
    .eq('id', employeeId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 4. Unassign all clients where Bookkeeper matches this employee's name.
  const { data: updatedClients, error: clientErr } = await supabase
    .from('clients')
    .update({ Bookkeeper: null, updatedAt: new Date().toISOString() })
    .eq('Bookkeeper', emp.name)
    .select('id, name, harvestProjectCode')

  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })

  // 5. Remove capacity-planning task assignments (pod defaults + per-client overrides).
  const [{ count: podDefaultsRemoved }, { count: clientOverridesRemoved }] = await Promise.all([
    supabase.from('podTaskDefaults').delete({ count: 'exact' }).eq('employeeId', employeeId),
    supabase.from('clientTaskOverrides').delete({ count: 'exact' }).eq('employeeId', employeeId),
  ])

  return NextResponse.json({
    ok: true,
    employeeName:            emp.name,
    clientsUnassigned:       updatedClients?.length ?? 0,
    clients:                 updatedClients ?? [],
    podDefaultsRemoved:      podDefaultsRemoved ?? 0,
    clientOverridesRemoved:  clientOverridesRemoved ?? 0,
    hubAccessRevoked:        !!emp.authUserId,
  })
}

// PATCH — reinstate a previously off-boarded employee.
// Only restores isActive; hub access and prior client assignments do NOT
// come back automatically (they'd need to be re-invited / reassigned).
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const body = await req.json().catch(() => null)
  if (!body?.employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

  const { error } = await supabase
    .from('employees')
    .update({ isActive: true, updatedAt: new Date().toISOString() })
    .eq('id', body.employeeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
