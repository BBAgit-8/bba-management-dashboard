import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/clients/subscriptions?clientId=xxx
export async function GET(req: NextRequest): Promise<NextResponse> {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  const { data, error } = await supabase
    .from('client_subscriptions')
    .select('*')
    .eq('clientId', clientId)
    .order('createdAt')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subscriptions: data ?? [] })
}

// POST /api/clients/subscriptions — create or replace all subs for a client
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { clientId, subscriptions } = body as { clientId: string; subscriptions: any[] }
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  // Delete existing subs and replace with new ones
  const { error: delError } = await supabase
    .from('client_subscriptions')
    .delete()
    .eq('clientId', clientId)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  if (subscriptions && subscriptions.length > 0) {
    const rows = subscriptions.map(s => ({
      id:            s.id?.startsWith('new-') ? undefined : s.id,
      clientId,
      softwareName:  s.softwareName,
      tier:          s.tier || null,
      ourCost:       parseFloat(s.ourCost) || 0,
      clientPrice:   parseFloat(s.clientPrice) || 0,
      billingCadence: s.billingCadence || 'MONTHLY',
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    })).filter(s => s.softwareName?.trim())

    if (rows.length > 0) {
      const { error: insError } = await supabase
        .from('client_subscriptions')
        .insert(rows)
      if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
    }
  }

  // Return updated subs
  const { data } = await supabase
    .from('client_subscriptions')
    .select('*')
    .eq('clientId', clientId)
    .order('createdAt')

  return NextResponse.json({ subscriptions: data ?? [] })
}
