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
      projectType, archiveStatus, contractStartDate, clientContactName,
      referredBy, totalHrsPerMonth, apArHrs, qaHours, bankFeedTime,
      transactionsPerMonth, numBanksAndCCs, numLoans, numPmtPortals,
      pettyCash, hasPayroll, payrollProvider, hasContractedLoom,
      hasScheduledMeetings, meetingDuration,
      tags:client_tags(tag:tags(name, color)),
      notes(id, content, "createdAt", "visibleToTeam")
    `)
    .eq('harvestProjectCode', code)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const client = {
    ...data,
    tags:  (data.tags  ?? []).map((ct: any) => ct.tag).filter(Boolean),
    notes: ((data as any).notes ?? [])
      .filter((n: any) => n.visibleToTeam !== false)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  }

  return NextResponse.json({ client })
}
