import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  // Test each column individually to find exact names
  const tests: Record<string, string> = {}

  const cols = [
    { key: 'qboOnly',                 val: true },
    { key: 'qbo_only',                val: true },
    { key: 'okToContactAccountant',   val: true },
    { key: 'ok_to_contact_accountant',val: true },
    { key: 'hasPayroll',              val: true },
    { key: 'has_payroll',             val: true },
    { key: 'accountantName',          val: 'test' },
    { key: 'accountant_name',         val: 'test' },
    { key: 'archiveStatus',           val: 'ACTIVE' },
    { key: 'archive_status',          val: 'ACTIVE' },
    { key: 'processingCadence',       val: 'MONTHLY' },
    { key: 'processing_cadence',      val: 'MONTHLY' },
    { key: 'harvestProjectCode',      val: '_T1_' },
    { key: 'harvest_project_code',    val: '_T2_' },
    { key: 'guaranteedDeadlineDay',   val: 15 },
    { key: 'guaranteed_deadline_day', val: 15 },
    { key: 'projectType',             val: 'MONTHLY_MAINTENANCE' },
    { key: 'project_type',            val: 'MONTHLY_MAINTENANCE' },
  ]

  for (const { key, val } of cols) {
    const { error } = await supabase
      .from('clients')
      .insert({ name: '_t_', harvestProjectCode: `_${key}_`, processingCadence: 'MONTHLY', archiveStatus: 'ACTIVE', [key]: val })
      .select()
    tests[key] = error?.message?.includes('Could not find') ? '❌ NOT FOUND' : error?.message ?? '✅ FOUND'
  }

  // Clean up any test rows inserted
  await supabase.from('clients').delete().like('name', '_t_')

  return NextResponse.json(tests)
}
