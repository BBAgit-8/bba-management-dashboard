import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_CATEGORIES = ['projectType', 'revenueType', 'cadence', 'clientStatus'] as const
const HEX_RE = /^#[0-9a-fA-F]{6}$/

// ── GET /api/pill-themes ──────────────────────────────────────────────────────
// Returns all saved pill theme overrides ordered by category → key.
// Returns an empty array (not an error) when the table does not yet exist.

export async function GET(): Promise<NextResponse> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const themes = await (prisma as any).pillTheme.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })
    return NextResponse.json({ themes })
  } catch {
    return NextResponse.json({ themes: [] })
  }
}

// ── PUT /api/pill-themes ──────────────────────────────────────────────────────
// Upserts the full theme payload.  Every entry in the array is validated then
// upserted (insert-or-update) so callers can send the complete set without
// worrying about create vs update logic.

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const { themes } = (body ?? {}) as Record<string, unknown>
  if (!Array.isArray(themes) || themes.length === 0) {
    return NextResponse.json({ error: '"themes" must be a non-empty array' }, { status: 422 })
  }

  for (const raw of themes) {
    const t = raw as Record<string, unknown>
    if (!VALID_CATEGORIES.includes(t.category as typeof VALID_CATEGORIES[number])) {
      return NextResponse.json({ error: `Invalid category "${t.category}"` }, { status: 422 })
    }
    if (typeof t.key !== 'string' || !t.key.trim()) {
      return NextResponse.json({ error: '"key" is required' }, { status: 422 })
    }
    if (typeof t.label !== 'string' || !t.label.trim()) {
      return NextResponse.json({ error: '"label" is required' }, { status: 422 })
    }
    if (typeof t.color !== 'string' || !HEX_RE.test(t.color)) {
      return NextResponse.json({ error: `"color" must be a 6-digit hex color (e.g. #4e008e), got "${t.color}"` }, { status: 422 })
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any).pillTheme
    const saved = await Promise.all(
      (themes as Array<{ category: string; key: string; label: string; color: string }>).map(t =>
        model.upsert({
          where:  { category_key: { category: t.category, key: t.key } },
          update: { label: t.label.trim(), color: t.color },
          create: { category: t.category, key: t.key.trim(), label: t.label.trim(), color: t.color },
        })
      )
    )
    return NextResponse.json({ saved: saved.length, themes: saved })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Database error: ${msg}` }, { status: 500 })
  }
}
