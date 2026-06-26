import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET — fetch all payroll records joined with employee names
export async function GET(): Promise<NextResponse> {
  const { data: payroll, error: pErr } = await supabase
    .from('payroll')
    .select('*')
    .order('"createdAt"', { ascending: true })

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: employees, error: eErr } = await supabase
    .from('employees')
    .select('id, name, contractedHours, adminTimePercent')

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const empMap = Object.fromEntries((employees ?? []).map(e => [e.id, e]))

  const rows = (payroll ?? []).map(p => {
    const emp = empMap[p.employeeId] ?? {}
    const hoursPerWeek   = Number(p.hoursPerWeek ?? emp.contractedHours ?? 40)
    const adminPct       = Number(p.adminPercent ?? emp.adminTimePercent ?? 0) / 100
    const annualSalary   = p.isHourly
      ? Number(p.hourlyRate2025 ?? 0) * hoursPerWeek * 52
      : Number(p.annualSalary ?? 0)
    const perPeriodRate  = annualSalary / 26
    const bonusCalc      = (annualSalary * (Number(p.monthsExpected ?? 12) / 12)) * 0.03
    const booksCapWk     = hoursPerWeek * (1 - adminPct)
    const booksCapMo     = booksCapWk * 4.333

    return {
      id:              p.id,
      employeeId:      p.employeeId,
      name:            emp.name ?? 'Unknown',
      dept:            p.dept ?? 'COGS',
      hourlyRate2023:  p.hourlyRate2023,
      hourlyRate2024:  p.hourlyRate2024,
      hourlyRate2025:  p.hourlyRate2025,
      hoursPerWeek,
      isHourly:        p.isHourly ?? false,
      annualSalary,
      perPeriodRate,
      perPeriodTax:    p.perPeriodTax,
      monthsExpected:  p.monthsExpected,
      bonusCalc,
      bonusManual:     p.bonusManual,
      retirement401k:  p.retirement401k,
      techReimb:       p.techReimb,
      adminPercent:    p.adminPercent,
      booksCapWk,
      booksCapMo,
      createdAt:       p.createdAt,
      updatedAt:       p.updatedAt,
    }
  })

  // Totals
  const totals = {
    annualSalary:  rows.reduce((s, r) => s + r.annualSalary, 0),
    perPeriodRate: rows.reduce((s, r) => s + r.perPeriodRate, 0),
    perPeriodTax:  rows.reduce((s, r) => s + Number(r.perPeriodTax ?? 0), 0),
    bonusCalc:     rows.reduce((s, r) => s + r.bonusCalc, 0),
    bonusManual:   rows.reduce((s, r) => s + Number(r.bonusManual ?? 0), 0),
    retirement401k:rows.reduce((s, r) => s + Number(r.retirement401k ?? 0), 0),
    techReimb:     rows.reduce((s, r) => s + Number(r.techReimb ?? 0), 0),
    booksCapWk:    rows.reduce((s, r) => s + r.booksCapWk, 0),
    booksCapMo:    rows.reduce((s, r) => s + r.booksCapMo, 0),
  }

  return NextResponse.json({ payroll: rows, totals })
}

// PATCH — update a single payroll record
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { id, ...fields } = body

  // Recalculate annualSalary if hourly fields changed
  if (fields.isHourly && fields.hourlyRate2025 && fields.hoursPerWeek) {
    fields.annualSalary = null // stored as null for hourly — calculated on read
  }

  const { data, error } = await supabase
    .from('payroll')
    .update({ ...fields, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

// POST — seed a new payroll record for an employee
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  if (!body?.employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

  const { data, error } = await supabase
    .from('payroll')
    .insert({
      id:         crypto.randomUUID(),
      ...body,
      createdAt:  new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data }, { status: 201 })
}
