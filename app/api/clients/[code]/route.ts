import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED: Set<string> = new Set([
  'archiveStatus',
  'projectType', 'revenueType', 'entityType',
  'contractStartDate', 'contractEndDate',
  'guaranteedDeadlineDay',
  'softwareRate', 'totalMonthlyAmount',
  'hasContractedLoom', 'hasScheduledMeetings', 'hasSignedAutoIncrease',
])

// PATCH /api/clients/[code]
// Accepts a partial update object for a client identified by its harvestProjectCode.
// Only fields listed in ALLOWED are accepted; all others are silently dropped.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const raw = (body ?? {}) as Record<string, unknown>
  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (ALLOWED.has(k)) data[k] = v
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 422 })
  }

  // Coerce date strings to proper DateTime for Prisma
  for (const key of ['contractStartDate', 'contractEndDate', 'priceAdjustmentDate']) {
    if (key in data) {
      data[key] = data[key] ? new Date(data[key] as string) : null
    }
  }

  try {
    const client = await prisma.client.update({
      where: { harvestProjectCode: code },
      data,
    })
    return NextResponse.json({ client })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Record to update not found') || msg.includes('does not exist')) {
      return NextResponse.json({ error: `Client "${code}" not found` }, { status: 404 })
    }
    return NextResponse.json({ error: `Database error: ${msg}` }, { status: 500 })
  }
}
