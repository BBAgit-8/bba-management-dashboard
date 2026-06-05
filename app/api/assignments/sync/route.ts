/**
 * POST /api/assignments/sync
 *
 * Persists client-to-employee assignment changes to the database, then
 * fires asynchronous updates to Harvest (project member swap) and ClickUp
 * (open task reassignment).
 *
 * All environment variables referenced here are SERVER-SIDE ONLY.
 * They are never prefixed with NEXT_PUBLIC_ and are therefore inaccessible
 * to client-side JavaScript bundles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AssignmentChange {
  /** Internal DB client ID. */
  clientId: string
  /** Harvest project code used to locate the project in Harvest (e.g. "THRN-001"). */
  harvestProjectCode: string
  /** Our DB ID for the incoming employee. */
  newEmployeeId: string
  /** Display name as it appears in Harvest / ClickUp (e.g. "Sarah Johnson"). */
  newEmployeeName: string
  /** Previous employee DB ID — required to remove old assignments. */
  previousEmployeeId?: string
  /** Previous employee display name — used to remove old Harvest/ClickUp assignments. */
  previousEmployeeName?: string
  /** ClickUp list ID for this client's project. If absent, ClickUp sync is skipped. */
  clickUpListId?: string
}

interface SyncRequest {
  changes: AssignmentChange[]
}

interface StepResult {
  success: boolean
  error?: string
}

interface ClickUpStepResult extends StepResult {
  tasksUpdated?: number
  skipped?: boolean
}

interface ChangeResult {
  clientId: string
  harvestProjectCode: string
  database: StepResult
  harvest: StepResult
  clickUp: ClickUpStepResult
}

// ─────────────────────────────────────────────────────────────────────────────
// Harvest helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Shared Harvest request headers built from environment variables. */
function harvestHeaders(): Record<string, string> {
  return {
    Authorization:        `Bearer ${process.env.HARVEST_ACCESS_TOKEN}`,
    'Harvest-Account-Id': process.env.HARVEST_ACCOUNT_ID ?? '',
    'User-Agent':         'ManagementDashboard/1.0 (internal)',
    'Content-Type':       'application/json',
  }
}

/**
 * Swaps the project member in Harvest:
 * 1. Finds the project by `projectCode` (Harvest `project.code` field).
 * 2. Looks up both employees in the Harvest user list by display name.
 * 3. Removes the previous employee's project assignment if one exists.
 * 4. Adds the new employee's project assignment (no-op if already assigned).
 */
