import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      tags:client_tags(tag:tags(*)),
      sows(billingType, fixedMonthlyRate, billingRate)
    `)
    .order('name')

  if (error) {
    console.error('[GET /api/clients]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const shaped = (data ?? []).map((c: any) => ({
    id:                 c.id,
    name:               c.name,
    harvestProjectCode: c.harvestProjectCode,
    archiveStatus:      c.archiveStatus,
    processingCadence:  c.processingCadence,
    projectType:        c.projectType,
    revenueType:        c.revenueType,
    qboOnly:            c.qboOnly,
    contractEndDate:    c.contractEndDate ?? null,
    tags: (c.tags ?? []).map((ct: any) => ct.tag).filter(Boolean),
    sows: (c.sows ?? []).map((s: any) => ({
      billingType:      s.billingType,
      fixedMonthlyRate: s.fixedMonthlyRate ? Number(s.fixedMonthlyRate) : null,
      billingRate:      s.billingRate      ? Number(s.billingRate)      : null,
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
    name,
    harvestProjectCode,
    accountantName:           typeof data.accountantName           === 'string' ? data.accountantName.trim()  || null : null,
    entityType:               typeof data.entityType               === 'string' ? data.entityType              : 'LLC',
    einNumber:                typeof data.einNumber                === 'string' ? data.einNumber.trim()        || null : null,
    officeType:               typeof data.officeType               === 'string' ? data.officeType              : 'HOME_OFFICE',
    processingCadence:        typeof data.processingCadence        === 'string' ? data.processingCadence       : 'MONTHLY',
    projectType:              typeof data.projectType              === 'string' ? data.projectType             : 'MONTHLY_MAINTENANCE',
    referredBy:               typeof data.referredBy               === 'string' ? data.referredBy.trim()       || null : null,
    payrollProvider:          typeof data.payrollProvider          === 'string' ? data.payrollProvider.trim()  || null : null,
    hasPayroll:               data.hasPayroll            === true,
    okToContactAccountant:    data.okToContactAccountant === true,
    qboOnly:                  data.qboOnly               === true,
    archiveStatus:            'ACTIVE',
    guaranteedDeadlineDay:    typeof data.guaranteedDeadlineDay === 'string' && data.guaranteedDeadlineDay
                                ? parseInt(data.guaranteedDeadlineDay, 10) || null : null,
    autoPriceIncreasePercent: typeof data.autoPriceIncreasePercent === 'string' && data.autoPriceIncreasePercent
                                ? parseFloat(data.autoPriceIncreasePercent) || null : null,
    contractStartDate:        typeof data.contractStartDate === 'string' && data.contractStartDate
                                ? data.contractStartDate : null,
    priceAdjustmentDate:      typeof data.priceAdjustmentDate === 'string' && data.priceAdjustmentDate
                                ? data.priceAdjustmentDate : null,
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

  // Connect tags
  const tagIds: string[] = Array.isArray(data.selectedTags) ? data.selectedTags as string[] : []
  if (tagIds.length > 0 && client) {
    await supabase.from('client_tags').insert(
      tagIds.map(tagId => ({ clientId: client.id, tagId }))
    )
  }

  return NextResponse.json({ client }, { status: 201 })
}
