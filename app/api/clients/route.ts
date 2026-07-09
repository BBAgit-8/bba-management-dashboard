import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      tags:client_tags(tag:tags(*)),
      sows(billingType, fixedMonthlyRate, billingRate, targetHours),
      accountant:accountants(id, name, businessName)
    `)
    .order('name')

  if (error) {
    console.error('[GET /api/clients]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch employee rates to enrich client records with costRate
  const { data: employees } = await supabase
    .from('employees')
    .select('name, effectiveHourlyRate')
  const empRateByName: Record<string, number> = {}
  for (const e of employees ?? []) {
    if (e.name) empRateByName[e.name] = Number(e.effectiveHourlyRate) || 0
  }

  const shaped = (data ?? []).map((c: any) => ({
    id:                       c.id,
    name:                     c.name,
    harvestProjectCode:       c.harvestProjectCode,
    archiveStatus:            c.archiveStatus,
    processingCadence:        c.processingCadence,
    projectType:              c.projectType        ?? null,
    revType:                  c.revType            ?? null,
    revenueType:              c.revenueType        ?? null,
    qboOnly:                  c.qboOnly            ?? false,
    contractStartDate:        c.contractStartDate  ?? null,
    contractEndDate:          c.contractEndDate    ?? null,
    entityType:               c.entityType         ?? null,
    guaranteedDeadlineDay:    c.guaranteedDeadlineDay ?? null,
    softwareRate:             c.softwareRate        != null ? Number(c.softwareRate)        : null,
    totalMonthlyAmount:       c.totalMonthlyAmount  != null ? Number(c.totalMonthlyAmount)  : null,
    hasContractedLoom:        c.hasContractedLoom    ?? false,
    hasScheduledMeetings:     c.hasScheduledMeetings ?? false,
    hasSignedAutoIncrease:    c.hasSignedAutoIncrease ?? false,
    autoPriceIncreasePercent: c.autoPriceIncreasePercent != null ? Number(c.autoPriceIncreasePercent) : null,
    priceAdjustmentDate:      c.priceAdjustmentDate ?? null,
    lastIncreaseDate:         c.lastIncreaseDate ?? null,
    clientContext:            c.clientContext ?? null,
    oddBookkeepingNotes:      c.oddBookkeepingNotes ?? null,
    // nextBkprRate: current bkpr rate × (1 + %/100), rounded up to nearest dollar.
    // Computed here so reports can consume the value directly (never stored — always fresh).
    nextBkprRate: (() => {
      const rate = c.bookkeepingRate != null ? Number(c.bookkeepingRate) : 0;
      const pct  = c.autoPriceIncreasePercent != null ? Number(c.autoPriceIncreasePercent) : 0;
      if (rate <= 0 || pct <= 0) return null;
      return Math.ceil(rate * (1 + pct / 100));
    })(),
    okToContactAccountant:    c.okToContactAccountant ?? false,
    // Bookkeeper (text field on clients table)
    bookkeeper:               c.Bookkeeper          ?? null,
    costRate:                 c.Bookkeeper ? (empRateByName[c.Bookkeeper] ?? 0) : 0,
    accountantName:           c.accountant?.businessName || c.accountant?.name || c.accountantName || null,
    accountantPersonName:     c.accountant?.name || null,
    accountantId:             c.accountantId        ?? null,
    // New fields
    clientGroupName:          c.clientGroupName     ?? null,
    doubleId:                 c.doubleId            ?? null,
    qboId:                    c.qboId               ?? null,
    clickUpId:                c.clickUpId           ?? null,
    clientContactName:        c.clientContactName   ?? null,
    bookkeepingRate:          c.bookkeepingRate     != null ? Number(c.bookkeepingRate)     : null,
    totalHrsPerMonth:         c.totalHrsPerMonth    != null ? Number(c.totalHrsPerMonth)    : null,
    apArHrs:                  c.apArHrs             != null ? Number(c.apArHrs)             : null,
    qaHours:                  c.qaHours             != null ? Number(c.qaHours)             : null,
    custSuccessMgmtHrs:       c.custSuccessMgmtHrs  != null ? Number(c.custSuccessMgmtHrs) : null,
    yeOrTaxHours:             c.yeOrTaxHours        != null ? Number(c.yeOrTaxHours)        : null,
    auditHours:               c.auditHours          != null ? Number(c.auditHours)          : null,
    bkprHours:                c.bkprHours           != null ? Number(c.bkprHours)           : null,
    bankFeedTime:             c.bankFeedTime        != null ? Number(c.bankFeedTime)        : null,
    transactionsPerMonth:     c.transactionsPerMonth ?? null,
    annual1099sRange:         c.annual1099sRange     ?? null,
    wcAuditSupport:           c.wcAuditSupport       ?? false,
    annualAuditSupport:       c.annualAuditSupport   ?? false,
    recTime:                  c.recTime             != null ? Number(c.recTime)             : null,
    numBanksAndCCs:           c.numBanksAndCCs      != null ? Number(c.numBanksAndCCs)      : null,
    numLoans:                 c.numLoans            != null ? Number(c.numLoans)            : null,
    numPmtPortals:            c.numPmtPortals       != null ? Number(c.numPmtPortals)       : null,
    pettyCash:                c.pettyCash           ?? false,
    referredBy:               c.referredBy          ?? null,
    state:                    c.state               ?? null,
    tags: (c.tags ?? []).map((ct: any) => ct.tag).filter(Boolean),
    sows: (c.sows ?? []).map((s: any) => ({
      billingType:      s.billingType,
      fixedMonthlyRate: s.fixedMonthlyRate != null ? Number(s.fixedMonthlyRate) : null,
      billingRate:      s.billingRate      != null ? Number(s.billingRate)      : null,
      targetHours:      s.targetHours      != null ? Number(s.targetHours)      : null,
    })),
  }))

  return NextResponse.json({ clients: shaped })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = (body ?? {}) as Record<string, unknown>

  const name               = typeof data.name               === 'string' ? data.name.trim()               : ''
  const harvestProjectCode = typeof data.harvestProjectCode === 'string' ? data.harvestProjectCode.trim() : ''

  if (!name)               return NextResponse.json({ error: '"name" is required' },               { status: 422 })
  if (!harvestProjectCode) return NextResponse.json({ error: '"harvestProjectCode" is required' }, { status: 422 })

  const row: Record<string, unknown> = {
    id:        crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name,
    harvestProjectCode,
    accountantId:             typeof data.accountantId             === 'string' ? data.accountantId.trim()    || null : null,
    accountantName:           typeof data.accountantName           === 'string' ? data.accountantName.trim()  || null : null,
    "Bookkeeper":             typeof data.bookkeeper               === 'string' ? data.bookkeeper.trim()       || null : null,
    entityType:               typeof data.entityType               === 'string' ? data.entityType              : 'LLC',
    einNumber:                typeof data.einNumber                === 'string' ? data.einNumber.trim()        || null : null,
    officeType:               typeof data.officeType               === 'string' ? data.officeType              : 'HOME_OFFICE',
    processingCadence:        typeof data.processingCadence        === 'string' ? data.processingCadence       : 'MONTHLY',
    projectType:              typeof data.projectType              === 'string' ? data.projectType             : 'RECURRING',
    revType:                  typeof data.revType                  === 'string' ? data.revType.trim()          || null : null,
    referredBy:               typeof data.referredBy               === 'string' ? data.referredBy.trim()       || null : null,
    payrollProvider:          typeof data.payrollProvider          === 'string' ? data.payrollProvider.trim()  || null : null,
    hasPayroll:               data.hasPayroll            === true,
    okToContactAccountant:    data.okToContactAccountant === true,
    archiveStatus:            'ACTIVE',
    guaranteedDeadlineDay:    typeof data.guaranteedDeadlineDay === 'string' && data.guaranteedDeadlineDay
                                ? parseInt(data.guaranteedDeadlineDay, 10) || null : null,
    autoPriceIncreasePercent: typeof data.autoPriceIncreasePercent === 'string' && data.autoPriceIncreasePercent
                                ? parseFloat(data.autoPriceIncreasePercent) || null : null,
    contractStartDate:        typeof data.contractStartDate === 'string' && data.contractStartDate
                                ? data.contractStartDate : null,
    contractEndDate:          typeof data.contractEndDate === 'string' && data.contractEndDate
                                ? data.contractEndDate : null,
    priceAdjustmentDate:      typeof data.priceAdjustmentDate === 'string' && data.priceAdjustmentDate
                                ? data.priceAdjustmentDate : null,
    clientGroupName:          typeof data.clientGroupName    === 'string' ? data.clientGroupName.trim()    || null : null,
    doubleId:                 typeof data.doubleId           === 'string' ? data.doubleId.trim()           || null : null,
    qboId:                    typeof data.qboId              === 'string' ? data.qboId.trim()              || null : null,
    clickUpId:                typeof data.clickUpId          === 'string' ? data.clickUpId.trim()          || null : null,
    clientContactName:        typeof data.clientContactName  === 'string' ? data.clientContactName.trim()  || null : null,
    bookkeepingRate:          typeof data.bookkeepingRate    === 'string' && data.bookkeepingRate
                                ? parseFloat(data.bookkeepingRate) || null : null,
    totalHrsPerMonth:         typeof data.totalHrsPerMonth   === 'string' && data.totalHrsPerMonth
                                ? parseFloat(data.totalHrsPerMonth) || null : null,
    apArHrs:                  typeof data.apArHrs            === 'string' && data.apArHrs
                                ? parseFloat(data.apArHrs) || null : null,
    qaHours:                  typeof data.qaHours            === 'string' && data.qaHours
                                ? parseFloat(data.qaHours) || null : null,
    custSuccessMgmtHrs:       typeof data.custSuccessMgmtHrs === 'string' && data.custSuccessMgmtHrs
                                ? parseFloat(data.custSuccessMgmtHrs) || null : null,
    yeOrTaxHours:             typeof data.yeOrTaxHours       === 'string' && data.yeOrTaxHours
                                ? parseFloat(data.yeOrTaxHours) || null : null,
    auditHours:               typeof data.auditHours         === 'string' && data.auditHours
                                ? parseFloat(data.auditHours) || null : null,
    bkprHours:                typeof data.bkprHours          === 'string' && data.bkprHours
                                ? parseFloat(data.bkprHours) || null : null,
    bankFeedTime:             typeof data.bankFeedTime       === 'string' && data.bankFeedTime
                                ? parseFloat(data.bankFeedTime) || null : null,
    transactionsPerMonth:     typeof data.transactionsPerMonth === 'string' && data.transactionsPerMonth
                                ? data.transactionsPerMonth.trim() : null,
    annual1099sRange:         typeof data.annual1099sRange === 'string' && data.annual1099sRange
                                ? data.annual1099sRange.trim() : null,
    wcAuditSupport:           data.wcAuditSupport     === true,
    annualAuditSupport:       data.annualAuditSupport === true,
    recTime:                  typeof data.recTime            === 'string' && data.recTime
                                ? parseFloat(data.recTime) || null : null,
    numBanksAndCCs:           typeof data.numBanksAndCCs     === 'string' && data.numBanksAndCCs
                                ? parseInt(data.numBanksAndCCs, 10) || null : null,
    numLoans:                 typeof data.numLoans           === 'string' && data.numLoans
                                ? parseInt(data.numLoans, 10) || null : null,
    numPmtPortals:            typeof data.numPmtPortals      === 'string' && data.numPmtPortals
                                ? parseInt(data.numPmtPortals, 10) || null : null,
    pettyCash:                data.pettyCash === true,
  }

  const { data: client, error } = await supabase
    .from('clients')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('[POST /api/clients]', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: `Project code "${harvestProjectCode}" already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tagIds: string[] = Array.isArray(data.selectedTags) ? data.selectedTags as string[] : []
  if (tagIds.length > 0 && client) {
    await supabase.from('client_tags').insert(
      tagIds.map(tagId => ({ clientId: client.id, tagId }))
    )
  }

  return NextResponse.json({ client }, { status: 201 })
}
