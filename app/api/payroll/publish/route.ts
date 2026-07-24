import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

/**
 * Publish raises — the single atomic action that makes sandbox raises effective.
 *
 * Called with a body of:
 *   { raises: [{ employeeId, newRate }] }
 *
 * For each employee in the list:
 *   1. Update employees.effectiveHourlyRate (source of truth read by capacity,
 *      profitability, drawer)
 *   2. For salaried employees, also update employees.salary = newRate * hours * 52
 *   3. Insert an employee_rate_history entry (stored as annual for salaried,
 *      hourly for hourly — matches the existing PATCH convention)
 *
 * Then bumps the payroll.currentFiscalYearStart setting by 1 so column labels
 * roll forward automatically next year.
 *
 * Skips archived employees defensively.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const body = await req.json().catch(() => null) as { raises?: { employeeId: string; newRate: number }[] } | null
  if (!body?.raises || !Array.isArray(body.raises) || body.raises.length === 0) {
    return NextResponse.json({ error: 'Missing or empty raises array' }, { status: 400 })
  }

  const empIds = body.raises.map(r => r.employeeId)
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

  for (const raise of body.raises) {
    const emp = empMap[raise.employeeId]
    if (!emp) { errors.push(`Employee ${raise.employeeId} not found`); continue }
    if (emp.isActive === false) continue

    const newRate = Number(raise.newRate)
    const hours = Number(emp.contractedHours ?? 40)
    const isHourly = emp.rateType === 'hourly'

    // Backfill: if this employee has no history entries, insert one for their
    // current rate BEFORE writing the new one. Otherwise "previous rate" would
    // stay blank forever on the display.
    const { data: existingHistory } = await supabase
      .from('employee_rate_history')
      .select('id')
      .eq('employeeId', raise.employeeId)
      .limit(1)
    if (!existingHistory || existingHistory.length === 0) {
      const currentHistoryRate = isHourly
        ? Number(emp.effectiveHourlyRate ?? 0)
        : Number(emp.salary ?? 0)
      if (currentHistoryRate > 0) {
        await supabase.from('employee_rate_history').insert({
          id: crypto.randomUUID(),
          employeeId: raise.employeeId,
          rateType: emp.rateType,
          rate: currentHistoryRate,
          // Backdated one day so it sorts as older than the new entry.
          effectiveDate: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
          notes: 'Backfill: pre-raise rate captured on first publish',
        })
      }
    }

    // Compute updates.
    const empUpdate: Record<string, unknown> = {
      effectiveHourlyRate: newRate,
      updatedAt: now,
    }
    let historyRate = newRate
    if (!isHourly) {
      const newSalary = newRate * hours * 52
      empUpdate.salary = newSalary
      historyRate = newSalary
    }

    const { error: uErr } = await supabase
      .from('employees')
      .update(empUpdate)
      .eq('id', raise.employeeId)
    if (uErr) { errors.push(`${emp.name}: ${uErr.message}`); continue }

    // Log the new rate.
    await supabase.from('employee_rate_history').insert({
      id: crypto.randomUUID(),
      employeeId: raise.employeeId,
      rateType: emp.rateType,
      rate: historyRate,
      effectiveDate: today,
      notes: 'Annual raise (published from payroll)',
    })

    results.push({ name: emp.name, oldRate: emp.effectiveHourlyRate as number | null, newRate, type: emp.rateType })
  }

  // Bump fiscal year setting. If it doesn't exist yet, seed it at
  // (current calendar year + 1) since we just published *this* year's raise.
  const { data: existing } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'payroll.currentFiscalYearStart')
    .maybeSingle()
  const nextStart = existing?.value
    ? Number(existing.value) + 1
    : new Date().getFullYear() + 1
  await supabase.from('settings').upsert({
    key: 'payroll.currentFiscalYearStart',
    value: String(nextStart),
    label: 'Payroll: current fiscal year start',
    updatedAt: now,
  }, { onConflict: 'key' })

  return NextResponse.json({
    published: results.length,
    currentFiscalYearStart: nextStart,
    results,
    errors: errors.length ? errors : undefined,
  })
}
