import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 30 // Vercel max for hobby plan

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(id)
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const from = req.nextUrl.searchParams.get('from')
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const to = req.nextUrl.searchParams.get('to')
    ?? new Date().toISOString().split('T')[0]

  // 1. Clients + employees + settings — all in parallel
  const [clientRes, empRes, settingsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, harvestProjectCode, totalMonthlyAmount, "Bookkeeper", totalHrsPerMonth, projectType')
      .neq('archiveStatus', 'ARCHIVED')
      .order('name'),
    supabase
      .from('employees')
      .select('id, name, effectiveHourlyRate'),
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['harvest_token', 'harvest_account_id']),
  ])

  if (clientRes.error) return NextResponse.json({ error: clientRes.error.message }, { status: 500 })

  const clients   = clientRes.data ?? []
  const employees = empRes.data ?? []
  const settings  = settingsRes.data ?? []

  const empByName: Record<string, number> = {}
  for (const e of employees) empByName[e.name] = Number(e.effectiveHourlyRate) || 0

  const settingsMap: Record<string, string> = {}
  for (const s of settings) settingsMap[s.key] = s.value

  const token     = settingsMap.harvest_token
  const accountId = settingsMap.harvest_account_id

  // 2. Harvest — single page, with timeout
  let harvestEntries: any[] = []
  let harvestConnected = false
  let harvestError: string | null = null

  if (token && accountId) {
    try {
      const res = await fetchWithTimeout(
        `https://api.harvestapp.com/v2/time_entries?from=${from}&to=${to}&per_page=100&page=1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Harvest-Account-Id': accountId,
            'User-Agent': 'BBA-Management-Dashboard',
          },
        },
        8000
      )
      if (!res.ok) {
        const txt = await res.text().catch(() => `HTTP ${res.status}`)
        harvestError = `${res.status}: ${txt.slice(0, 150)}`
      } else {
        const data = await res.json()
        harvestEntries = data.time_entries ?? []
        harvestConnected = true
        // If there are more pages, fetch them too (up to 5 pages = 500 entries)
        let page = 2
        while (data.next_page && page <= 5) {
          const r2 = await fetchWithTimeout(
            `https://api.harvestapp.com/v2/time_entries?from=${from}&to=${to}&per_page=100&page=${page}`,
            { headers: {
              'Authorization': `Bearer ${token}`,
              'Harvest-Account-Id': accountId,
              'User-Agent': 'BBA-Management-Dashboard',
            }},
            5000
          )
          if (!r2.ok) break
          const d2 = await r2.json()
          harvestEntries = harvestEntries.concat(d2.time_entries ?? [])
          if (!d2.next_page) break
          page++
        }
      }
    } catch (e: any) {
      harvestError = e.name === 'AbortError' ? 'Harvest request timed out' : e.message
    }
  } else {
    harvestError = 'Harvest credentials not in settings table'
  }

  // 3. Aggregate hours — by project code AND name as fallback
  const hoursByCode: Record<string, number> = {}
  const hoursByName: Record<string, number> = {}
  for (const entry of harvestEntries) {
    const code = entry.project?.code?.toUpperCase()?.trim()
    const name = entry.project?.name?.toUpperCase()?.trim()
    if (code) hoursByCode[code] = (hoursByCode[code] ?? 0) + (entry.hours ?? 0)
    if (name) hoursByName[name] = (hoursByName[name] ?? 0) + (entry.hours ?? 0)
  }

  // Debug info
  const harvestDebug = harvestEntries.slice(0, 3).map(e => ({
    projectName: e.project?.name,
    projectCode: e.project?.code,
    hours: e.hours,
    date: e.spent_date,
    user: e.user?.name,
  }))
  const harvestCodes = Object.keys(hoursByCode)
  const clientCodes  = clients.map(c => c.harvestProjectCode?.toUpperCase()?.trim())

  // 4. Build rows
  const rows = clients.map(client => {
    const code        = client.harvestProjectCode?.toUpperCase()?.trim() ?? ''
    const revenue     = Number(client.totalMonthlyAmount ?? 0)
    const bookkeeper  = (client as any).Bookkeeper ?? null
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
      id: client.id, name: client.name, code,
      projectType: client.projectType,
      bookkeeper, costRate, revenue,
      harvestHrs: harvestHrs !== null ? parseFloat(harvestHrs.toFixed(2)) : null,
      budgetedHrs,
      hoursUsed: parseFloat(hoursUsed.toFixed(2)),
      cost, profit, margin,
    }
  })

  const totals = {
    revenue: parseFloat(rows.reduce((s, r) => s + r.revenue, 0).toFixed(2)),
    cost:    parseFloat(rows.reduce((s, r) => s + r.cost,    0).toFixed(2)),
    profit:  parseFloat(rows.reduce((s, r) => s + r.profit,  0).toFixed(2)),
    margin:  null as number | null,
  }
  if (totals.revenue > 0) totals.margin = parseFloat(((totals.profit / totals.revenue) * 100).toFixed(1))

  return NextResponse.json({
    rows, totals, harvestConnected, harvestError, from, to,
    _debug: { harvestEntryCount: harvestEntries.length, harvestCodes, clientCodes, harvestDebug },
  })
}
