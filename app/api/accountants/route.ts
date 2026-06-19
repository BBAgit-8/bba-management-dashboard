import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { ACCOUNTANTS } from '@/lib/mock-data'
import type { Accountant } from '@/lib/mock-data'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('accountants')
    .select('*')
    .order('name')

  if (error || !data || data.length === 0) {
    // Fall back to mock data if table is empty or missing
    return NextResponse.json({ accountants: ACCOUNTANTS })
  }
  return NextResponse.json({ accountants: data })
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
      name:         name.trim(),
      business_name: typeof businessName === 'string' ? businessName.trim() || null : null,
      email:        typeof email        === 'string' ? email.trim()        || null : null,
      phone_number: typeof phoneNumber  === 'string' ? phoneNumber.trim()  || null : null,
      status:       'ACTIVE',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accountant: data }, { status: 201 })
}
