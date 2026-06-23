import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Fields that must be remapped to their actual DB column name
const FIELD_MAP: Record<string, string> = {
  bookkeeper: 'Bookkeeper',
}

// Fields that must be coerced to numbers (strings from input elements)
const NUMERIC_FIELDS = new Set([
  'bookkeepingRate', 'softwareRate', 'totalMonthlyAmount', 'bookingRate',
  'totalHrsPerMonth', 'apArHrs', 'qaHours', 'custSuccessMgmtHrs',
  'yeOrTaxHours', 'auditHours', 'bkprHours', 'bankFeedTime',
  'transactionsPerMonth', 'recTime', 'numBanksAndCCs', 'numLoans',
  'numPmtPortals', 'guaranteedDeadlineDay', 'autoPriceIncreasePercent',
])

// Fields that must be coerced to booleans
const BOOLEAN_FIELDS = new Set([
  'hasContractedLoom', 'hasScheduledMeetings', 'hasSignedAutoIncrease', 'pettyCash', 'qboOnly',
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
    if (val === null || val === '' || val === undefined) {
      mapped[dbKey] = null
    } else if (NUMERIC_FIELDS.has(key)) {
      const n = typeof val === 'string' ? parseFloat(val) : Number(val)
      mapped[dbKey] = isNaN(n) ? null : n
    } else if (BOOLEAN_FIELDS.has(key)) {
      mapped[dbKey] = val === true || val === 'true'
    } else {
      mapped[dbKey] = val
    }
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
