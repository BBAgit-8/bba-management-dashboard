import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const FIELD_MAP: Record<string, string> = {
  bookkeeper: 'Bookkeeper',
}

const NUMERIC_FIELDS = new Set([
  'bookkeepingRate', 'softwareRate', 'totalMonthlyAmount',
  'totalHrsPerMonth', 'apArHrs', 'qaHours', 'custSuccessMgmtHrs',
  'yeOrTaxHours', 'auditHours', 'bkprHours', 'bankFeedTime',
  'transactionsPerMonth', 'recTime', 'numBanksAndCCs', 'numLoans',
  'numPmtPortals', 'guaranteedDeadlineDay', 'autoPriceIncreasePercent',
])

const BOOLEAN_FIELDS = new Set([
  'hasContractedLoom', 'hasScheduledMeetings', 'hasSignedAutoIncrease',
  'pettyCash', 'qboOnly', 'okToContactAccountant', 'hasPayroll',
])

// Date fields — sent as ISO date strings, stored as timestamptz
const DATE_FIELDS = new Set([
  'priceAdjustmentDate', 'contractStartDate', 'contractEndDate', 'contractedCloseDate',
])

// Enum columns — empty string means "leave as-is", skip the update
const ENUM_FIELDS = new Set([
  'entityType', 'projectType', 'processingCadence', 'archiveStatus',
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const mapped: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(raw)) {
    const dbKey = FIELD_MAP[key] ?? key
    // Skip enum fields with empty value — don't null them out
    if (ENUM_FIELDS.has(key) && (val === '' || val === null || val === undefined)) continue
    if (val === null || val === '' || val === undefined) {
      mapped[dbKey] = null
    } else if (NUMERIC_FIELDS.has(key)) {
      const n = typeof val === 'string' ? parseFloat(val) : Number(val)
      mapped[dbKey] = isNaN(n) ? null : n
    } else if (BOOLEAN_FIELDS.has(key)) {
      mapped[dbKey] = val === true || val === 'true'
    } else if (DATE_FIELDS.has(key)) {
      // Store as date-only string to avoid UTC timezone shift (e.g. "2025-06-23" not "2025-06-22T00:00:00Z")
      if (typeof val === 'string' && val) {
        // Keep just the date portion, append noon UTC to avoid timezone shifting
        mapped[dbKey] = new Date(val + 'T12:00:00Z').toISOString()
      } else {
        mapped[dbKey] = null
      }
    } else {
      mapped[dbKey] = val
    }
  }

  if (Object.keys(mapped).length === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { data, error } = await supabase
    .from('clients')
    .update(mapped)
    .eq('harvestProjectCode', code)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
