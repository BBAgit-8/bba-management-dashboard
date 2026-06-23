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

  const employees = data ?? []
  // Return both shapes for compatibility
  return NextResponse.json(employees)
}
