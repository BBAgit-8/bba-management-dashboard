import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

const ALLOWED_STATUSES = new Set(['open', 'in-progress', 'done'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  try {
    const { id } = await params
    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const raw = (body ?? {}) as Record<string, unknown>
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }

    if (typeof raw.status === 'string') {
      if (!ALLOWED_STATUSES.has(raw.status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 422 })
      }
      patch.status = raw.status
    }
    if (typeof raw.title === 'string')       patch.title       = raw.title.trim()
    if (typeof raw.description === 'string') patch.description = raw.description.trim()

    const { data, error } = await supabase
      .from('changeRequests')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH change-requests]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ request: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await requireAuth(_req); if (gate) return gate;

  try {
    const { id } = await params
    const { error } = await supabase
      .from('changeRequests')
      .delete()
      .eq('id', id)
    if (error) {
      console.error('[DELETE change-requests]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}
