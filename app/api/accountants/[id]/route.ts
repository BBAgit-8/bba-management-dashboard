import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Allowlist of fields the client can update on an accountant.
// New columns get added here and to the accountants table via migration.
const STRING_FIELDS = new Set(['name', 'businessName', 'email', 'phoneNumber'])
const BOOLEAN_FIELDS = new Set(['okToContactAccountant'])
const STATUS_FIELDS = new Set(['status']) // 'ACTIVE' | 'ARCHIVED'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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
  const { id } = await params
  const { error } = await supabase.from('accountants').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
