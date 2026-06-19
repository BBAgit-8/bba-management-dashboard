import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      tags:client_tags(tag:tags(*)),
      sows(billing_type, fixed_monthly_rate, billing_rate)
    `)
    .order('name')

  if (error) {
    console.error('[GET /api/clients]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Normalize snake_case DB columns → camelCase for the frontend
  const shaped = (data ?? []).map((c: any) => ({
    id:                  c.id,
    name:                c.name,
    harvestProjectCode:  c.harvest_project_code,
    archiveStatus:       c.archive_status,
    processingCadence:   c.processing_cadence,
    projectType:         c.project_type,
    revenueType:         c.revenue_type,
    qboOnly:             c.qbo_only,
    contractEndDate:     c.contract_end_date ?? null,
    tags: (c.tags ?? []).map((ct: any) => ct.tag).filter(Boolean),
    sows: (c.sows ?? []).map((s: any) => ({
      billingType:      s.billing_type,
      fixedMonthlyRate: s.fixed_monthly_rate ? Number(s.fixed_monthly_rate) : null,
      billingRate:      s.billing_rate       ? Number(s.billing_rate)       : null,
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

  // Use snake_case to match actual DB columns
  const row: Record<string, unknown> = {
    name,
    harvest_project_code:         harvestProjectCode,
    accountant_name:              typeof data.accountantName           === 'string' ? data.accountantName.trim()  || null : null,
    entity_type:                  typeof data.entityType               === 'string' ? data.entityType              : 'LLC',
    ein_number:                   typeof data.einNumber                === 'string' ? data.einNumber.trim()        || null : null,
    office_type:                  typeof data.officeType               === 'string' ? data.officeType              : 'HOME_OFFICE',
    processing_cadence:           typeof data.processingCadence        === 'string' ? data.processingCadence       : 'MONTHLY',
    project_type:                 typeof data.projectType              === 'string' ? data.projectType             : 'MONTHLY_MAINTENANCE',
    referred_by:                  typeof data.referredBy               === 'string' ? data.referredBy.trim()       || null : null,
    payroll_provider:             typeof data.payrollProvider          === 'string' ? data.payrollProvider.trim()  || null : null,
    has_payroll:                  data.hasPayroll            === true,
    ok_to_contact_accountant:     data.okToContactAccountant === true,
    qbo_only:                     data.qboOnly               === true,
    archive_status:               'ACTIVE',
    guaranteed_deadline_day:      typeof data.guaranteedDeadlineDay === 'string' && data.guaranteedDeadlineDay
                                    ? parseInt(data.guaranteedDeadlineDay, 10) || null : null,
    auto_price_increase_percent:  typeof data.autoPriceIncreasePercent === 'string' && data.autoPriceIncreasePercent
                                    ? parseFloat(data.autoPriceIncreasePercent) || null : null,
    contract_start_date:          typeof data.contractStartDate === 'string' && data.contractStartDate
                                    ? data.contractStartDate : null,
    price_adjustment_date:        typeof data.priceAdjustmentDate === 'string' && data.priceAdjustmentDate
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
      tagIds.map(tagId => ({ client_id: client.id, tag_id: tagId }))
    )
  }

  return NextResponse.json({ client }, { status: 201 })
}
