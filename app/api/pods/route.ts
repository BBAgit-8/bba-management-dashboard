import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabase
    .from('pods')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('GET /api/pods error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pods: data ?? [] })
}
