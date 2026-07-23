import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// POST — update softwareRate on clients whose current rate matches an old price
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const body = await req.json().catch(() => null)
  if (!body?.priceChanges || !Array.isArray(body.priceChanges)) {
    return NextResponse.json({ error: 'Missing priceChanges' }, { status: 400 })
  }

  const priceChanges = body.priceChanges as { oldPrice: number; newPrice: number }[]
  let updated = 0

  for (const { oldPrice, newPrice } of priceChanges) {
    if (oldPrice === newPrice) continue
    const { data, error } = await supabase
      .from('clients')
      .update({ softwareRate: newPrice, updatedAt: new Date().toISOString() })
      .eq('softwareRate', oldPrice)
      .select('id')
    if (!error && data) updated += data.length
  }

  return NextResponse.json({ updated })
}
