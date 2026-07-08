import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Assign or unassign a client's pod by client id.
// Body: { assignedPodId: string | null }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  let body: { assignedPodId?: string | null }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const assignedPodId = body?.assignedPodId ?? null
  const { data, error } = await supabase
    .from('clients')
    .update({ assignedPodId, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, assignedPodId')
    .single()

  if (error) {
    console.error('[PATCH /api/clients/[id]/pod] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ client: data })
}
