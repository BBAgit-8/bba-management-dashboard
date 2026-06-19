import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { clientId, confirmation } = (body ?? {}) as Record<string, unknown>
  if (confirmation !== 'CONFIRM') {
    return NextResponse.json({ error: 'Must pass confirmation: "CONFIRM"' }, { status: 400 })
  }
  const { error } = await supabase
    .from('clients')
    .update({ archive_status: 'ARCHIVED' })
    .eq('id', clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
