import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .limit(1)

  return NextResponse.json({
    error: error?.message ?? null,
    columnNames: data && data[0] ? Object.keys(data[0]) : [],
    sampleRow: data?.[0] ?? null,
  })
}
