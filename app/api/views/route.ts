import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

export type ClientView = {
  id:          string
  name:        string
  visibleCols: string[]
  colOrder:    string[]
  colWidths:   Record<string, number>
  filters:     Record<string, any>
  sortKey:     string
  sortDir:     string
  sharedWithTeam: boolean
  createdAt:   string
  updatedAt:   string
}

// GET — load all views from settings table
export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'client_views')
    .single()

  try {
    const views: ClientView[] = data?.value ? JSON.parse(data.value) : []
    return NextResponse.json({ views })
  } catch {
    return NextResponse.json({ views: [] })
  }
}

// POST — save all views
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const body = await req.json().catch(() => null)
  if (!body?.views) return NextResponse.json({ error: 'Missing views' }, { status: 400 })

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'client_views', value: JSON.stringify(body.views), updatedAt: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
