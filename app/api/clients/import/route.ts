import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60 // Vercel max for hobby plan

const FIELD_MAP: Record<string, string> = {
  'client name':             'name',
  'project code':            'harvestProjectCode',
  'bookkeeper':              'bookkeeper',
  'entity type':             'entityType',
  'project type':            'projectType',
  'rev type':                'revType',
  'processing cadence':      'processingCadence',
  'bookkeeping rate':        'bookkeepingRate',
  'software rate':           'softwareRate',
  'total hrs/mo':            'totalHrsPerMonth',
  'bkpr hours':              'bkprHours',
  'qa hours':                'qaHours',
  'cust success/mgmt hrs':   'custSuccessMgmtHrs',
  'ye/tax hours':            'yeOrTaxHours',
  'audit hours':             'auditHours',
  'ap/ar hours':             'apArHrs',
  'bank feed time':          'bankFeedTime',
  '# transactions/mo':       'transactionsPerMonth',
  '# banks & ccs':           'numBanksAndCCs',
  '# loans':                 'numLoans',
  '# payment portals':       'numPmtPortals',
  'contract start date':     'contractStartDate',
  'contract end date':       'contractEndDate',
  'state':                   'state',
  'client contact name':     'clientContactName',
  'referred by':             'referredBy',
  'accountant name':         'accountantName',
  'ok to contact acct':      'okToContactAccountant',
  'has payroll':             'hasPayroll',
  'payroll provider':        'payrollProvider',
  'petty cash':              'pettyCash',
  'has contracted loom':     'hasContractedLoom',
  'has scheduled meetings':  'hasScheduledMeetings',
  'qbo id':                  'qboId',
  'double id':               'doubleId',
  'clickup id':              'clickUpId',
  'client group name':       'clientGroupName',
  'auto price increase %':   'autoPriceIncreasePercent',
  'price adjustment date':   'priceAdjustmentDate',
  'guaranteed deadline day': 'guaranteedDeadlineDay',
}

const BOOLEAN_FIELDS = new Set(['okToContactAccountant','hasPayroll','pettyCash','hasContractedLoom','hasScheduledMeetings'])
const NUMERIC_FIELDS = new Set(['bookkeepingRate','softwareRate','totalHrsPerMonth','bkprHours','qaHours','custSuccessMgmtHrs','yeOrTaxHours','auditHours','apArHrs','bankFeedTime','transactionsPerMonth','numBanksAndCCs','numLoans','numPmtPortals','autoPriceIncreasePercent','guaranteedDeadlineDay'])
const DATE_FIELDS    = new Set(['contractStartDate','contractEndDate','priceAdjustmentDate'])

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null)
    if (!body?.rows || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'Missing rows array' }, { status: 400 })
    }

    const results: { name: string; code: string; status: 'created' | 'skipped'; error?: string }[] = []

    for (const raw of body.rows as Record<string, string>[]) {
      const mapped: Record<string, unknown> = {}
      for (const [rawKey, rawVal] of Object.entries(raw)) {
        const field = FIELD_MAP[rawKey.toLowerCase().trim()]
        if (!field || rawVal === '' || rawVal == null) continue
        const val = String(rawVal).trim()
        if (BOOLEAN_FIELDS.has(field)) {
          mapped[field] = val.toLowerCase() === 'true'
        } else if (NUMERIC_FIELDS.has(field)) {
          const n = parseFloat(val)
          if (!isNaN(n)) mapped[field] = n
        } else if (DATE_FIELDS.has(field)) {
          mapped[field] = new Date(val + 'T12:00:00Z').toISOString()
        } else {
          mapped[field] = val
        }
      }

      const name = mapped.name as string
      const code = mapped.harvestProjectCode as string
      if (!name || !code) {
        results.push({ name: name ?? '(no name)', code: code ?? '(no code)', status: 'skipped', error: 'Missing name or project code' })
        continue
      }

      const row: Record<string, unknown> = {
        id:                crypto.randomUUID(),
        createdAt:         new Date().toISOString(),
        updatedAt:         new Date().toISOString(),
        archiveStatus:     'ACTIVE',
        processingCadence: mapped.processingCadence ?? 'MONTHLY',
        projectType:       mapped.projectType ?? 'RECURRING',
        entityType:        mapped.entityType ?? 'LLC',
        ...mapped,
        Bookkeeper:        mapped.bookkeeper ?? null,
      }
      delete row.bookkeeper

      const { error } = await supabase.from('clients').insert(row)
      if (error) {
        results.push({ name, code, status: 'skipped', error: error.code === '23505' ? 'Duplicate project code' : error.message })
      } else {
        results.push({ name, code, status: 'created' })
      }
    }

    return NextResponse.json({
      total:   results.length,
      created: results.filter(r => r.status === 'created').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results,
    })
  } catch (err: any) {
    console.error('[POST /api/clients/import] unhandled error:', err)
    return NextResponse.json({ error: `Server error: ${err?.message ?? String(err)}` }, { status: 500 })
  }
}
