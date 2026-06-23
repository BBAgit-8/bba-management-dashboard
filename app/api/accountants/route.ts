import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('accountants')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('name')

  if (error) {
    console.error('[GET /api/accountants]', error)
    return NextResponse.json({ accountants: [] })
  }
  return NextResponse.json({ accountants: data ?? [] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { name, businessName, email, phoneNumber } = (body ?? {}) as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim())
    return NextResponse.json({ error: '"name" is required' }, { status: 422 })

  const { data, error } = await supabase
    .from('accountants')
    .insert({
      id:           crypto.randomUUID(),
      name:         name.trim(),
      businessName: typeof businessName === 'string' ? businessName.trim() || null : null,
      email:        typeof email        === 'string' ? email.trim()        || null : null,
      phoneNumber:  typeof phoneNumber  === 'string' ? phoneNumber.trim()  || null : null,
      status:       'ACTIVE',
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accountant: data }, { status: 201 })
}