async function syncHarvestAssignment(
  projectCode: string,
  newEmployeeName: string,
  previousEmployeeName?: string,
): Promise<StepResult> {
  const accountId   = process.env.HARVEST_ACCOUNT_ID
  const accessToken = process.env.HARVEST_ACCESS_TOKEN

  if (!accountId || !accessToken) {
    return { success: false, error: 'HARVEST_ACCOUNT_ID or HARVEST_ACCESS_TOKEN not configured' }
  }

  const headers = harvestHeaders()

  try {
    // ── Step 1: Resolve project ID from project code ────────────────────────
    const projectsRes = await fetch('https://api.harvestapp.com/v2/projects?is_active=true', { headers })
    if (!projectsRes.ok) {
      return { success: false, error: `Harvest /v2/projects failed: ${projectsRes.status}` }
    }
    const { projects } = (await projectsRes.json()) as {
      projects: Array<{ id: number; code: string }>
    }
    const project = projects.find(p => p.code === projectCode)
    if (!project) {
      return { success: false, error: `No active Harvest project found with code "${projectCode}"` }
    }

    // ── Step 2: Resolve user IDs from display names ─────────────────────────
    const usersRes = await fetch('https://api.harvestapp.com/v2/users?is_active=true', { headers })
    if (!usersRes.ok) {
      return { success: false, error: `Harvest /v2/users failed: ${usersRes.status}` }
    }
    const { users } = (await usersRes.json()) as {
      users: Array<{ id: number; first_name: string; last_name: string }>
    }
    const findUser = (name: string) =>
      users.find(u => `${u.first_name} ${u.last_name}` === name)

    const newUser  = findUser(newEmployeeName)
    const prevUser = previousEmployeeName ? findUser(previousEmployeeName) : undefined

    if (!newUser) {
      return { success: false, error: `Harvest user not found: "${newEmployeeName}"` }
    }

    // ── Step 3: Fetch current project user assignments ──────────────────────
    const assignRes = await fetch(
      `https://api.harvestapp.com/v2/projects/${project.id}/user_assignments`,
      { headers },
    )
    if (!assignRes.ok) {
      return { success: false, error: `Harvest user_assignments fetch failed: ${assignRes.status}` }
    }
    const { user_assignments } = (await assignRes.json()) as {
      user_assignments: Array<{ id: number; user: { id: number } }>
    }

    // ── Step 4: Remove previous employee's assignment ───────────────────────
    if (prevUser) {
      const existingAssignment = user_assignments.find(ua => ua.user.id === prevUser.id)
      if (existingAssignment) {
        const delRes = await fetch(
          `https://api.harvestapp.com/v2/projects/${project.id}/user_assignments/${existingAssignment.id}`,
          { method: 'DELETE', headers },
        )
        if (!delRes.ok) {
          console.warn(
            `[harvest] Could not remove ${previousEmployeeName} from project ${projectCode}: ${delRes.status}`,
          )
        }
      }
    }

    // ── Step 5: Add new employee assignment (idempotent) ────────────────────
    const alreadyAssigned = user_assignments.find(ua => ua.user.id === newUser.id)
    if (!alreadyAssigned) {
      const addRes = await fetch(
        `https://api.harvestapp.com/v2/projects/${project.id}/user_assignments`,
        {
          method:  'POST',
          headers,
          body:    JSON.stringify({ user_id: newUser.id }),
        },
      )
      if (!addRes.ok) {
        return { success: false, error: `Harvest add user_assignment failed: ${addRes.status}` }
      }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ClickUp helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Shared ClickUp request headers. */
function clickUpHeaders(): Record<string, string> {
  return {
    Authorization: process.env.CLICKUP_API_TOKEN ?? '',
    'Content-Type': 'application/json',
  }
}

/**
 * Reassigns all open tasks inside a ClickUp list to the new employee:
 * 1. Resolves the list's member roster to get ClickUp user IDs.
 * 2. Fetches open/in-progress tasks from the list (first page).
 * 3. For each task, PUTs updated assignees (add new, remove previous).
 */
async function syncClickUpTasks(
  listId: string,
  newEmployeeName: string,
  previousEmployeeName?: string,
): Promise<ClickUpStepResult> {
  const token = process.env.CLICKUP_API_TOKEN
  if (!token) {
    return { success: false, tasksUpdated: 0, error: 'CLICKUP_API_TOKEN not configured' }
  }

  const headers = clickUpHeaders()

  try {
    // ── Step 1: Resolve ClickUp member IDs from display names ───────────────
    const membersRes = await fetch(`https://api.clickup.com/api/v2/list/${listId}/member`, { headers })
    if (!membersRes.ok) {
      return { success: false, tasksUpdated: 0, error: `ClickUp list members failed: ${membersRes.status}` }
    }
    const { members } = (await membersRes.json()) as {
      members: Array<{ id: number; username: string; email: string }>
    }

    const findMember = (name: string) =>
      members.find(m => m.username === name || m.email.startsWith(name.toLowerCase().replace(' ', '.')))

    const newMember  = findMember(newEmployeeName)
    const prevMember = previousEmployeeName ? findMember(previousEmployeeName) : undefined

    if (!newMember) {
      return { success: false, tasksUpdated: 0, error: `ClickUp member not found: "${newEmployeeName}"` }
    }

    // ── Step 2: Fetch open tasks in the list ────────────────────────────────
    const tasksRes = await fetch(
      `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=false&subtasks=true`,
      { headers },
    )
    if (!tasksRes.ok) {
      return { success: false, tasksUpdated: 0, error: `ClickUp task list failed: ${tasksRes.status}` }
    }
    const { tasks } = (await tasksRes.json()) as {
      tasks: Array<{ id: string; status: { type: string } }>
    }

    // Only update tasks that are not done/closed
    const openTasks = tasks.filter(t => !['closed', 'complete'].includes(t.status.type))

    // ── Step 3: Reassign each open task (concurrent, best-effort) ───────────
    const assignPayload: Record<string, number[]> = {
      add: [newMember.id],
      ...(prevMember ? { rem: [prevMember.id] } : {}),
    }

    const results = await Promise.allSettled(
      openTasks.map(task =>
        fetch(`https://api.clickup.com/api/v2/task/${task.id}`, {
          method:  'PUT',
          headers,
          body:    JSON.stringify({ assignees: assignPayload }),
        }),
      ),
    )

    const tasksUpdated = results.filter(
      r => r.status === 'fulfilled' && r.value.ok,
    ).length

    return { success: true, tasksUpdated }
  } catch (err) {
    return {
      success:      false,
      tasksUpdated: 0,
      error:        err instanceof Error ? err.message : String(err),
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request validation
// ─────────────────────────────────────────────────────────────────────────────

function validateSyncRequest(body: unknown): { valid: true; data: SyncRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Body must be a JSON object' }
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.changes) || b.changes.length === 0) {
    return { valid: false, error: '"changes" must be a non-empty array' }
  }
  for (const [i, c] of (b.changes as unknown[]).entries()) {
    const change = c as Record<string, unknown>
    if (typeof change.clientId         !== 'string') return { valid: false, error: `changes[${i}].clientId is required` }
    if (typeof change.harvestProjectCode !== 'string') return { valid: false, error: `changes[${i}].harvestProjectCode is required` }
    if (typeof change.newEmployeeId     !== 'string') return { valid: false, error: `changes[${i}].newEmployeeId is required` }
    if (typeof change.newEmployeeName   !== 'string') return { valid: false, error: `changes[${i}].newEmployeeName is required` }
  }
  return { valid: true, data: b as unknown as SyncRequest }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/assignments/sync
 *
 * Processes each changed assignment:
 *   1. Updates Client.accountantName in the database (sequential, stops on error).
 *   2. Fires Harvest project-member swap (async, non-blocking).
 *   3. Fires ClickUp task reassignment if clickUpListId is supplied (async, non-blocking).
 *
 * External API failures are reported in the response but do NOT fail the request
 * — the DB write is the authoritative source of truth.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validation = validateSyncRequest(raw)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }

  const { changes } = validation.data
  const results: ChangeResult[] = []

  for (const change of changes) {
    const dbResult:      StepResult       = { success: false }
    const harvestResult: StepResult       = { success: false, error: 'Not attempted' }
    const cuResult:      ClickUpStepResult = { success: false, tasksUpdated: 0, skipped: true }

    // ── 1. Persist to database ───────────────────────────────────────────────
    try {
      await prisma.client.update({
        where: { harvestProjectCode: change.harvestProjectCode },
        data:  { accountantName: change.newEmployeeName },
      })
      dbResult.success = true
    } catch (err) {
      dbResult.success = false
      dbResult.error   = err instanceof Error ? err.message : String(err)
      // Report but keep processing remaining changes.
      results.push({
        clientId:          change.clientId,
        harvestProjectCode: change.harvestProjectCode,
        database: dbResult,
        harvest:  { success: false, error: 'Skipped — database update failed' },
        clickUp:  { success: false, tasksUpdated: 0, skipped: true },
      })
      continue
    }

    // ── 2 & 3. External API calls (parallel, best-effort) ───────────────────
    const [harvestRes, cuRes] = await Promise.all([
      syncHarvestAssignment(
        change.harvestProjectCode,
        change.newEmployeeName,
        change.previousEmployeeName,
      ),
      change.clickUpListId
        ? syncClickUpTasks(
            change.clickUpListId,
            change.newEmployeeName,
            change.previousEmployeeName,
          )
        : Promise.resolve<ClickUpStepResult>({
            success:      true,
            tasksUpdated: 0,
            skipped:      true,
            error:        'clickUpListId not provided — ClickUp sync skipped',
          }),
    ])

    Object.assign(harvestResult, harvestRes)
    Object.assign(cuResult,      cuRes)

    results.push({
      clientId:           change.clientId,
      harvestProjectCode: change.harvestProjectCode,
      database:           dbResult,
      harvest:            harvestResult,
      clickUp:            cuResult,
    })
  }

  const syncedCount = results.filter(r => r.database.success).length

  return NextResponse.json({
    synced:  syncedCount,
    total:   changes.length,
    results,
  })
}

/**
 * GET /api/assignments/sync
 *
 * Returns endpoint metadata and the expected request shape.
 * Useful for integration testing and documentation.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint:    'POST /api/assignments/sync',
    description: 'Persists client-to-employee assignment changes and syncs to Harvest + ClickUp.',
    requiredEnv: [
      'HARVEST_ACCOUNT_ID    — Harvest account numeric ID',
      'HARVEST_ACCESS_TOKEN  — Harvest personal access token',
      'CLICKUP_API_TOKEN     — ClickUp personal API token',
      'DATABASE_URL          — Prisma-compatible database connection string',
    ],
    requestSchema: {
      changes: [{
        clientId:            'string (required) — internal DB client ID',
        harvestProjectCode:  'string (required) — matches Client.harvestProjectCode',
        newEmployeeId:       'string (required) — internal DB employee ID',
        newEmployeeName:     'string (required) — full name as it appears in Harvest and ClickUp',
        previousEmployeeId:  'string (optional) — DB ID of the employee being replaced',
        previousEmployeeName:'string (optional) — display name of the employee being replaced',
        clickUpListId:       'string (optional) — ClickUp list ID; sync skipped if absent',
      }],
    },
  })
}
