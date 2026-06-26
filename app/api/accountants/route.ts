import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  // Get all accountants (not filtered by status)
  const { data, error } = await supabase
    .from('accountants')
    .select('*')
    .order('name')

  if (error) {
    console.error('[GET /api/accountants]', error)
    return NextResponse.json({ accountants: [] })
  }

  // Get active client counts per accountant
  const { data: clients } = await supabase
    .from('clients')
    .select('accountantName, archiveStatus')
    .not('accountantName', 'is', null)

  const activeCounts: Record<string, number> = {}
  for (const c of (clients ?? [])) {
    if (c.archiveStatus === 'ACTIVE' && c.accountantName) {
      activeCounts[c.accountantName] = (activeCounts[c.accountantName] ?? 0) + 1
    }
  }

  // Derive status: active only if they have active clients
  const shaped = (data ?? []).map(a => ({
    ...a,
    activeClientCount: activeCounts[a.name] ?? 0,
    derivedStatus: (activeCounts[a.name] ?? 0) > 0 ? 'ACTIVE' : 'INACTIVE',
  }))

  return NextResponse.json({ accountants: shaped })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, businessName, email, phoneNumber } = (body ?? {}) as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim())
    return NextResponse.json({ error: '"name" is required' }, { status: 422 })

  const { data, error } = await supabase
    .from('accountants')
    .insert({
      id:           crypto.randomUUID(),
      name:         name.trim(),
      businessName: typeof businessName === 'string' ? businessName.trim() || null : null,
      email:        typeof email        === 'string' ? email.trim()        || null : null,
      phoneNumber:  typeof phoneNumber  === 'string' ? phoneNumber.trim()  || null : null,
      status:       'ACTIVE',
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accountant: data }, { status: 201 })
}
