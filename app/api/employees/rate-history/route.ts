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
