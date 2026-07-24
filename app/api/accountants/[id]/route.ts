import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// Allowlist of fields the client can update on an accountant.
// New columns get added here and to the accountants table via migration.
const STRING_FIELDS = new Set(['name', 'businessName', 'email', 'phoneNumber'])
const BOOLEAN_FIELDS = new Set(['okToContactAccountant', 'hasSecurePortal'])
const STATUS_FIELDS = new Set(['status']) // 'ACTIVE' | 'ARCHIVED'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const [k, v] of Object.entries(b)) {
    if (STRING_FIELDS.has(k)) {
      updates[k] = typeof v === 'string' ? (v.trim() || null) : null
    } else if (BOOLEAN_FIELDS.has(k)) {
      updates[k] = v === true
    } else if (STATUS_FIELDS.has(k)) {
      if (v === 'ACTIVE' || v === 'ARCHIVED') updates[k] = v
    }
  }

  const { data, error } = await supabase
    .from('accountants')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accountant: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await requireAuth(_req); if (gate) return gate;

  const { id } = await params

  // Null out any client references first so the delete never trips a FK.
  // Both accountantId (the real FK) and accountantName (legacy denorm text)
  // get cleared. Callers should have already warned the user if there were
  // active clients attached; this is the safety net.
  await supabase
    .from('clients')
    .update({ accountantId: null, accountantName: null, updatedAt: new Date().toISOString() })
    .eq('accountantId', id)

  const { error } = await supabase.from('accountants').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
