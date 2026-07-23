import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

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
  const gate = await requireAuth(req); if (gate) return gate;

  const from = req.nextUrl.searchParams.get('from')
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const to = req.nextUrl.searchParams.get('to')
    ?? new Date().toISOString().split('T')[0]

  // 1. Clients + employees + settings — all in parallel
  const [clientRes, empRes, settingsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, harvestProjectCode, totalMonthlyAmount, bookkeepingRate, softwareRate, "Bookkeeper", totalHrsPerMonth, projectType, revenueType, revType, qboOnly')
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

  // QBO-only clients don't generate bookkeeping revenue — exclude them from profitability entirely.
  // CLEANUP and HOURLY_CLEANUP are INCLUDED — they show as their own rows with real revenue.
  // FREE clients are also INCLUDED but their revenue is treated as $0 (see revenue calc below).
  //
  // Match the same rules the capacity page uses so a QBO-only client can't
  // slip through by having its markers on some fields but not others.
  const QBO_PROJECT_TYPES = new Set(['QBO_ONLY', 'QBO'])
  const QBO_REVENUE_TYPES = new Set(['QBO_ONLY_ANCHOR', 'QBO_ONLY_QBO', 'QBO_ONLY_QB'])
  const isQboOnly = (c: any) =>
    c.qboOnly === true
    || QBO_PROJECT_TYPES.has(c.projectType)
    || QBO_REVENUE_TYPES.has(c.revenueType)
    || QBO_REVENUE_TYPES.has(c.revType)
  const clients   = (clientRes.data ?? []).filter((c: any) => !isQboOnly(c))
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
        // Fetch all remaining pages
        const totalPages = data.total_pages ?? 1
        for (let page = 2; page <= Math.min(totalPages, 20); page++) {
          const r = await fetchWithTimeout(
            `https://api.harvestapp.com/v2/time_entries?from=${from}&to=${to}&per_page=100&page=${page}`,
            { headers: {
              'Authorization': `Bearer ${token}`,
              'Harvest-Account-Id': accountId,
              'User-Agent': 'BBA-Management-Dashboard',
            }},
            5000
          )
          if (!r.ok) break
          const d = await r.json()
          harvestEntries = harvestEntries.concat(d.time_entries ?? [])
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

  // 4. Build rows
  const rows = clients.map(client => {
    const code        = client.harvestProjectCode?.toUpperCase()?.trim() ?? ''
    const revenueType = (client as any).revenueType ?? null
    const isFree      = revenueType === 'FREE'
    const bookkeepingRate = Number((client as any).bookkeepingRate ?? 0)
    const softwareRate    = Number((client as any).softwareRate    ?? 0)
    // Revenue for profitability = bookkeepingRate only
    // Fall back to totalMonthlyAmount minus softwareRate if bookkeepingRate not set
    // FREE clients: revenue forced to $0 (donation / comped clients — still track hours & cost)
    const savedTotal = Number((client as any).totalMonthlyAmount ?? 0)
    const revenue = isFree ? 0 : (bookkeepingRate > 0
      ? bookkeepingRate
      : savedTotal > 0
        ? Math.max(savedTotal - softwareRate, savedTotal)  // use total if bk rate not set
        : 0)
    const totalMonthly = bookkeepingRate > 0 || softwareRate > 0
      ? bookkeepingRate + softwareRate
      : savedTotal
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
      revenueType,
      bookkeeper, costRate, revenue,
      totalMonthly,
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

  return NextResponse.json({ rows, totals, harvestConnected, harvestError, from, to })
}
