/**
 * POST /api/clients/logs
 *
 * Accepts raw call notes + projectCode, runs Anthropic extraction,
 * saves the structured summary to CallLog table, and returns the saved record.
 *
 * GET /api/clients/logs?projectCode=xxx
 *
 * Returns all call logs for a client in reverse-chronological order.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `\
You are an expert accounting firm client success specialist.
Analyse raw call notes and return a clean, structured markdown summary.

Format your response as follows (use markdown):

**Client Mood:** [Very Positive | Positive | Neutral | Concerned | Negative]

**Project Blockers:**
- [list each blocker, or "None identified" if none]

**New Scoping Opportunities:**
- [list each opportunity, or "None identified" if none]

**Deadline Changes:**
- [list each change with item and new deadline, or "None mentioned" if none]

**Key Action Items:**
- [list each action item with owner if mentioned]

Be specific and concise. Use only information explicitly stated in the notes.`

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const projectCode = req.nextUrl.searchParams.get('projectCode')
  if (!projectCode) {
    return NextResponse.json({ error: '"projectCode" query param is required' }, { status: 400 })
  }

  try {
    const client = await prisma.client.findUnique({
      where:   { harvestProjectCode: projectCode },
      include: { callLogs: { orderBy: { callDate: 'desc' } } },
    })

    if (!client) {
      return NextResponse.json({ error: `No client found for projectCode "${projectCode}"` }, { status: 404 })
    }

    return NextResponse.json({ logs: client.callLogs })
  } catch (err) {
    console.error('[call-logs GET]', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { projectCode, rawNotes } = (body ?? {}) as Record<string, unknown>

  if (typeof projectCode !== 'string' || !projectCode.trim()) {
    return NextResponse.json({ error: '"projectCode" is required' }, { status: 422 })
  }
  if (typeof rawNotes !== 'string' || rawNotes.trim().length < 10) {
    return NextResponse.json({ error: '"rawNotes" must be at least 10 characters' }, { status: 422 })
  }

  // Look up client
  const client = await prisma.client.findUnique({ where: { harvestProjectCode: projectCode } })
  if (!client) {
    return NextResponse.json({ error: `No client found for projectCode "${projectCode}"` }, { status: 404 })
  }

  // Generate AI summary (graceful degradation if key missing)
  let summary = rawNotes.trim()
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.messages.create({
        model:      'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages:   [{ role: 'user', content: `Please summarise these call notes:\n\n${rawNotes.trim()}` }],
      })
      const textBlock = response.content.find(b => b.type === 'text')
      if (textBlock && textBlock.type === 'text') summary = textBlock.text
    } catch (err) {
      console.warn('[call-logs] Anthropic call failed, saving raw notes:', err)
    }
  }

  // Save to database
  try {
    const saved = await prisma.callLog.create({
      data: {
        clientId: client.id,
        callDate: new Date(),
        summary,
        rawNotes: rawNotes.trim(),
      },
    })

    return NextResponse.json({ log: saved }, { status: 201 })
  } catch (err) {
    console.error('[call-logs POST] DB error:', err)
    return NextResponse.json({ error: 'Failed to save call log' }, { status: 500 })
  }
}
