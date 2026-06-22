import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value, label')
    .order('key')

  if (error) {
    console.error('[GET /api/settings]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return as both array and key→value map for convenience
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return NextResponse.json({ settings: data ?? [], map })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates = body as { key: string; value: string }[]
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Expected array of {key, value}' }, { status: 422 })
  }

  const errors: string[] = []
  for (const { key, value } of updates) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updatedAt: new Date().toISOString() })
      .eq('key', key)
    if (error) errors.push(`${key}: ${error.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
