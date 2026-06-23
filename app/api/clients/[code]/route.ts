import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Map incoming field names (from the frontend) to actual DB column names
const FIELD_MAP: Record<string, string> = {
  bookkeeper:    'Bookkeeper',   // capital-B column
  // all others are already camelCase matching the DB
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Remap any field names that differ between frontend and DB
  const raw = body as Record<string, unknown>
  const mapped: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(raw)) {
    mapped[FIELD_MAP[key] ?? key] = val
  }

  const { data, error } = await supabase
    .from('clients')
    .update(mapped)
    .eq('harvestProjectCode', code)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
