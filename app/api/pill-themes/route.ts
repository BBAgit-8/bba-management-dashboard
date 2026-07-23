import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const { data, error } = await supabase.from('pill_themes').select('*').order('category').order('key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pillThemes: data ?? [] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { data, error } = await supabase.from('pill_themes').upsert(body as Record<string, unknown>).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pillTheme: data }, { status: 201 })
}
