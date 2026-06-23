import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('GET /api/employees error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Support both { employees: [] } and raw array for backwards compatibility
  return NextResponse.json({ employees: data ?? [], data })
}
