import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('clients')
    .update(body as Record<string, unknown>)
    .eq('harvestProjectCode', code)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
