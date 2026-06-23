import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const d = body as Record<string, unknown>

  const rateType     = typeof d.rateType === 'string' ? d.rateType : undefined
  const salary       = typeof d.salary === 'string' && d.salary ? parseFloat(d.salary) : undefined
  const hourlyRate   = typeof d.hourlyRate === 'string' && d.hourlyRate ? parseFloat(d.hourlyRate) : undefined
  const contractedHours = typeof d.contractedHours === 'string' ? parseFloat(d.contractedHours) : undefined

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (typeof d.name  === 'string') updates.name  = d.name.trim()
  if (typeof d.email === 'string') updates.email = d.email.trim().toLowerCase()
  if (typeof d.title === 'string') updates.title = d.title.trim()
  if (rateType)       updates.rateType       = rateType
  if (salary != null) updates.salary         = salary
  if (contractedHours != null) updates.contractedHours = contractedHours

  // Recompute effectiveHourlyRate if rate info changed
  if (rateType || salary != null || hourlyRate != null || contractedHours != null) {
    const { data: existing } = await supabase.from('employees').select('*').eq('id', id).single()
    if (existing) {
      const finalRateType = rateType ?? existing.rateType ?? 'hourly'
      const finalSalary   = salary ?? existing.salary
      const finalHourly   = hourlyRate ?? existing.effectiveHourlyRate
      const finalHours    = contractedHours ?? existing.contractedHours
      const weeksPerYear  = 52

      const newRate = finalRateType === 'salary' && finalSalary && finalHours > 0
        ? parseFloat((finalSalary / (finalHours * weeksPerYear)).toFixed(2))
        : (hourlyRate ?? finalHourly)

      updates.effectiveHourlyRate = newRate

      // Log rate change if rate actually changed
      if (newRate !== Number(existing.effectiveHourlyRate)) {
        await supabase.from('employee_rate_history').insert({
          id:            crypto.randomUUID(),
          employeeId:    id,
          rateType:      finalRateType,
          rate:          newRate,
          effectiveDate: new Date().toISOString().split('T')[0],
          notes:         typeof d.rateChangeNote === 'string' ? d.rateChangeNote : null,
        })
      }
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employee: data })
}
