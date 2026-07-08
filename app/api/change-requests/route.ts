import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET  /api/change-requests?status=open   — list (optional status filter)
// POST /api/change-requests               — create new request

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const status = req.nextUrl.searchParams.get('status')
    let q = supabase
      .from('changeRequests')
      .select('*')
      .order('createdAt', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) {
      console.error('[GET change-requests]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // Include an open-count for the bubble badge (avoid a second round-trip)
    const openCount = (data ?? []).filter((r: any) => r.status === 'open').length
    return NextResponse.json({ requests: data ?? [], openCount })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const raw = (body ?? {}) as Record<string, unknown>
    const title       = typeof raw.title       === 'string' ? raw.title.trim()       : ''
    const description = typeof raw.description === 'string' ? raw.description.trim() : ''
    const pageContext = typeof raw.pageContext === 'string' ? raw.pageContext.trim() || null : null

    if (!title)       return NextResponse.json({ error: 'title is required' },       { status: 422 })
    if (!description) return NextResponse.json({ error: 'description is required' }, { status: 422 })

    const { data, error } = await supabase
      .from('changeRequests')
      .insert({ title, description, pageContext, status: 'open' })
      .select()
      .single()

    if (error) {
      console.error('[POST change-requests]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ request: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'server error' }, { status: 500 })
  }
}
