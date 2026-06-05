import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Tag id is required' }, { status: 400 })

  try {
    await prisma.tag.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
