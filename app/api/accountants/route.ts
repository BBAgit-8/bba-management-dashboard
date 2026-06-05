/**
 * GET  /api/accountants  — list all accountants
 * POST /api/accountants  — create an accountant
 *
 * Uses an in-process mock store seeded from mock-data until the schema
 * migration is run:
 *   npx prisma migrate dev --name add_accountants
 *   npx prisma generate
 */
import { NextRequest, NextResponse } from 'next/server'
import { ACCOUNTANTS } from '@/lib/mock-data'
import type { Accountant } from '@/lib/mock-data'
import { prisma } from '@/lib/prisma'

type G = typeof globalThis & { __acctStore?: Accountant[] }
const g = globalThis as G
if (!g.__acctStore) g.__acctStore = ACCOUNTANTS.map(a => ({ ...a }))
const store = g.__acctStore

async function dbAvailable(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (prisma as any).accountant?.findMany === 'function'
}

export async function GET(): Promise<NextResponse> {
  if (await dbAvailable()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountants = await (prisma as any).accountant.findMany({
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      })
      return NextResponse.json({ accountants })
    } catch { /* fall through */ }
  }
  return NextResponse.json({ accountants: [...store].sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name)) })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, businessName, email, phoneNumber } = (body ?? {}) as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim())
    return NextResponse.json({ error: '"name" is required' }, { status: 422 })

  if (await dbAvailable()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountant = await (prisma as any).accountant.create({
        data: {
          name:         name.trim(),
          businessName: typeof businessName === 'string' ? businessName.trim() || null : null,
          email:        typeof email        === 'string' ? email.trim()        || null : null,
          phoneNumber:  typeof phoneNumber  === 'string' ? phoneNumber.trim()  || null : null,
          status:       'ACTIVE',
        },
      })
      return NextResponse.json({ accountant }, { status: 201 })
    } catch { /* fall through */ }
  }

  const accountant: Accountant = {
    id:           `ac-${Date.now()}`,
    name:         name.trim(),
    businessName: typeof businessName === 'string' ? businessName.trim() || undefined : undefined,
    email:        typeof email        === 'string' ? email.trim()        || undefined : undefined,
    phoneNumber:  typeof phoneNumber  === 'string' ? phoneNumber.trim()  || undefined : undefined,
    status:       'ACTIVE',
  }
  store.push(accountant)
  return NextResponse.json({ accountant }, { status: 201 })
}
