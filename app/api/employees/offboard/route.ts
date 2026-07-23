import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// POST /api/employees/offboard
// Marks employee inactive and unassigns all their clients
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const body = await req.json().catch(() => null)
  if (!body?.employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

  const { employeeId } = body

  // 1. Get employee name (clients are matched by Bookkeeper name, not ID)
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id, name')
    .eq('id', employeeId)
    .single()

  if (empErr || !emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // 2. Mark employee inactive
  const { error: updateErr } = await supabase
    .from('employees')
    .update({ isActive: false, updatedAt: new Date().toISOString() })
    .eq('id', employeeId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 3. Unassign all clients where Bookkeeper = employee name
  const { data: updatedClients, error: clientErr } = await supabase
    .from('clients')
    .update({ Bookkeeper: null, updatedAt: new Date().toISOString() })
    .eq('Bookkeeper', emp.name)
    .select('id, name, harvestProjectCode')

  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    employeeName:    emp.name,
    clientsUnassigned: updatedClients?.length ?? 0,
    clients:         updatedClients ?? [],
  })
}

// POST /api/employees/offboard (reinstate)
// Also handles reactivation
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
