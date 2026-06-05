import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(): Promise<NextResponse> {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ tags })
  } catch {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, color } = (body ?? {}) as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim())
    return NextResponse.json({ error: '"name" is required' }, { status: 422 })
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))
    return NextResponse.json({ error: '"color" must be a valid hex color (e.g. #4e008e)' }, { status: 422 })

  try {
    const tag = await prisma.tag.create({ data: { name: name.trim(), color } })
    return NextResponse.json({ tag }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: `Tag "${name.trim()}" already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
