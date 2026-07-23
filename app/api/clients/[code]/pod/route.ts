import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

// Assign or unassign a client's pod by client id.
// The URL slot is [code] to satisfy Next's "single slug per position" rule
// (see app/api/clients/[code]/route.ts), but this handler is still called
// with a UUID client id — see callers in employees/planning/page.tsx.
// Body: { assignedPodId: string | null }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const { code: id } = await params
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
    console.error('[PATCH /api/clients/[code]/pod] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ client: data })
}
