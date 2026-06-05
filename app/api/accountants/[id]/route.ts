import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ACCOUNTANTS } from '@/lib/mock-data'
import type { Accountant, AccountantStatus } from '@/lib/mock-data'

type G = typeof globalThis & { __acctStore?: Accountant[] }
const store = ((globalThis as G).__acctStore ??= ACCOUNTANTS.map(a => ({ ...a })))

type Ctx = { params: Promise<{ id: string }> }

async function dbAvailable(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (prisma as any).accountant?.update === 'function'
}

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const data = (body ?? {}) as Record<string, unknown>

  if (await dbAvailable()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountant = await (prisma as any).accountant.update({
        where: { id },
        data: {
          ...(typeof data.name         === 'string'  ? { name:         data.name.trim() }              : {}),
          ...(typeof data.businessName === 'string'  ? { businessName: data.businessName || null }      : {}),
          ...(typeof data.email        === 'string'  ? { email:        data.email || null }             : {}),
          ...(typeof data.phoneNumber  === 'string'  ? { phoneNumber:  data.phoneNumber  || null }      : {}),
          ...(typeof data.status       === 'string'  ? { status:       data.status }                    : {}),
        },
      })
      return NextResponse.json({ accountant })
    } catch { /* fall through */ }
  }

  const idx = store.findIndex(a => a.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (typeof data.name         === 'string') store[idx].name         = data.name.trim()
  if (typeof data.businessName === 'string') store[idx].businessName = data.businessName || undefined
  if (typeof data.email        === 'string') store[idx].email        = data.email || undefined
  if (typeof data.phoneNumber  === 'string') store[idx].phoneNumber  = data.phoneNumber  || undefined
  if (data.status === 'ACTIVE' || data.status === 'ARCHIVED') {
    store[idx].status = data.status as AccountantStatus
  }
  return NextResponse.json({ accountant: store[idx] })
}

export async function DELETE(_req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const { id } = await params

  if (await dbAvailable()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).accountant.delete({ where: { id } })
      return new NextResponse(null, { status: 204 })
    } catch { /* fall through */ }
  }

  const idx = store.findIndex(a => a.id === id)
  if (idx !== -1) store.splice(idx, 1)
  return new NextResponse(null, { status: 204 })
}
