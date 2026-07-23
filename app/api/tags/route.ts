import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const { data, error } = await supabase.from('tags').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tags: data ?? [] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, color } = (body ?? {}) as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim())
    return NextResponse.json({ error: '"name" is required' }, { status: 422 })
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))
    return NextResponse.json({ error: '"color" must be a valid hex color' }, { status: 422 })

  const { data, error } = await supabase.from('tags').insert({
    id:        crypto.randomUUID(),
    name:      name.trim(),
    color,
    createdAt: new Date().toISOString(),
  }).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Tag "${name}" already exists` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ tag: data }, { status: 201 })
}
