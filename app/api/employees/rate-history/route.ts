import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const employeeId = req.nextUrl.searchParams.get('employeeId')
  if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

  const { data, error } = await supabase
    .from('employee_rate_history')
    .select('*')
    .eq('employeeId', employeeId)
    .order('effectiveDate', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ history: data ?? [] })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const d = body as Record<string, unknown>
  if (!d.employeeId || !d.rate || !d.effectiveDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('employee_rate_history')
    .insert({
      id:            crypto.randomUUID(),
      employeeId:    d.employeeId,
      rateType:      d.rateType ?? 'hourly',
      rate:          Number(d.rate),
      effectiveDate: d.effectiveDate,
      notes:         d.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data }, { status: 201 })
}
