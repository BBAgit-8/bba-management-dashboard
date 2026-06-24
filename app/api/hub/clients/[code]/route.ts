import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const { data, error } = await supabase
    .from('clients')
    .select(`
      id, name, harvestProjectCode, entityType, processingCadence,
      projectType, archiveStatus, contractStartDate, contractEndDate,
      clientContactName, accountantName, referredBy,
      totalHrsPerMonth, apArHrs, qaHours, bankFeedTime,
      transactionsPerMonth, numBanksAndCCs, numLoans, numPmtPortals,
      pettyCash, hasContractedLoom, hasScheduledMeetings,
      hasPayroll, payrollProvider, qboOnly,
      bookkeepingRate, softwareRate, totalMonthlyAmount,
      guaranteedDeadlineDay
    `)
    .eq('harvestProjectCode', code)
    .single()

  if (error || !data) {
    console.error('[hub/clients/code]', error?.message)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    client: { ...data, tags: [], notes: [] }
  })
}
