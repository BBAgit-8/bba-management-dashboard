import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/require-auth'

// Map Harvest task names to internal categories
// Based on the task list exported from Harvest
const TASK_CATEGORY: Record<string, 'bkpr' | 'qa' | 'ye' | 'mgmt'> = {
  // Bkpr Hours
  'Maintenance':                  'bkpr',
  'Hourly Bookkeeping':           'bkpr',
  'Hourly Bookkeeping Support':   'bkpr',
  'Out of Scope':                 'bkpr',
  'Cleanup':                      'bkpr',
  'Cleanup 2022-2023':            'bkpr',
  'Cleanup 2023-2024':            'bkpr',
  'Cleanup 2024':                 'bkpr',
  'Cleanup 2025':                 'bkpr',
  'Catch Up 2024':                'bkpr',
  'Cleanup 9/2024 - 2/2025':     'bkpr',
  'Cleanup 9/2024 - 12/2025':    'bkpr',
  'Cleanup 3/2025 - 8/2025':     'bkpr',
  'Cleanup 1/2025 - 8/2025':     'bkpr',
  'Cleanup 1/2025 - 10/2025':    'bkpr',
  'CleanUp 1/2025 - 4/2026':     'bkpr',
  'Cleanup - Excavation':        'bkpr',
  'Cleanup - Capital':           'bkpr',
  'Cleanup - 3 Blossom':         'bkpr',
  'Cleanup - 13 Washington':     'bkpr',
  'Cleanup - 118 Beech':         'bkpr',
  'Cleanup - 251 Pine':          'bkpr',
  'Cleanup (Jan-Mar 2026)':      'bkpr',
  'A/P':                         'bkpr',
  'AP/AR':                       'bkpr',
  'BNMC Realty NH':              'bkpr',
  'BNMC Realty MA':              'bkpr',
  'Law Tutors':                  'bkpr',
  'Godfrey Maintenance':         'bkpr',
  'Cottman Maintenance':         'bkpr',
  'Godfrey Cleanup':             'bkpr',
  'Cottman Cleanup':             'bkpr',
  'Hourly Billable':             'bkpr',
  'Quarterly Maintenance':       'bkpr',
  // QA
  'QA':                          'qa',
  'Quarterly Review':            'qa',
  // Year-End
  '1099s':                       'ye',
  'YE/1099s':                    'ye',
  'Audit/YE/1099s':              'ye',
  'Audit Support':               'ye',
  // Mgmt
  'Ops':                         'mgmt',
  'Mgmt/CS':                     'mgmt',
}

async function fetchWithTimeout(url: string, options: RequestInit, ms = 8000) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } finally {
    clearTimeout(id)
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  const code = req.nextUrl.searchParams.get('code')
  const from = req.nextUrl.searchParams.get('from')
    ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const to   = req.nextUrl.searchParams.get('to')
    ?? new Date().toISOString().split('T')[0]

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  // Get Harvest credentials
  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['harvest_token', 'harvest_account_id'])

  const map: Record<string, string> = {}
  for (const s of settings ?? []) map[s.key] = s.value
  const token     = map.harvest_token
  const accountId = map.harvest_account_id

  if (!token || !accountId) {
    return NextResponse.json({ error: 'Harvest credentials not configured', connected: false })
  }

  // Fetch time entries for this project code
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Harvest-Account-Id': accountId,
    'User-Agent': 'BBA-Management-Dashboard',
  }

  let entries: any[] = []
  let connected = false
  let errorMsg: string | null = null

  try {
    // First get the project ID by code
    const projRes = await fetchWithTimeout(
      `https://api.harvestapp.com/v2/projects?is_active=true`,
      { headers }, 8000
    )
    if (!projRes.ok) {
      errorMsg = `Harvest ${projRes.status}`
    } else {
      const projData = await projRes.json()
      const project = (projData.projects ?? []).find(
        (p: any) => p.code?.toUpperCase() === code.toUpperCase()
      )

      if (project) {
        // Fetch time entries filtered to this project
        let page = 1
        const totalPages = 20
        while (page <= totalPages) {
          const res = await fetchWithTimeout(
            `https://api.harvestapp.com/v2/time_entries?project_id=${project.id}&from=${from}&to=${to}&per_page=100&page=${page}`,
            { headers }, 8000
          )
          if (!res.ok) break
          const data = await res.json()
          entries = entries.concat(data.time_entries ?? [])
          if (!data.next_page) break
          page++
        }
        connected = true
      } else {
        errorMsg = `No Harvest project found with code "${code}"`
      }
    }
  } catch (e: any) {
    errorMsg = e.name === 'AbortError' ? 'Harvest timed out' : e.message
  }

  // Bucket hours by category
  const hours = { bkpr: 0, qa: 0, ye: 0, mgmt: 0, other: 0, total: 0 }

  for (const entry of entries) {
    const taskName = entry.task?.name ?? ''
    const h = entry.hours ?? 0
    const cat = TASK_CATEGORY[taskName]
    if (cat) {
      hours[cat] += h
    } else {
      hours.other += h
    }
    hours.total += h
  }

  // Round all to 2dp
  for (const k of Object.keys(hours) as (keyof typeof hours)[]) {
    hours[k] = parseFloat(hours[k].toFixed(2))
  }

  return NextResponse.json({ connected, hours, error: errorMsg, from, to, entryCount: entries.length })
}
