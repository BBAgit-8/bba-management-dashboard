import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const { data: payroll, error: pErr } = await supabase
    .from('payroll')
    .select('*')
    .order('"createdAt"', { ascending: true })

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: employees, error: eErr } = await supabase
    .from('employees')
    .select('id, name, contractedHours, adminTimePercent, salary, rateType, employeeType, isActive, effectiveHourlyRate')

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  // Pull rate history in one shot; we'll compute previousRate per employee
  // as the second-most-recent entry (most-recent = current rate).
  const { data: history } = await supabase
    .from('employee_rate_history')
    .select('employeeId, rate, rateType, effectiveDate')
    .order('effectiveDate', { ascending: false })

  // Group history by employeeId → chronological (desc) list of entries.
  const historyByEmp: Record<string, { rate: number; rateType: string; effectiveDate: string }[]> = {}
  for (const h of history ?? []) {
    if (!historyByEmp[h.employeeId]) historyByEmp[h.employeeId] = []
    historyByEmp[h.employeeId].push({ rate: Number(h.rate), rateType: h.rateType, effectiveDate: h.effectiveDate })
  }

  // Fiscal year setting drives the column labels shown on the client.
  // If missing, default to the current calendar year.
  const { data: fySetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'payroll.currentFiscalYearStart')
    .maybeSingle()
  const currentFiscalYearStart = fySetting?.value ? Number(fySetting.value) : new Date().getFullYear()

  const empMap = Object.fromEntries((employees ?? []).map(e => [e.id, e]))

  const rows = (payroll ?? []).map(p => {
    const emp            = empMap[p.employeeId] ?? {}
    const hoursPerWeek   = Number(emp.contractedHours ?? 40)
    const adminPct       = Number(p.adminPercent ?? emp.adminTimePercent ?? 15) / 100
    const isHourly       = emp.rateType === 'hourly'
    const isContractor   = emp.employeeType === 'contractor'

    // Current rate: single source of truth is employees.effectiveHourlyRate.
    // For salaried employees this is a derived hourly (salary / hours / 52).
    const currentRate = emp.effectiveHourlyRate != null ? Number(emp.effectiveHourlyRate) : null

    // Previous rate: second-most-recent rate history entry. May be null if
    // the employee has never had a raise recorded — that's fine, display as —.
    // Convert stored value to hourly for display: salaried entries are stored
    // as annual salary; divide by hours*52.
    const empHistory = historyByEmp[p.employeeId] ?? []
    let previousRate: number | null = null
    if (empHistory.length >= 2) {
      const prev = empHistory[1]
      previousRate = prev.rateType === 'salary'
        ? prev.rate / (hoursPerWeek * 52)
        : prev.rate
    }

    // Annual salary — always from employees table (or override if payroll has it explicitly)
    const annualSalary = isHourly
      ? Number(currentRate ?? 0) * hoursPerWeek * 52
      : Number(p.annualSalary ?? emp.salary ?? 0)

    const perPeriodRate  = annualSalary / 26
    const perPeriodTax   = perPeriodRate * 0.091
    const retirement401k = perPeriodRate * 0.04
    const bonusCalc      = (annualSalary * (Number(p.monthsExpected ?? 12) / 12)) * 0.03
    const booksCapWk     = hoursPerWeek * (1 - adminPct)
    const booksCapMo     = booksCapWk * 4.333

    return {
      id:              p.id,
      employeeId:      p.employeeId,
      name:            emp.name ?? 'Unknown',
      dept:            p.dept ?? 'COGS',
      isContractor,
      isActive:        emp.isActive ?? true,
      previousRate,       // readonly display, derived from rate history
      currentRate,        // editable → writes to employees.effectiveHourlyRate
      proposedRate:    null,  // sandbox-only; server never populates this
      hoursPerWeek,
      isHourly,
      annualSalary,
      perPeriodRate,
      perPeriodTax,
      retirement401k,
      monthsExpected:  p.monthsExpected,
      bonusCalc,
      bonusManual:     p.bonusManual,
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
    currentFiscalYearStart,
    totals: {
      ee:   sumTotals(eeRows),
      cntr: sumTotals(cntrRows),
      all:  sumTotals(rows),
    },
  })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

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
  const gate = await requireAuth(req); if (gate) return gate;

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
