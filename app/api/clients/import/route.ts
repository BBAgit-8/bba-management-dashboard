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

const ENTITY_TYPE_MAP: Record<string, string> = {
  'llc':              'LLC',
  's-corp':           'S_CORP',
  's corp':           'S_CORP',
  'scorp':            'S_CORP',
  's_corp':           'S_CORP',
  'c-corp':           'C_CORP',
  'c corp':           'C_CORP',
  'ccorp':            'C_CORP',
  'c_corp':           'C_CORP',
  'sole-prop':        'SOLE_PROPRIETOR',
  'sole prop':        'SOLE_PROPRIETOR',
  'sole proprietor':  'SOLE_PROPRIETOR',
  'sole_proprietor':  'SOLE_PROPRIETOR',
  'partnership':      'PARTNERSHIP',
  'non-profit':       'NON_PROFIT',
  'non profit':       'NON_PROFIT',
  'nonprofit':        'NON_PROFIT',
  'non_profit':       'NON_PROFIT',
  'other':            'OTHER',
}'okToContactAccountant','hasPayroll','pettyCash','hasContractedLoom','hasScheduledMeetings'])
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
          // Handle Excel serial numbers, YYYY-MM-DD, MM/DD/YYYY, and other formats
          let iso: string | null = null
          const num = Number(val)
          if (!isNaN(num) && num > 1000) {
            // Excel serial date — days since 1899-12-30
            const d = new Date((num - 25569) * 86400 * 1000)
            if (!isNaN(d.getTime())) iso = d.toISOString().slice(0, 10)
          } else {
            const d = new Date(val)
            if (!isNaN(d.getTime())) iso = d.toISOString().slice(0, 10)
          }
          if (iso) mapped[field] = new Date(iso + 'T12:00:00Z').toISOString()
          // Skip unparseable dates rather than crashing
        } else {
          // Normalize entity type labels to enum values
          if (field === 'entityType') {
            mapped[field] = ENTITY_TYPE_MAP[val.toLowerCase()] ?? val
          } else {
            mapped[field] = val
          }
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
