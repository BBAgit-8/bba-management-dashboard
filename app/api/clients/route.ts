/**
 * GET  /api/clients  — list all clients with tags and SOWs
 * POST /api/clients  — create a new client
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' },
      include: {
        tags: {
          include: { tag: true },
        },
        sows: {
          select: {
            billingType: true,
            fixedMonthlyRate: true,
            billingRate: true,
          },
        },
      },
    })

    // Flatten tags from join table shape → { id, name, color }[]
    const shaped = clients.map(c => ({
      ...c,
      tags: c.tags.map(ct => ({
        id:    ct.tag.id,
        name:  ct.tag.name,
        color: ct.tag.color,
      })),
      sows: c.sows.map(s => ({
        billingType:      s.billingType,
        fixedMonthlyRate: s.fixedMonthlyRate ? Number(s.fixedMonthlyRate) : null,
        billingRate:      s.billingRate      ? Number(s.billingRate)      : null,
      })),
    }))

    return NextResponse.json({ clients: shaped })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/clients]', msg)
    return NextResponse.json({ error: 'Database error', detail: msg }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const data = (body ?? {}) as Record<string, unknown>

  // Required fields
  const name               = typeof data.name               === 'string' ? data.name.trim()               : ''
  const harvestProjectCode = typeof data.harvestProjectCode === 'string' ? data.harvestProjectCode.trim() : ''

  if (!name)               return NextResponse.json({ error: '"name" is required' },               { status: 422 })
  if (!harvestProjectCode) return NextResponse.json({ error: '"harvestProjectCode" is required' }, { status: 422 })

  // Optional scalars
  const accountantName           = typeof data.accountantName           === 'string'  ? data.accountantName.trim()  || null : null
  const entityType               = typeof data.entityType               === 'string'  ? data.entityType              : 'LLC'
  const einNumber                = typeof data.einNumber                === 'string'  ? data.einNumber.trim()        || null : null
  const officeType               = typeof data.officeType               === 'string'  ? data.officeType              : 'HOME_OFFICE'
  const processingCadence        = typeof data.processingCadence        === 'string'  ? data.processingCadence       : 'MONTHLY'
  const projectType              = typeof data.projectType              === 'string'  ? data.projectType             : 'MONTHLY_MAINTENANCE'
  const referredBy               = typeof data.referredBy               === 'string'  ? data.referredBy.trim()       || null : null
  const payrollProvider          = typeof data.payrollProvider          === 'string'  ? data.payrollProvider.trim()  || null : null
  const hasPayroll               = data.hasPayroll               === true
  const okToContactAccountant    = data.okToContactAccountant    === true
  const qboOnly                  = data.qboOnly                  === true
  const guaranteedDeadlineDay    = typeof data.guaranteedDeadlineDay    === 'string' && data.guaranteedDeadlineDay
                                     ? parseInt(data.guaranteedDeadlineDay, 10) || null
                                     : typeof data.guaranteedDeadlineDay === 'number' ? data.guaranteedDeadlineDay : null
  const autoPriceIncreasePercent = typeof data.autoPriceIncreasePercent === 'string' && data.autoPriceIncreasePercent
                                     ? parseFloat(data.autoPriceIncreasePercent) || null
                                     : null
  const contractStartDate        = typeof data.contractStartDate        === 'string' && data.contractStartDate
                                     ? new Date(data.contractStartDate) : null
  const priceAdjustmentDate      = typeof data.priceAdjustmentDate      === 'string' && data.priceAdjustmentDate
                                     ? new Date(data.priceAdjustmentDate) : null

  // Tags — array of tag IDs to connect
  const tagIds: string[] = Array.isArray(data.selectedTags) ? (data.selectedTags as string[]) : []

  try {
    const client = await prisma.client.create({
      data: {
        name,
        harvestProjectCode,
        accountantName,
        entityType:               entityType               as never,
        einNumber,
        officeType:               officeType               as never,
        processingCadence:        processingCadence        as never,
        projectType:              projectType              as never,
        referredBy,
        payrollProvider,
        hasPayroll,
        okToContactAccountant,
        qboOnly,
        guaranteedDeadlineDay,
        autoPriceIncreasePercent,
        contractStartDate,
        priceAdjustmentDate,
        tags: tagIds.length > 0
          ? { create: tagIds.map(tagId => ({ tagId, assignedAt: new Date() })) }
          : undefined,
      },
      include: {
        tags: { include: { tag: true } },
        sows: true,
      },
    })

    const shaped = {
      ...client,
      tags: client.tags.map(ct => ({ id: ct.tag.id, name: ct.tag.name, color: ct.tag.color })),
    }

    return NextResponse.json({ client: shaped }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/clients]', msg)
    if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
      return NextResponse.json({ error: `Project code "${harvestProjectCode}" already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: 'Database error', detail: msg }, { status: 500 })
  }
}
