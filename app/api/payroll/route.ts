import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data: payroll, error: pErr } = await supabase
    .from('payroll')
    .select('*')
    .order('"createdAt"', { ascending: true })

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: employees, error: eErr } = await supabase
    .from('employees')
    .select('id, name, contractedHours, adminTimePercent, salary, rateType, isActive')

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const empMap = Object.fromEntries((employees ?? []).map(e => [e.id, e]))

  const rows = (payroll ?? []).map(p => {
    const emp            = empMap[p.employeeId] ?? {}
    const hoursPerWeek   = Number(p.hoursPerWeek ?? emp.contractedHours ?? 40)
    const adminPct       = Number(p.adminPercent ?? emp.adminTimePercent ?? 0) / 100
    const isHourly       = p.isHourly ?? emp.rateType === 'hourly'

    // Salary: payroll.annualSalary overrides employee.salary
    const annualSalary = isHourly
      ? Number(p.hourlyRate2025 ?? 0) * hoursPerWeek * 52
      : Number(p.annualSalary ?? emp.salary ?? 0)

    const perPeriodRate  = annualSalary / 26
    const bonusCalc      = (annualSalary * (Number(p.monthsExpected ?? 12) / 12)) * 0.03
    const booksCapWk     = hoursPerWeek * (1 - adminPct)
    const booksCapMo     = booksCapWk * 4.333

    return {
      id:              p.id,
      employeeId:      p.employeeId,
      name:            emp.name ?? 'Unknown',
      dept:            p.dept ?? 'COGS',
      isContractor:    p.isContractor ?? false,
      isActive:        emp.isActive ?? true,
      hourlyRate2023:  p.hourlyRate2023,
      hourlyRate2024:  p.hourlyRate2024,
      hourlyRate2025:  p.hourlyRate2025,
      hoursPerWeek,
      isHourly,
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
    }
  })

  const eeRows   = rows.filter(r => !r.isContractor)
  const cntrRows = rows.filter(r => r.isContractor)

  function sumTotals(subset: typeof rows) {
    return {
      annualSalary:   subset.reduce((s, r) => s + r.annualSalary, 0),
      perPeriodRate:  subset.reduce((s, r) => s + r.perPeriodRate, 0),
      perPeriodTax:   subset.reduce((s, r) => s + Number(r.perPeriodTax ?? 0), 0),
      bonusCalc:      subset.reduce((s, r) => s + r.bonusCalc, 0),
      bonusManual:    subset.reduce((s, r) => s + Number(r.bonusManual ?? 0), 0),
      retirement401k: subset.reduce((s, r) => s + Number(r.retirement401k ?? 0), 0),
      techReimb:      subset.reduce((s, r) => s + Number(r.techReimb ?? 0), 0),
      booksCapWk:     subset.reduce((s, r) => s + r.booksCapWk, 0),
      booksCapMo:     subset.reduce((s, r) => s + r.booksCapMo, 0),
    }
  }

  return NextResponse.json({
    payroll: rows,
    totals: {
      ee:   sumTotals(eeRows),
      cntr: sumTotals(cntrRows),
      all:  sumTotals(rows),
    },
  })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { id, ...fields } = body
  const { data, error } = await supabase
    .from('payroll')
    .update({ ...fields, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  if (!body?.employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })
  const { data, error } = await supabase
    .from('payroll')
    .insert({ id: crypto.randomUUID(), ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data }, { status: 201 })
}
