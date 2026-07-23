import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// assignments: { [clientId]: employeeId }
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { assignments, employees } = (body ?? {}) as Record<string, unknown>
  if (!assignments || typeof assignments !== 'object') {
    return NextResponse.json({ error: 'assignments required' }, { status: 400 })
  }
  // Build a map of employeeId → employee name
  const empMap: Record<string, string> = {}
  if (Array.isArray(employees)) {
    for (const e of employees) { if (e.id && e.name) empMap[e.id] = e.name }
  }

  const entries = Object.entries(assignments as Record<string, string>)
  const errors: string[] = []

  await Promise.all(entries.map(async ([clientId, empId]) => {
    const bookkeeper = empMap[empId] ?? null
    const { error } = await supabase
      .from('clients')
      .update({ Bookkeeper: bookkeeper })
      .eq('id', clientId)
    if (error) errors.push(`${clientId}: ${error.message}`)
  }))

  if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 207 })
  return NextResponse.json({ ok: true, updated: entries.length })
}
