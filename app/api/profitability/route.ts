import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const from = req.nextUrl.searchParams.get('from')
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const to = req.nextUrl.searchParams.get('to')
    ?? new Date().toISOString().split('T')[0]

  // 1. Get all active clients
  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, harvestProjectCode, totalMonthlyAmount, "Bookkeeper", totalHrsPerMonth, projectType, entityType')
    .neq('archiveStatus', 'ARCHIVED')
    .order('name')

  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })

  // 2. Get all employees with cost rates
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, effectiveHourlyRate')

  const empByName: Record<string, number> = {}
  for (const e of employees ?? []) {
    empByName[e.name] = Number(e.effectiveHourlyRate)
  }

  // 3. Get Harvest settings
  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['harvest_token', 'harvest_account_id'])

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) settingsMap[s.key] = s.value

  const token     = settingsMap.harvest_token
  const accountId = settingsMap.harvest_account_id

  // 4. Get Harvest time entries
  let harvestEntries: any[] = []
  let harvestConnected = false
  let harvestError: string | null = null

  if (token && accountId) {
    try {
      let page = 1
      while (true) {
        const res = await fetch(
          `https://api.harvestapp.com/v2/time_entries?from=${from}&to=${to}&page=${page}&per_page=100`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Harvest-Account-Id': accountId,
              'User-Agent': 'BBA-Management-Dashboard',
            },
          }
        )
        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`)
          harvestError = `${res.status}: ${errText.slice(0, 200)}`
          console.error('[Harvest]', harvestError)
          break
        }
        const data = await res.json()
        harvestEntries = harvestEntries.concat(data.time_entries ?? [])
        if (!data.next_page) break
        page++
      }
      if (harvestEntries.length > 0 || !harvestError) harvestConnected = !harvestError
    } catch (e: any) {
      harvestError = e.message
      harvestConnected = false
    }
  } else {
    harvestError = 'Harvest credentials not found in settings table'
  }

  // 5. Aggregate hours by project code from Harvest
  const hoursByCode: Record<string, number> = {}
  const hoursByName: Record<string, number> = {}

  // Debug: log what we got from Harvest
  const harvestDebug = harvestEntries.slice(0, 5).map(e => ({
    projectId:   e.project?.id,
    projectName: e.project?.name,
    projectCode: e.project?.code,
    hours:       e.hours,
    date:        e.spent_date,
  }))

  for (const entry of harvestEntries) {
    // Try matching by project code first
    const code = entry.project?.code?.toUpperCase()?.trim()
    if (code) hoursByCode[code] = (hoursByCode[code] ?? 0) + (entry.hours ?? 0)
    // Also index by project name (uppercased) as fallback
    const name = entry.project?.name?.toUpperCase()?.trim()
    if (name) hoursByName[name] = (hoursByName[name] ?? 0) + (entry.hours ?? 0)
  }

  // Debug: show what codes exist in Harvest
  const harvestCodes = Object.keys(hoursByCode)
  const clientCodes  = (clients ?? []).map(c => c.harvestProjectCode?.toUpperCase()?.trim())

  // 6. Build profitability rows
  const rows = (clients ?? []).map(client => {
    const code        = client.harvestProjectCode?.toUpperCase()
    const revenue     = Number(client.totalMonthlyAmount ?? 0)
    const bookkeeper  = client.Bookkeeper ?? null
    const costRate    = bookkeeper ? (empByName[bookkeeper] ?? 0) : 0
    const harvestHrs  = harvestConnected
      ? (hoursByCode[code] ?? hoursByName[code] ?? 0)
      : null
    const budgetedHrs = Number(client.totalHrsPerMonth ?? 0)
    const hoursUsed   = harvestHrs !== null ? harvestHrs : budgetedHrs
    const cost        = parseFloat((hoursUsed * costRate).toFixed(2))
    const profit      = parseFloat((revenue - cost).toFixed(2))
    const margin      = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : null

    return {
      id:           client.id,
      name:         client.name,
      code,
      projectType:  client.projectType,
      bookkeeper,
      costRate,
      revenue,
      harvestHrs:   harvestHrs !== null ? parseFloat(harvestHrs.toFixed(2)) : null,
      budgetedHrs,
      hoursUsed:    parseFloat(hoursUsed.toFixed(2)),
      cost,
      profit,
      margin,
    }
  })

  // 7. Totals
  const totals = {
    revenue: parseFloat(rows.reduce((s, r) => s + r.revenue, 0).toFixed(2)),
    cost:    parseFloat(rows.reduce((s, r) => s + r.cost,    0).toFixed(2)),
    profit:  parseFloat(rows.reduce((s, r) => s + r.profit,  0).toFixed(2)),
    margin:  null as number | null,
  }
  totals.margin = totals.revenue > 0
    ? parseFloat(((totals.profit / totals.revenue) * 100).toFixed(1))
    : null

  return NextResponse.json({
    rows, totals, harvestConnected, harvestError, from, to,
    _debug: { harvestEntryCount: harvestEntries.length, harvestCodes, clientCodes, harvestDebug }
  })
}
