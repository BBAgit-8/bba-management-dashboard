import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

export async function GET(req: NextRequest) {
  const gate = await requireAuth(req); if (gate) return gate;

  // Default: active roster only. Pass ?includeInactive=1 (or =true) to see
  // archived/off-boarded employees — used by the Employees page's archive tab.
  const url = new URL(req.url)
  const includeInactive = ['1', 'true', 'yes'].includes((url.searchParams.get('includeInactive') ?? '').toLowerCase())

  let query = supabase.from('employees').select('*').order('name', { ascending: true })
  if (!includeInactive) {
    // isActive can be null on legacy rows — treat null as active, only exclude
    // rows explicitly marked false.
    query = query.or('isActive.is.null,isActive.eq.true')
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/employees error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const d = body as Record<string, unknown>

  const name = typeof d.name === 'string' ? d.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 422 })

  const rateType = typeof d.rateType === 'string' ? d.rateType : 'hourly'
  const salary   = typeof d.salary === 'string' && d.salary ? parseFloat(d.salary) : null
  const hourlyRate = typeof d.hourlyRate === 'string' && d.hourlyRate ? parseFloat(d.hourlyRate) : 0

  // Compute effectiveHourlyRate
  const contractedHours = typeof d.contractedHours === 'string' && d.contractedHours
    ? parseFloat(d.contractedHours) : 0
  const weeksPerYear = 52
  const effectiveHourlyRate = rateType === 'salary' && salary && contractedHours > 0
    ? parseFloat((salary / (contractedHours * weeksPerYear)).toFixed(2))
    : hourlyRate

  // Dept + contractor classification: dept comes from the Add Employee panel.
  // CNTR (contractor) sets employeeType so payroll routes them to the CNTR section.
  const deptRaw = typeof d.dept === 'string' ? d.dept.toUpperCase() : 'COGS'
  const dept: 'COGS' | 'GA' | 'CNTR' = (['COGS', 'GA', 'CNTR'] as const).includes(deptRaw as any) ? deptRaw as any : 'COGS'
  const employeeType = dept === 'CNTR' ? 'contractor' : 'employee'

  const row = {
    id:                  crypto.randomUUID(),
    name,
    email:               typeof d.email === 'string' ? d.email.trim().toLowerCase() || null : null,
    title:               typeof d.title === 'string' ? d.title.trim() || null : null,
    rateType,
    employeeType,
    salary:              salary ?? null,
    contractedHours,
    adminTimePercent:    typeof d.adminTimePercent === 'string' ? parseFloat(d.adminTimePercent) || 0 : 0,
    effectiveHourlyRate,
    hubAccess:           false,
    createdAt:           new Date().toISOString(),
    updatedAt:           new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('employees')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('POST /api/employees error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Seed initial rate history — store salary amount for salary employees, hourly rate for hourly
  const historicalRate = rateType === 'salary' && salary ? salary : effectiveHourlyRate
  await supabase.from('employee_rate_history').insert({
    id:            crypto.randomUUID(),
    employeeId:    data.id,
    rateType,
    rate:          historicalRate,
    effectiveDate: new Date().toISOString().split('T')[0],
    notes:         'Initial rate',
  })

  // Create the matching payroll row so this employee shows up on /payroll
  // in the correct section (COGS / GA / CNTR). Failures are logged but not
  // fatal — the employee record itself is still created.
  const payrollRow: Record<string, unknown> = {
    id:            crypto.randomUUID(),
    employeeId:    data.id,
    dept,
    monthsExpected: 12,
    adminPercent:  typeof d.adminTimePercent === 'string' ? parseFloat(d.adminTimePercent) || null : null,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  }
  if (rateType === 'hourly') payrollRow.hourlyRate2025 = hourlyRate
  else                       payrollRow.annualSalary   = salary
  const { error: payrollErr } = await supabase.from('payroll').insert(payrollRow)
  if (payrollErr) console.error('Payroll row insert failed (employee still created):', payrollErr)

  return NextResponse.json({ employee: data }, { status: 201 })
}
