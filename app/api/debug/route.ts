import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  // Query information_schema to get actual column names
  const { data, error } = await supabase
    .rpc('get_column_names')
    .select('*')

  // Fallback: try a raw insert with a known bad column to trigger the error message
  const { error: insertError } = await supabase
    .from('clients')
    .insert({ name: '_debug_test_', harvest_project_code: '_DBG_', processing_cadence: 'MONTHLY', archive_status: 'ACTIVE' })
    .select()

  const { error: insertError2 } = await supabase
    .from('clients')
    .insert({ name: '_debug_test_', harvestProjectCode: '_DBG2_', processingCadence: 'MONTHLY', archiveStatus: 'ACTIVE' })
    .select()

  return NextResponse.json({
    snake_case_insert_error: insertError?.message ?? 'SUCCESS',
    camel_case_insert_error: insertError2?.message ?? 'SUCCESS',
  })
}
