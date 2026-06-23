import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function getHarvestCredentials() {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['harvest_token', 'harvest_account_id'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return { token: map.harvest_token, accountId: map.harvest_account_id }
}

async function harvestFetch(path: string, token: string, accountId: string) {
  const res = await fetch(`https://api.harvestapp.com/v2${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Harvest-Account-Id': accountId,
      'User-Agent': 'BBA-Management-Dashboard',
    },
  })
  if (!res.ok) throw new Error(`Harvest API error: ${res.status}`)
  return res.json()
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const action = req.nextUrl.searchParams.get('action') ?? 'time_entries'

  try {
    const { token, accountId } = await getHarvestCredentials()
    if (!token || !accountId) {
      return NextResponse.json({ error: 'Harvest credentials not configured' }, { status: 400 })
    }

    if (action === 'projects') {
      // Get all active projects
      let projects: any[] = []
      let page = 1
      while (true) {
        const data = await harvestFetch(`/projects?is_active=true&page=${page}&per_page=100`, token, accountId)
        projects = projects.concat(data.projects ?? [])
        if (!data.next_page) break
        page++
      }
      return NextResponse.json({ projects })
    }

    if (action === 'time_entries') {
      // Get time entries for current month by default
      const from = req.nextUrl.searchParams.get('from')
        ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const to = req.nextUrl.searchParams.get('to')
        ?? new Date().toISOString().split('T')[0]

      let entries: any[] = []
      let page = 1
      while (true) {
        const data = await harvestFetch(
          `/time_entries?from=${from}&to=${to}&page=${page}&per_page=100`,
          token, accountId
        )
        entries = entries.concat(data.time_entries ?? [])
        if (!data.next_page) break
        page++
      }
      return NextResponse.json({ entries, from, to })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
