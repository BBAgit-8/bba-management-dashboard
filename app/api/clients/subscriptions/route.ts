import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// GET /api/clients/subscriptions?clientId=xxx
export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  // Try both camelCase and snake_case column names
  const { data, error } = await supabase
    .from('client_subscriptions')
    .select('*')
    .eq('clientId', clientId)
    .order('createdAt')

  if (error) {
    // Try snake_case
    const { data: data2, error: error2 } = await supabase
      .from('client_subscriptions')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at')
    if (error2) return NextResponse.json({ error: error2.message, originalError: error.message }, { status: 500 })
    return NextResponse.json({ subscriptions: data2 ?? [] })
  }

  return NextResponse.json({ subscriptions: data ?? [] })
}

// POST — upsert all subs for a client
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { clientId, subscriptions } = body as { clientId: string; subscriptions: any[] }
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  // Delete existing
  await supabase.from('client_subscriptions').delete().eq('clientId', clientId)
  // Also try snake_case
  await supabase.from('client_subscriptions').delete().eq('client_id', clientId)

  if (subscriptions && subscriptions.length > 0) {
    const rows = subscriptions
      .filter(s => s.softwareName?.trim())
      .map(s => ({
        id:             crypto.randomUUID(),
        clientId,
        softwareName:   s.softwareName,
        tier:           s.tier || null,
        ourCost:        parseFloat(s.ourCost) || 0,
        clientPrice:    parseFloat(s.clientPrice) || 0,
        billingCadence: s.billingCadence || 'MONTHLY',
        createdAt:      new Date().toISOString(),
        updatedAt:      new Date().toISOString(),
      }))

    if (rows.length > 0) {
      const { error } = await supabase.from('client_subscriptions').insert(rows)
      if (error) return NextResponse.json({ error: error.message, detail: JSON.stringify(rows[0]) }, { status: 500 })
    }
  }

  const { data } = await supabase
    .from('client_subscriptions')
    .select('*')
    .eq('clientId', clientId)
    .order('createdAt')

  return NextResponse.json({ subscriptions: data ?? [] })
}
