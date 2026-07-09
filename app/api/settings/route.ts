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
  const labels: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.key] = row.value
    if (row.label) labels[row.key] = row.label
  }

  return NextResponse.json({ settings: data ?? [], map, labels })
}

// Bulk update values. Body: [{ key, value, label? }]
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates = body as { key: string; value: string; label?: string }[]
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Expected array of {key, value}' }, { status: 422 })
  }

  const errors: string[] = []
  for (const { key, value, label } of updates) {
    const row: Record<string, string> = { key, value, updatedAt: new Date().toISOString() }
    if (label !== undefined) row.label = label
    const { error } = await supabase
      .from('settings')
      .upsert(row, { onConflict: 'key' })
    if (error) errors.push(`${key}: ${error.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Create a new setting row. Body: { key, value, label? }
// Slug/key must be unique — returns 409 if the key already exists.
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { key, value, label } = (body ?? {}) as { key?: string; value?: string; label?: string }
  if (!key || typeof key !== 'string') return NextResponse.json({ error: 'key required' }, { status: 422 })
  if (value === undefined) return NextResponse.json({ error: 'value required' }, { status: 422 })

  // Check for existing key
  const { data: existing } = await supabase
    .from('settings')
    .select('key')
    .eq('key', key)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: `Setting "${key}" already exists` }, { status: 409 })

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('settings')
    .insert({ key, value, label: label ?? null, createdAt: now, updatedAt: now })

  if (error) {
    console.error('[POST /api/settings]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// Delete a setting by key (?key=software.gusto).
// This is destructive — the caller is expected to confirm with the user.
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key query param required' }, { status: 422 })

  const { error } = await supabase.from('settings').delete().eq('key', key)
  if (error) {
    console.error('[DELETE /api/settings]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
