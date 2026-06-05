/**
 * POST /api/clients/archive
 *
 * Offboarding pipeline for a single client.  Execution order:
 *   1. Safety gate  — rejects any request that does not pass `confirmation: "CONFIRM"`
 *   2. Data export  — fetches all related DB rows and compiles a Markdown document
 *   3. Drive upload — posts the document to the team's Google Drive folder
 *   4. Anchor       — terminates the master billing agreement
 *   5. Harvest      — sets the project to inactive / archived
 *   6. ClickUp      — archives the client folder, hiding it from active views
 *   7. DB purge     — cascades-deletes the client and all linked rows ONLY if every
 *                     non-skipped stage above completed successfully
 *
 * SECURITY: Every external token is accessed exclusively through `process.env`.
 * None of these variables carry the NEXT_PUBLIC_ prefix, so they are never
 * bundled into or exposed through client-side JavaScript.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

interface ArchiveRequest {
  /** Must equal the string "CONFIRM" — double-confirmation safeguard. */
  confirmation: string
  /** Our internal project code, e.g. "THRN-001". */
  projectCode: string
  /** Anchor agreement ID whose billing should be terminated. */
  anchorAgreementId?: string
  /** ClickUp folder ID associated with this client's workspace. */
  clickUpFolderId?: string
  /**
   * Harvest's internal numeric project ID.
   * Supplying it avoids an extra GET /v2/projects lookup.
   */
  harvestProjectId?: number
}

type StageStatus = 'success' | 'failed' | 'skipped'

