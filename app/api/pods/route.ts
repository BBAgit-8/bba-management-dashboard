import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('pods')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('GET /api/pods error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ pods: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { name?: string } | null
  const name = body?.name?.trim()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('pods')
    .insert({ id: crypto.randomUUID(), name, createdAt: now, updatedAt: now })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pod: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as { id?: string; name?: string } | null
  if (!body?.id || !body?.name?.trim())
    return NextResponse.json({ error: 'id and name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('pods')
    .update({ name: body.name.trim(), updatedAt: new Date().toISOString() })
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pod: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Null out FKs before deleting the pod
  await supabase.from('employees').update({ podId: null }).eq('podId', id)
  await supabase.from('clients').update({ assignedPodId: null }).eq('assignedPodId', id)
  await supabase.from('podTaskDefaults').delete().eq('podId', id)

  const { error } = await supabase.from('pods').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
