import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, "Bookkeeper"')
    .eq('email', email)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  return NextResponse.json({ id: data.id, name: data.name, bookkeeper: data.Bookkeeper })
}
