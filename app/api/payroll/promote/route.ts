import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

/**
 * Promote 2026-27 rates to current.
 *
 * For every payroll row that has hourlyRate2026 set (and whose employee is active),
 * this pushes the new rate into the employees table (which is where capacity,
 * profitability, drawer, etc. all read from), logs a rate history entry, then
 * shifts payroll.hourlyRate2026 → payroll.hourlyRate2025 and clears 2026.
 *
 * For salaried employees the hourlyRate2026 field is treated as the new derived
 * hourly (rate * hours * 52 = new salary). If the caller wants explicit salary
 * control, they should have edited annualSalary in sandbox before promoting;
 * we also read payroll.annualSalary as a fallback for salaried salary target.
 *
 * Returns a summary of what changed.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  // Fetch every payroll row w/ a proposed 2026-27 rate, joined to their employee.
  const { data: payroll, error: pErr } = await supabase
    .from('payroll')
    .select('id, employeeId, hourlyRate2025, hourlyRate2026, annualSalary')
    .not('hourlyRate2026', 'is', null)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  if (!payroll || payroll.length === 0) {
    return NextResponse.json({ promoted: 0, message: 'No 2026-27 rates set — nothing to promote.' })
  }

  const empIds = payroll.map(p => p.employeeId)
  const { data: employees, error: eErr } = await supabase
    .from('employees')
    .select('id, name, contractedHours, rateType, effectiveHourlyRate, salary, isActive')
    .in('id', empIds)
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const empMap = Object.fromEntries((employees ?? []).map(e => [e.id, e]))
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()

  const results: { name: string; oldRate: number | null; newRate: number; type: string }[] = []
  const errors: string[] = []

  for (const p of payroll) {
    const emp = empMap[p.employeeId]
    if (!emp) { errors.push(`Employee ${p.employeeId} not found`); continue }
    if (emp.isActive === false) continue  // skip archived — don't promote raises for offboarded folks

    const newRate = Number(p.hourlyRate2026)
    const hours = Number(emp.contractedHours ?? 40)
    const isHourly = emp.rateType === 'hourly'

    // Compute what to write on employees.
    const empUpdate: Record<string, unknown> = {
      effectiveHourlyRate: newRate,
      updatedAt: now,
    }
    let historyRate = newRate
    if (!isHourly) {
      // For salaried: prefer payroll.annualSalary if it was set in sandbox to reflect the raise,
      // otherwise derive from newRate * hours * 52.
      const newSalary = p.annualSalary != null ? Number(p.annualSalary) : newRate * hours * 52
      empUpdate.salary = newSalary
      // Rate history for salaried shows the annual (matches existing PATCH logic).
      historyRate = newSalary
    }

    const { error: uErr } = await supabase
      .from('employees')
      .update(empUpdate)
      .eq('id', p.employeeId)
    if (uErr) { errors.push(`${emp.name}: ${uErr.message}`); continue }

    // Log the rate change.
    await supabase.from('employee_rate_history').insert({
      id: crypto.randomUUID(),
      employeeId: p.employeeId,
      rateType: emp.rateType,
      rate: historyRate,
      effectiveDate: today,
      notes: 'Annual raise (promoted from 2026-27 payroll)',
    })

    // Shift payroll: 2026-27 → 2025-26, clear 2026-27.
    await supabase
      .from('payroll')
      .update({
        hourlyRate2025: p.hourlyRate2026,
        hourlyRate2026: null,
        updatedAt: now,
      })
      .eq('id', p.id)

    results.push({ name: emp.name, oldRate: emp.effectiveHourlyRate as number | null, newRate, type: emp.rateType })
  }

  return NextResponse.json({
    promoted: results.length,
    results,
    errors: errors.length ? errors : undefined,
  })
}