interface StageResult {
  stage:   string
  status:  StageStatus
  detail?: string
  error?:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// Database fetch
// ─────────────────────────────────────────────────────────────────────────────

async function fetchClientWithRelations(projectCode: string) {
  return prisma.client.findUnique({
    where:   { harvestProjectCode: projectCode },
    include: {
      sows:          true,
      subscriptions: true,
      timeLogs: {
        include:  { employee: true },
        orderBy:  { logDate: 'asc' },
      },
      callLogs: {
        orderBy: { callDate: 'desc' },
      },
      tags: {
        include: { tag: true },
      },
    },
  })
}

type ClientRecord = NonNullable<Awaited<ReturnType<typeof fetchClientWithRelations>>>

// ─────────────────────────────────────────────────────────────────────────────
// Typed view of the Prisma record
// (Prisma's generated client files use @ts-nocheck, so their return types
//  propagate as `any` under strict mode.  These interfaces let us cast once
//  at the function boundary and keep every callback fully typed.)
// ─────────────────────────────────────────────────────────────────────────────

interface ATimeLog {
  hoursLogged: unknown
  logDate:     unknown
  notes:       string | null
  employee:    { name: string } | null
}
interface ASOW {
  billingType:      string
  fixedMonthlyRate: unknown
  targetHours:      unknown
  expectedHours:    unknown
  billingRate:      unknown
  isRefined:        boolean
  createdAt:        Date
}
interface ASub {
  softwareName:   string
  tier:           string | null
  ourCost:        unknown
  clientPrice:    unknown
  billingCadence: string
}
interface ACallLog {
  callDate: unknown
  summary:  string
}
interface ATag {
  tag: { name: string }
}
interface AClient {
  id:                       string
  name:                     string
  harvestProjectCode:       string
  autoPriceIncreasePercent: unknown
  priceAdjustmentDate:      Date | null
  accountantName:           string | null
  guaranteedDeadlineDay:    number | null
  processingCadence:        string
  archiveStatus:            string
  createdAt:                Date
  sows:          ASOW[]
  subscriptions: ASub[]
  timeLogs:      ATimeLog[]
  callLogs:      ACallLog[]
  tags:          ATag[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown export builder
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(d: unknown): string {
  if (!d) return '—'
  return new Date(d as string | Date).toISOString().split('T')[0]
}

function fmtNum(v: unknown, decimals = 2): string {
  const n = Number(v)
  return isNaN(n) ? '—' : n.toFixed(decimals)
}

function fmtMoney(v: unknown): string {
  const n = Number(v)
  return isNaN(n) ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildMarkdown(record: AClient, exportedAt: Date): string {
  const totalHours  = record.timeLogs.reduce((s, l) => s + Number(l.hoursLogged), 0)
  const totalSubCost  = record.subscriptions.filter(s => s.billingCadence === 'MONTHLY').reduce((s, sub) => s + Number(sub.ourCost), 0)
  const totalSubRev   = record.subscriptions.filter(s => s.billingCadence === 'MONTHLY').reduce((s, sub) => s + Number(sub.clientPrice), 0)
  const subMargin     = totalSubRev - totalSubCost

  const lines: string[] = []

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`# 📦 Client Archive Export`)
  lines.push(`## ${record.name} — \`${record.harvestProjectCode}\``)
  lines.push(``)
  lines.push(`> **Export Date:** ${fmtDate(exportedAt)} | **Source:** Management Hub v1.0  `)
  lines.push(`> This document was compiled automatically during the client offboarding pipeline.`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // ── Client profile ───────────────────────────────────────────────────────
  lines.push(`## 📋 Client Profile`)
  lines.push(``)
  lines.push(`| Field | Value |`)
  lines.push(`|-------|-------|`)
  lines.push(`| Client Name | ${record.name} |`)
  lines.push(`| Project Code | \`${record.harvestProjectCode}\` |`)
  lines.push(`| Accountant | ${record.accountantName ?? '—'} |`)
  lines.push(`| Processing Cadence | ${record.processingCadence} |`)
  lines.push(`| Auto Price Increase | ${record.autoPriceIncreasePercent != null ? `${fmtNum(record.autoPriceIncreasePercent, 1)}%` : '—'} |`)
  lines.push(`| Price Adjustment Date | ${fmtDate(record.priceAdjustmentDate)} |`)
  lines.push(`| Guaranteed Deadline Day | ${record.guaranteedDeadlineDay != null ? `Day ${record.guaranteedDeadlineDay}` : '—'} |`)
  lines.push(`| Archive Status | ${record.archiveStatus} → **ARCHIVED** |`)
  lines.push(`| Client Since | ${fmtDate(record.createdAt)} |`)

  if (record.tags.length > 0) {
    lines.push(`| Tags | ${record.tags.map(t => t.tag.name).join(', ')} |`)
  }

  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  // ── SOWs ────────────────────────────────────────────────────────────────
  lines.push(`## 🏦 Statements of Work (${record.sows.length})`)
  lines.push(``)

  if (record.sows.length === 0) {
    lines.push(`*No SOWs on record.*`)
    lines.push(``)
  } else {
    record.sows.forEach((sow, i) => {
      lines.push(`### SOW #${i + 1} — ${sow.billingType === 'FLAT' ? 'Flat Rate' : 'Hourly'}`)
      lines.push(``)
      lines.push(`| Field | Value |`)
      lines.push(`|-------|-------|`)
      lines.push(`| Billing Type | ${sow.billingType} |`)
      if (sow.billingType === 'FLAT' && sow.fixedMonthlyRate != null) {
        lines.push(`| Fixed Monthly Rate | ${fmtMoney(sow.fixedMonthlyRate)} |`)
      }
      if (sow.billingType === 'HOURLY' && sow.billingRate != null) {
        lines.push(`| Hourly Billing Rate | ${fmtMoney(sow.billingRate)}/hr |`)
      }
      lines.push(`| Target Hours | ${sow.targetHours != null ? `${fmtNum(sow.targetHours, 1)} hrs` : '—'} |`)
      lines.push(`| Expected Hours | ${sow.expectedHours != null ? `${fmtNum(sow.expectedHours, 1)} hrs` : '—'} |`)
      lines.push(`| Refined | ${sow.isRefined ? '✅ Yes' : '⚠️ No (Estimated)'} |`)
      lines.push(`| Created | ${fmtDate(sow.createdAt)} |`)
      lines.push(``)
    })
  }

  lines.push(`---`)
  lines.push(``)

  // ── Time logs ────────────────────────────────────────────────────────────
  lines.push(`## ⏱️ Time Logs (${record.timeLogs.length} entries — ${fmtNum(totalHours, 1)} total hours)`)
  lines.push(``)

  if (record.timeLogs.length === 0) {
    lines.push(`*No time logs recorded.*`)
    lines.push(``)
  } else {
    lines.push(`| Date | Employee | Hours | Notes |`)
    lines.push(`|------|----------|------:|-------|`)
    record.timeLogs.forEach(log => {
      const notes = log.notes ? log.notes.replace(/\|/g, '\\|').slice(0, 80) : '—'
      lines.push(`| ${fmtDate(log.logDate)} | ${log.employee?.name ?? 'Unknown'} | ${fmtNum(log.hoursLogged, 2)} | ${notes} |`)
    })
    lines.push(``)

    // Per-employee summary
    const byEmployee: Record<string, number> = {}
    record.timeLogs.forEach(l => {
      const name = l.employee?.name ?? 'Unknown'
      byEmployee[name] = (byEmployee[name] ?? 0) + Number(l.hoursLogged)
    })
    lines.push(`**Employee Summary**`)
    lines.push(``)
    lines.push(`| Employee | Total Hours |`)
    lines.push(`|----------|------------:|`)
    Object.entries(byEmployee).forEach(([name, hrs]) => {
      lines.push(`| ${name} | ${fmtNum(hrs, 1)} |`)
    })
    lines.push(`| **Total** | **${fmtNum(totalHours, 1)}** |`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)

  // ── Call logs ────────────────────────────────────────────────────────────
  lines.push(`## 📞 Call Logs & AI Summaries (${record.callLogs.length} entries)`)
  lines.push(``)

  if (record.callLogs.length === 0) {
    lines.push(`*No call logs recorded.*`)
    lines.push(``)
  } else {
    record.callLogs.forEach(log => {
      lines.push(`### Call — ${fmtDate(log.callDate)}`)
      lines.push(``)
      lines.push(log.summary)
      lines.push(``)
    })
  }

  lines.push(`---`)
  lines.push(``)

  // ── Subscriptions ────────────────────────────────────────────────────────
  lines.push(`## 💻 Software Subscriptions (${record.subscriptions.length} active)`)
  lines.push(``)

  if (record.subscriptions.length === 0) {
    lines.push(`*No software subscriptions on record.*`)
    lines.push(``)
  } else {
    lines.push(`| Software | Tier | Our Cost | Client Price | Margin | Cadence |`)
    lines.push(`|----------|------|:--------:|:------------:|:------:|---------|`)
    record.subscriptions.forEach(sub => {
      const margin = Number(sub.clientPrice) - Number(sub.ourCost)
      lines.push(`| ${sub.softwareName} | ${sub.tier ?? '—'} | ${fmtMoney(sub.ourCost)} | ${fmtMoney(sub.clientPrice)} | +${fmtMoney(margin)} | ${sub.billingCadence} |`)
    })
    lines.push(``)
    lines.push(`**Monthly Totals** — Our Cost: ${fmtMoney(totalSubCost)} | Client Revenue: ${fmtMoney(totalSubRev)} | Net Margin: **+${fmtMoney(subMargin)}**`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)

  // ── Footer ───────────────────────────────────────────────────────────────
  lines.push(`*Archive compiled by Management Hub · ${exportedAt.toISOString()} UTC*  `)
  lines.push(`*All records for client \`${record.harvestProjectCode}\` have been permanently removed from the live database.*`)

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Accountant auto-archive hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * After a client is purged, check whether their assigned accountant still has
 * any other ACTIVE clients.  If not, automatically set the accountant's status
 * to ARCHIVED so they no longer appear in dropdown menus.
 *
 * This runs as a best-effort step — failure never blocks the main pipeline
 * response; it is surfaced as an extra stage in the result summary.
 */
async function checkAndAutoArchiveAccountant(accountantName: string): Promise<StageResult> {
  try {
    // Count remaining active clients (this client was already deleted above)
    const remainingCount = await prisma.client.count({
      where: { accountantName, archiveStatus: 'ACTIVE' },
    })

    if (remainingCount > 0) {
      return {
        stage:  'Accountant Status Check',
        status: 'skipped',
        detail: `${accountantName} still has ${remainingCount} active client(s) — accountant remains ACTIVE.`,
      }
    }

    // Zero remaining active clients → auto-archive
    let updated = false

    // Try Prisma model (available after migration + generate)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any).accountant
      if (typeof model?.updateMany === 'function') {
        const result = await model.updateMany({
          where: { name: accountantName, status: 'ACTIVE' },
          data:  { status: 'ARCHIVED' },
        })
        updated = result.count > 0
      }
    } catch { /* fall through to in-memory store */ }

    // Update in-memory fallback store (dev / pre-migration)
    type G = typeof globalThis & { __acctStore?: Array<{ name: string; status: string }> }
    const memStore = (globalThis as G).__acctStore
    if (memStore) {
      memStore.forEach(a => {
        if (a.name === accountantName && a.status === 'ACTIVE') {
          a.status = 'ARCHIVED'
          updated = true
        }
      })
    }

    return {
      stage:  'Accountant Auto-Archive',
      status: updated ? 'success' : 'skipped',
      detail: updated
        ? `${accountantName} automatically archived — no remaining active clients.`
        : `${accountantName} not found in accountant records (manual archive may be needed).`,
    }
  } catch (err) {
    return {
      stage:  'Accountant Auto-Archive',
      status: 'failed',
      error:  err instanceof Error ? err.message : String(err),
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage helpers
// ─────────────────────────────────────────────────────────────────────────────

// ── Stage 1: Google Drive upload ────────────────────────────────────────────

async function uploadToGoogleDrive(
  filename:  string,
  content:   string,
  folderId?: string,
): Promise<StageResult & { fileId?: string; webViewLink?: string }> {
  const token      = process.env.GOOGLE_DRIVE_ACCESS_TOKEN
  const teamFolder = folderId ?? process.env.GOOGLE_DRIVE_TEAM_FOLDER_ID

  if (!token) {
    return { stage: 'Google Drive Upload', status: 'skipped', detail: 'GOOGLE_DRIVE_ACCESS_TOKEN not configured' }
  }

  const boundary  = `mgmt_dash_boundary_${Date.now()}`
  const metadata  = JSON.stringify({
    name:     filename,
    mimeType: 'text/markdown',
    ...(teamFolder ? { parents: [teamFolder] } : {}),
  })

  // Multipart/related upload — metadata part + content part
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/markdown; charset=UTF-8',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n')

  try {
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body,
      },
    )

    if (!res.ok) {
      const text = await res.text()
      return { stage: 'Google Drive Upload', status: 'failed', error: `Drive API ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = (await res.json()) as { id: string; name: string; webViewLink?: string }
    return {
      stage:       'Google Drive Upload',
      status:      'success',
      detail:      `Uploaded "${data.name}" (id: ${data.id})`,
      fileId:      data.id,
      webViewLink: data.webViewLink,
    }
  } catch (err) {
    return { stage: 'Google Drive Upload', status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Stage 2: Anchor billing termination ─────────────────────────────────────

async function terminateAnchorAgreement(agreementId?: string): Promise<StageResult> {
  const apiKey = process.env.ANCHOR_API_KEY

  if (!apiKey) {
    return { stage: 'Anchor Billing', status: 'skipped', detail: 'ANCHOR_API_KEY not configured' }
  }
  if (!agreementId) {
    return { stage: 'Anchor Billing', status: 'skipped', detail: 'anchorAgreementId not provided in request' }
  }

  try {
    const res = await fetch(
      `https://app.useanchor.com/api/v1/agreements/${agreementId}/terminate`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        // Reason is surfaced to the client in Anchor's notification email.
        body: JSON.stringify({ reason: 'Client offboarding — agreement closed by account manager.' }),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      return { stage: 'Anchor Billing', status: 'failed', error: `Anchor API ${res.status}: ${text.slice(0, 200)}` }
    }

    return { stage: 'Anchor Billing', status: 'success', detail: `Agreement ${agreementId} terminated — future invoices halted.` }
  } catch (err) {
    return { stage: 'Anchor Billing', status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Stage 3: Harvest project archive ────────────────────────────────────────

async function archiveHarvestProject(
  projectCode:      string,
  harvestProjectId?: number,
): Promise<StageResult> {
  const accountId   = process.env.HARVEST_ACCOUNT_ID
  const accessToken = process.env.HARVEST_ACCESS_TOKEN

  if (!accountId || !accessToken) {
    return { stage: 'Harvest Archive', status: 'skipped', detail: 'HARVEST_ACCOUNT_ID or HARVEST_ACCESS_TOKEN not configured' }
  }

  const headers: Record<string, string> = {
    Authorization:        `Bearer ${accessToken}`,
    'Harvest-Account-Id': accountId,
    'User-Agent':         'ManagementDashboard/1.0',
    'Content-Type':       'application/json',
  }

  try {
    let projectId = harvestProjectId

    // Look up the project by code if the internal ID was not supplied.
    if (!projectId) {
      const listRes = await fetch('https://api.harvestapp.com/v2/projects?is_active=true', { headers })
      if (!listRes.ok) {
        return { stage: 'Harvest Archive', status: 'failed', error: `Harvest /v2/projects: ${listRes.status}` }
      }
      const { projects } = (await listRes.json()) as { projects: Array<{ id: number; code: string }> }
      const found = projects.find(p => p.code === projectCode)
      if (!found) {
        return { stage: 'Harvest Archive', status: 'skipped', detail: `No active Harvest project found with code "${projectCode}"` }
      }
      projectId = found.id
    }

    // Set the project to inactive — Harvest's equivalent of archiving.
    const patchRes = await fetch(
      `https://api.harvestapp.com/v2/projects/${projectId}`,
      {
        method:  'PATCH',
        headers,
        body:    JSON.stringify({ is_active: false }),
      },
    )

    if (!patchRes.ok) {
      return { stage: 'Harvest Archive', status: 'failed', error: `Harvest PATCH project ${patchRes.status}` }
    }

    return { stage: 'Harvest Archive', status: 'success', detail: `Project ${projectId} (${projectCode}) set to inactive.` }
  } catch (err) {
    return { stage: 'Harvest Archive', status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Stage 4: ClickUp folder archive ─────────────────────────────────────────

async function archiveClickUpFolder(folderId?: string): Promise<StageResult> {
  const token = process.env.CLICKUP_API_TOKEN

  if (!token) {
    return { stage: 'ClickUp Archive', status: 'skipped', detail: 'CLICKUP_API_TOKEN not configured' }
  }
  if (!folderId) {
    return { stage: 'ClickUp Archive', status: 'skipped', detail: 'clickUpFolderId not provided in request' }
  }

  const headers: Record<string, string> = {
    Authorization:  token,
    'Content-Type': 'application/json',
  }

  try {
    // ClickUp v3 archive endpoint — hides the folder from all active views.
    const res = await fetch(
      `https://api.clickup.com/api/v3/folder/${folderId}/archive`,
      { method: 'POST', headers },
    )

    if (!res.ok) {
      // Graceful fallback: rename the folder to indicate archived status
      // (used when the target workspace runs ClickUp API v2 without archive support).
      const folderRes = await fetch(`https://api.clickup.com/api/v2/folder/${folderId}`, { headers })
      const folderData = folderRes.ok ? (await folderRes.json() as { name?: string }) : { name: 'Client' }
      const currentName = folderData.name ?? 'Client'

      const renameRes = await fetch(
        `https://api.clickup.com/api/v2/folder/${folderId}`,
        {
          method:  'PUT',
          headers,
          body:    JSON.stringify({ name: `[ARCHIVED] ${currentName}` }),
        },
      )

      if (!renameRes.ok) {
        return { stage: 'ClickUp Archive', status: 'failed', error: `ClickUp archive and fallback rename both failed (${res.status} / ${renameRes.status})` }
      }

      return { stage: 'ClickUp Archive', status: 'success', detail: `Folder renamed to "[ARCHIVED] ${currentName}" (v2 fallback).` }
    }

    return { stage: 'ClickUp Archive', status: 'success', detail: `Folder ${folderId} archived via v3 API.` }
  } catch (err) {
    return { stage: 'ClickUp Archive', status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateRequest(body: unknown): { valid: true; data: ArchiveRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Body must be a JSON object' }
  const b = body as Record<string, unknown>

  // ── Safety gate ─────────────────────────────────────────────────────────
  if (b.confirmation !== 'CONFIRM') {
    return {
      valid: false,
      error: 'Double-confirmation failed. Send { "confirmation": "CONFIRM" } to proceed. This safeguard prevents accidental data loss.',
    }
  }

  if (typeof b.projectCode !== 'string' || !b.projectCode.trim()) {
    return { valid: false, error: '"projectCode" is required (e.g. "THRN-001")' }
  }

  return { valid: true, data: b as unknown as ArchiveRequest }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/clients/archive
 *
 * Triggers the full offboarding pipeline for a single client.
 * The database purge step runs ONLY when all non-skipped stages above it succeed.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Parse ──────────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }

  const validation = validateRequest(rawBody)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: validation.error.includes('CONFIRM') ? 403 : 422 })
  }

  const { projectCode, anchorAgreementId, clickUpFolderId, harvestProjectId } = validation.data

  // ── Fetch full client record ────────────────────────────────────────────
  const record = (await fetchClientWithRelations(projectCode)) as AClient | null
  if (!record) {
    return NextResponse.json(
      { error: `No client found with projectCode "${projectCode}"` },
      { status: 404 },
    )
  }

  const exportedAt = new Date()
  const filename   = `${record.name.replace(/[^a-zA-Z0-9]/g, '_')}_${projectCode}_Archive_${fmtDate(exportedAt)}.md`
  const markdown   = buildMarkdown(record, exportedAt)

  // ── Run pipeline stages ─────────────────────────────────────────────────
  // Stages 1–4 run in parallel since they are independent of each other.
  const [driveResult, anchorResult, harvestResult, clickUpResult] = await Promise.all([
    uploadToGoogleDrive(filename, markdown),
    terminateAnchorAgreement(anchorAgreementId),
    archiveHarvestProject(projectCode, harvestProjectId),
    archiveClickUpFolder(clickUpFolderId),
  ])

  const externalStages: StageResult[] = [driveResult, anchorResult, harvestResult, clickUpResult]

  // A "failed" stage (not skipped) blocks the database purge.
  const blockingFailure = externalStages.find(s => s.status === 'failed')

  // ── Database purge ─────────────────────────────────────────────────────
  let purgeResult: StageResult

  if (blockingFailure) {
    purgeResult = {
      stage:  'Database Purge',
      status: 'skipped',
      detail: `Purge aborted — "${blockingFailure.stage}" failed: ${blockingFailure.error}. Fix the failing stage and retry.`,
    }
  } else {
    try {
      // prisma.client.delete cascades to: SOWs, ClientSubscriptions,
      // TimeLogs (via clientId), CallLogs, ClientTags.
      await prisma.client.delete({ where: { harvestProjectCode: projectCode } })
      purgeResult = {
        stage:  'Database Purge',
        status: 'success',
        detail: `Client ${record.id} and all linked rows deleted (SOWs: ${record.sows.length}, time logs: ${record.timeLogs.length}, call logs: ${record.callLogs.length}, subscriptions: ${record.subscriptions.length}).`,
      }
    } catch (err) {
      purgeResult = {
        stage:  'Database Purge',
        status: 'failed',
        error:  err instanceof Error ? err.message : String(err),
      }
    }
  }

  // ── Accountant auto-archive ────────────────────────────────────────────────
  const accountantResult: StageResult | null =
    purgeResult.status === 'success' && record.accountantName
      ? await checkAndAutoArchiveAccountant(record.accountantName)
      : null

  const allStages = [...externalStages, purgeResult, ...(accountantResult ? [accountantResult] : [])]
  const succeeded = allStages.filter(s => s.status === 'success').length
  const failed    = allStages.filter(s => s.status === 'failed').length
  const skipped   = allStages.filter(s => s.status === 'skipped').length

  return NextResponse.json({
    clientId:           record.id,
    clientName:         record.name,
    harvestProjectCode: projectCode,
    pipelineStatus:     failed === 0 ? 'complete' : 'partial',
    summary:            { succeeded, failed, skipped, total: allStages.length },
    exportFileName:     filename,
    exportWebViewLink:  (driveResult as { webViewLink?: string }).webViewLink,
    stages:             allStages,
  })
}

/**
 * GET /api/clients/archive
 *
 * Returns endpoint documentation — useful for integration checks and tooling.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint:    'POST /api/clients/archive',
    description: 'Full client offboarding pipeline: data export → Google Drive → Anchor → Harvest → ClickUp → DB purge.',
    safetyGate:  'Request MUST include { "confirmation": "CONFIRM" } or it will be rejected with HTTP 403.',
    requiredEnv: [
      'DATABASE_URL               — Prisma database connection string',
      'GOOGLE_DRIVE_ACCESS_TOKEN  — OAuth2 / service-account token for Drive API',
      'GOOGLE_DRIVE_TEAM_FOLDER_ID— (optional) default parent folder for archive files',
      'ANCHOR_API_KEY             — Anchor Payments platform API key',
      'HARVEST_ACCOUNT_ID         — Harvest account numeric ID',
      'HARVEST_ACCESS_TOKEN       — Harvest personal access token',
      'CLICKUP_API_TOKEN          — ClickUp personal API token',
    ],
    pipelineStages: [
      '1. Markdown export — compiles all SOWs, time logs, call logs, subscriptions into a .md document',
      '2. Google Drive    — uploads the document to the team folder (skipped if token absent)',
      '3. Anchor          — terminates the billing agreement (skipped if key / ID absent)',
      '4. Harvest         — sets project is_active = false (skipped if credentials absent)',
      '5. ClickUp         — archives the client folder via v3 API with v2 rename fallback (skipped if token / ID absent)',
      '6. DB purge        — cascade-deletes the client record ONLY if stages 1–5 have no failures',
    ],
    requestSchema: {
      confirmation:     '"CONFIRM" (required string — exact value, case-sensitive)',
      projectCode:      'string (required) — e.g. "THRN-001"',
      anchorAgreementId:'string (optional) — Anchor agreement token',
      clickUpFolderId:  'string (optional) — ClickUp folder ID for this client',
      harvestProjectId: 'number (optional) — Harvest internal project ID; skips an extra GET /v2/projects lookup',
    },
    exampleRequest: {
      confirmation:      'CONFIRM',
      projectCode:       'THRN-001',
      anchorAgreementId: 'agr_abc123',
      clickUpFolderId:   '90120123456',
      harvestProjectId:  987654,
    },
  })
}
