import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const bookkeeper = req.nextUrl.searchParams.get('bookkeeper')
  if (!bookkeeper) return NextResponse.json({ error: 'Missing bookkeeper' }, { status: 400 })

  const { data, error } = await supabase
    .from('clients')
    .select(`
      id, name, harvestProjectCode, entityType, processingCadence,
      projectType, archiveStatus, contractStartDate, clientContactName,
      totalHrsPerMonth,
      tags:client_tags(tag:tags(name, color))
    `)
    .eq('Bookkeeper', bookkeeper)
    .neq('archiveStatus', 'ARCHIVED')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clients = (data ?? []).map((c: any) => ({
    ...c,
    tags: (c.tags ?? []).map((ct: any) => ct.tag).filter(Boolean),
  }))

  return NextResponse.json({ clients })
}
