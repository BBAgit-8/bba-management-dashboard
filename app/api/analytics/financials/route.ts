import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'

// ─────────────────────────────────────────────────────────────────────────────
// Domain constants
// ─────────────────────────────────────────────────────────────────────────────

const QA_MONTHLY_ALLOC       = 0.25          // hours reserved per month for QA review
const MGMT_MONTHLY_ALLOC     = 0.25          // hours reserved per month for account management
const YEAR_END_MONTHLY_ALLOC = 0.25          // hours reserved per month for year-end work
const TOTAL_MONTHLY_DEDUCTION = QA_MONTHLY_ALLOC + MGMT_MONTHLY_ALLOC + YEAR_END_MONTHLY_ALLOC

const QUARTER_MONTHS         = 3
const ANNUAL_MONTHS          = 12
const WEEKS_PER_MONTH        = 52 / 12       // ≈ 4.3333 — ISO average

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────────────

type BillingType    = 'FLAT' | 'HOURLY'
type BillingCadence = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
type LogType        = 'BOOKKEEPER' | 'QA' | 'MGMT' | 'YEAR_END'
type BudgetStatus   = 'Estimated' | 'Refined'

// ─────────────────────────────────────────────────────────────────────────────
// Request schema
// ─────────────────────────────────────────────────────────────────────────────

interface ClientInput {
  id: string
  billingType: BillingType
  /** Total hours the client SOW allocates per month (before pool deductions). */
  totalMonthlyHours: number
  /** Required when billingType = 'FLAT'. */
  fixedMonthlyRate?: number
  /** Required when billingType = 'HOURLY'. */
  billingRate?: number
  /** false → budget is an estimate; true → billing rate / rate is confirmed. */
  isRefined: boolean
}

interface EmployeeInput {
  id: string
  name: string
  /** Total contracted hours per week (e.g. 40). */
  contractedWeeklyHours: number
  /** Admin overhead as a whole-number percentage (e.g. 20 means 20%, not 0.20). */
  adminTimePercent: number
  /** Internal cost rate per billable hour. */
  effectiveHourlyRate: number
}

interface TimeLogInput {
  employeeId: string
  hoursLogged: number
  /**
   * Category of the logged time.
   * Omitting the field defaults to BOOKKEEPER (counts against the main budget).
   * QA / MGMT / YEAR_END are tracked separately for pool accounting.
   */
  logType?: LogType
}

interface SubscriptionInput {
  softwareName: string
  /** What we pay the vendor. */
  ourCost: number
  /** What we bill the client. */
  clientPrice: number
  billingCadence: BillingCadence
}

interface PeriodContext {
  /** Which month of the current quarter we are in (1, 2, or 3). */
  currentQuarterMonth: number
  /** Which calendar month we are in (1–12). */
  currentAnnualMonth: number
  /**
   * Total QA hours actually consumed so far this quarter, across all time logs
   * belonging to this client (including logs not sent in this request).
   * Defaults to QA-typed hours present in the current `timeLogs` payload.
   */
  actualQaHoursUsed?: number
  /**
   * Total Year-End hours actually consumed so far this year.
   * Defaults to YEAR_END-typed hours present in the current `timeLogs` payload.
   */
  actualYearEndHoursUsed?: number
}

interface FinancialsRequest {
  client: ClientInput
  employees: EmployeeInput[]
  timeLogs: TimeLogInput[]
  subscriptions: SubscriptionInput[]
  /**
   * Optional rolling-period context.
   * When absent, pool calculations use only the current payload's logs
   * and assume month 1 of both the quarter and the year.
   */
  periodContext?: PeriodContext
}

// ─────────────────────────────────────────────────────────────────────────────
// Response schema
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetAllocationResult {
  /** Raw hours from the SOW. */
  totalMonthlyHours: number
  qaAllocation: number
  mgmtAllocation: number
  yearEndAllocation: number
  totalMonthlyDeductions: number
  /** Hours actually available for bookkeeping work = total − deductions. */
  bookkeeperAllowance: number
  /** bookkeeperAllowance × 12 — useful for annual capacity planning. */
  annualizedFootprint: number
  hoursUsed: number
  hoursRemaining: number
  /** Percentage of bookkeeperAllowance consumed (capped at 100). */
  utilizationPercent: number
}

interface PoolStatus {
  monthlyAllocation: number
  rollingAllocation: number     // monthly × period length
  actualUsed: number
  remaining: number
  monthsElapsed: number
  isOverrun: boolean
}

interface TimePoolsResult {
  quarterly: PoolStatus         // 3-month rolling QA pool
  annual: PoolStatus            // 12-month rolling Year-End pool
}

interface EmployeeCapacityResult {
  id: string
  name: string
  contractedWeeklyHours: number
  adminTimePercent: number
  /** Billable hours per week after removing admin overhead. */
  billableWeeklyHours: number
  /** billableWeeklyHours × WEEKS_PER_MONTH. */
  billableMonthlyHours: number
  effectiveHourlyRate: number
  hoursLoggedThisPeriod: number
  laborCost: number
  /** hoursLoggedThisPeriod / billableMonthlyHours × 100, capped at 100. */
  capacityUtilizationPercent: number
}

interface SubscriptionItemResult {
  softwareName: string
  ourCost: number
  clientPrice: number
  billingCadence: BillingCadence
  /** Margin normalised to a single month regardless of billing cadence. */
  monthlyMargin: number
  annualMargin: number
}

interface SubscriptionsResult {
  items: SubscriptionItemResult[]
  totalMonthlyMargin: number
  totalAnnualMargin: number
}

interface BillingMetricsResult {
  type: BillingType
  budgetStatus: BudgetStatus
  /** Gross revenue from the SOW (fixed rate or accrued hourly). */
  revenue: number
  totalLaborCost: number
  /** Sum of all subscription monthly margins. */
  subscriptionMargin: number
  /** revenue − totalLaborCost. */
  grossProfit: number
  /** grossProfit + subscriptionMargin — the true bottom line. */
  netProfitability: number
  /** netProfitability / revenue × 100, or 0 when revenue is 0. */
  profitMarginPercent: number
  employeeBreakdown: Array<{
    employeeId: string
    name: string
    hoursLogged: number
    laborCost: number
  }>
}

interface FinancialsResponse {
  clientId: string
  computedAt: string
  budget: BudgetAllocationResult
  timePools: TimePoolsResult
  billing: BillingMetricsResult
  employees: EmployeeCapacityResult[]
  subscriptions: SubscriptionsResult
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure calculation functions
// ─────────────────────────────────────────────────────────────────────────────

/** Round to 2 decimal places using symmetric rounding. */
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ── 1. Budget allocation ─────────────────────────────────────────────────────

function computeBudgetAllocation(
  totalMonthlyHours: number,
  timeLogs: TimeLogInput[],
): BudgetAllocationResult {
  const bookkeeperAllowance = Math.max(totalMonthlyHours - TOTAL_MONTHLY_DEDUCTION, 0)
  const annualizedFootprint = r2(bookkeeperAllowance * ANNUAL_MONTHS)

  // Only BOOKKEEPER-typed (or untyped) logs count against the core budget.
  const hoursUsed = r2(
    timeLogs
      .filter(l => !l.logType || l.logType === 'BOOKKEEPER')
      .reduce((sum, l) => sum + l.hoursLogged, 0),
  )

  const hoursRemaining       = r2(Math.max(bookkeeperAllowance - hoursUsed, 0))
  const utilizationPercent   = bookkeeperAllowance > 0
    ? r2(Math.min((hoursUsed / bookkeeperAllowance) * 100, 100))
    : 0

  return {
    totalMonthlyHours,
    qaAllocation:           QA_MONTHLY_ALLOC,
    mgmtAllocation:         MGMT_MONTHLY_ALLOC,
    yearEndAllocation:      YEAR_END_MONTHLY_ALLOC,
    totalMonthlyDeductions: TOTAL_MONTHLY_DEDUCTION,
    bookkeeperAllowance:    r2(bookkeeperAllowance),
    annualizedFootprint,
    hoursUsed,
    hoursRemaining,
    utilizationPercent,
  }
}

// ── 2. Rolling time pools ────────────────────────────────────────────────────

function computeTimePools(
  timeLogs: TimeLogInput[],
  ctx: Required<Omit<PeriodContext, 'actualQaHoursUsed' | 'actualYearEndHoursUsed'>> & {
    actualQaHoursUsed: number
    actualYearEndHoursUsed: number
  },
): TimePoolsResult {
  const quarterlyAllocation = r2(QA_MONTHLY_ALLOC * QUARTER_MONTHS)         // 0.75
  const annualAllocation    = r2(YEAR_END_MONTHLY_ALLOC * ANNUAL_MONTHS)     // 3.00

  // Prefer caller-supplied totals (full rolling period) over payload-only totals.
  const qaUsed = r2(
    ctx.actualQaHoursUsed > 0
      ? ctx.actualQaHoursUsed
      : timeLogs.filter(l => l.logType === 'QA').reduce((s, l) => s + l.hoursLogged, 0),
  )
  const yeUsed = r2(
    ctx.actualYearEndHoursUsed > 0
      ? ctx.actualYearEndHoursUsed
      : timeLogs.filter(l => l.logType === 'YEAR_END').reduce((s, l) => s + l.hoursLogged, 0),
  )

  const qaRemaining = r2(quarterlyAllocation - qaUsed)
  const yeRemaining = r2(annualAllocation    - yeUsed)

  return {
    quarterly: {
      monthlyAllocation: QA_MONTHLY_ALLOC,
      rollingAllocation: quarterlyAllocation,
      actualUsed:        qaUsed,
      remaining:         Math.max(qaRemaining, 0),
      monthsElapsed:     ctx.currentQuarterMonth,
      isOverrun:         qaRemaining < 0,
    },
    annual: {
      monthlyAllocation: YEAR_END_MONTHLY_ALLOC,
      rollingAllocation: annualAllocation,
      actualUsed:        yeUsed,
      remaining:         Math.max(yeRemaining, 0),
      monthsElapsed:     ctx.currentAnnualMonth,
      isOverrun:         yeRemaining < 0,
    },
  }
}

// ── 3. Employee billable capacity ────────────────────────────────────────────

function computeEmployeeCapacity(
  employees: EmployeeInput[],
  timeLogs: TimeLogInput[],
): EmployeeCapacityResult[] {
  return employees.map(emp => {
    // Subtract admin overhead fraction from contracted hours.
    const billableWeeklyHours  = r2(emp.contractedWeeklyHours * (1 - emp.adminTimePercent / 100))
    const billableMonthlyHours = r2(billableWeeklyHours * WEEKS_PER_MONTH)

    const empLogs      = timeLogs.filter(l => l.employeeId === emp.id)
    const hoursLogged  = r2(empLogs.reduce((sum, l) => sum + l.hoursLogged, 0))
    const laborCost    = r2(hoursLogged * emp.effectiveHourlyRate)

    const capacityUtilizationPercent = billableMonthlyHours > 0
      ? r2(Math.min((hoursLogged / billableMonthlyHours) * 100, 100))
      : 0

    return {
      id:                          emp.id,
      name:                        emp.name,
      contractedWeeklyHours:       emp.contractedWeeklyHours,
      adminTimePercent:            emp.adminTimePercent,
      billableWeeklyHours,
      billableMonthlyHours,
      effectiveHourlyRate:         emp.effectiveHourlyRate,
      hoursLoggedThisPeriod:       hoursLogged,
      laborCost,
      capacityUtilizationPercent,
    }
  })
}

// ── 4. Subscription margins ──────────────────────────────────────────────────

function computeSubscriptions(subs: SubscriptionInput[]): SubscriptionsResult {
  const items: SubscriptionItemResult[] = subs.map(sub => {
    const rawMargin = sub.clientPrice - sub.ourCost
    // Normalise every cadence to a monthly figure for consistent aggregation.
    const monthlyMargin =
      sub.billingCadence === 'MONTHLY'   ? r2(rawMargin)       :
      sub.billingCadence === 'QUARTERLY' ? r2(rawMargin / 3)   :
                                           r2(rawMargin / 12)  // ANNUAL

    return {
      softwareName:   sub.softwareName,
      ourCost:        sub.ourCost,
      clientPrice:    sub.clientPrice,
      billingCadence: sub.billingCadence,
      monthlyMargin,
      annualMargin:   r2(monthlyMargin * ANNUAL_MONTHS),
    }
  })

  const totalMonthlyMargin = r2(items.reduce((s, i) => s + i.monthlyMargin, 0))

  return {
    items,
    totalMonthlyMargin,
    totalAnnualMargin: r2(totalMonthlyMargin * ANNUAL_MONTHS),
  }
}

// ── 5. Hybrid billing metrics ────────────────────────────────────────────────

function computeBillingMetrics(
  client: ClientInput,
  employeeCapacity: EmployeeCapacityResult[],
  subscriptionMonthlyMargin: number,
): BillingMetricsResult {
  const totalHoursLogged = r2(
    employeeCapacity.reduce((s, e) => s + e.hoursLoggedThisPeriod, 0),
  )
  const totalLaborCost = r2(
    employeeCapacity.reduce((s, e) => s + e.laborCost, 0),
  )

  /**
   * FLAT:   Revenue is the agreed fixed monthly rate regardless of hours used.
   *         Profitability moves entirely with actual labor cost.
   * HOURLY: Revenue accrues per billable hour actually logged × negotiated rate.
   *         Both revenue and cost float with activity.
   */
  const revenue: number =
    client.billingType === 'FLAT'
      ? r2(client.fixedMonthlyRate ?? 0)
      : r2(totalHoursLogged * (client.billingRate ?? 0))

  const grossProfit      = r2(revenue - totalLaborCost)
  // Software margins are additive profit on top of labor margin.
  const netProfitability = r2(grossProfit + subscriptionMonthlyMargin)
  const profitMarginPercent = revenue > 0
    ? r2((netProfitability / revenue) * 100)
    : 0

  return {
    type:          client.billingType,
    budgetStatus:  client.isRefined ? 'Refined' : 'Estimated',
    revenue,
    totalLaborCost,
    subscriptionMargin: r2(subscriptionMonthlyMargin),
    grossProfit,
    netProfitability,
    profitMarginPercent,
    employeeBreakdown: employeeCapacity.map(e => ({
      employeeId:  e.id,
      name:        e.name,
      hoursLogged: e.hoursLoggedThisPeriod,
      laborCost:   e.laborCost,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request validation
// ─────────────────────────────────────────────────────────────────────────────

interface ValidationError {
  field: string
  message: string
}

function validateRequest(body: unknown): { valid: true; data: FinancialsRequest } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] }
  }

  const b = body as Record<string, unknown>

  // client
  if (!b.client || typeof b.client !== 'object') {
    errors.push({ field: 'client', message: 'Required object' })
  } else {
    const c = b.client as Record<string, unknown>
    if (typeof c.id !== 'string' || !c.id.trim())
      errors.push({ field: 'client.id', message: 'Required non-empty string' })
    if (c.billingType !== 'FLAT' && c.billingType !== 'HOURLY')
      errors.push({ field: 'client.billingType', message: "Must be 'FLAT' or 'HOURLY'" })
    if (typeof c.totalMonthlyHours !== 'number' || c.totalMonthlyHours < 0)
      errors.push({ field: 'client.totalMonthlyHours', message: 'Required non-negative number' })
    if (c.billingType === 'FLAT' && (typeof c.fixedMonthlyRate !== 'number' || (c.fixedMonthlyRate as number) < 0))
      errors.push({ field: 'client.fixedMonthlyRate', message: 'Required non-negative number for FLAT billing' })
    if (c.billingType === 'HOURLY' && (typeof c.billingRate !== 'number' || (c.billingRate as number) < 0))
      errors.push({ field: 'client.billingRate', message: 'Required non-negative number for HOURLY billing' })
    if (typeof c.isRefined !== 'boolean')
      errors.push({ field: 'client.isRefined', message: 'Required boolean' })
  }

  // employees
  if (!Array.isArray(b.employees)) {
    errors.push({ field: 'employees', message: 'Required array' })
  } else {
    (b.employees as unknown[]).forEach((e, i) => {
      const emp = e as Record<string, unknown>
      if (typeof emp.id !== 'string')
        errors.push({ field: `employees[${i}].id`, message: 'Required string' })
      if (typeof emp.name !== 'string')
        errors.push({ field: `employees[${i}].name`, message: 'Required string' })
      if (typeof emp.contractedWeeklyHours !== 'number' || (emp.contractedWeeklyHours as number) < 0)
        errors.push({ field: `employees[${i}].contractedWeeklyHours`, message: 'Required non-negative number' })
      if (typeof emp.adminTimePercent !== 'number' || (emp.adminTimePercent as number) < 0 || (emp.adminTimePercent as number) > 100)
        errors.push({ field: `employees[${i}].adminTimePercent`, message: 'Required number between 0 and 100' })
      if (typeof emp.effectiveHourlyRate !== 'number' || (emp.effectiveHourlyRate as number) < 0)
        errors.push({ field: `employees[${i}].effectiveHourlyRate`, message: 'Required non-negative number' })
    })
  }

  // timeLogs
  if (!Array.isArray(b.timeLogs)) {
    errors.push({ field: 'timeLogs', message: 'Required array' })
  } else {
    const validLogTypes: LogType[] = ['BOOKKEEPER', 'QA', 'MGMT', 'YEAR_END']
    ;(b.timeLogs as unknown[]).forEach((l, i) => {
      const log = l as Record<string, unknown>
      if (typeof log.employeeId !== 'string')
        errors.push({ field: `timeLogs[${i}].employeeId`, message: 'Required string' })
      if (typeof log.hoursLogged !== 'number' || (log.hoursLogged as number) < 0)
        errors.push({ field: `timeLogs[${i}].hoursLogged`, message: 'Required non-negative number' })
      if (log.logType !== undefined && !validLogTypes.includes(log.logType as LogType))
        errors.push({ field: `timeLogs[${i}].logType`, message: `Must be one of: ${validLogTypes.join(', ')}` })
    })
  }

  // subscriptions
  if (!Array.isArray(b.subscriptions)) {
    errors.push({ field: 'subscriptions', message: 'Required array' })
  } else {
    const validCadences: BillingCadence[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL']
    ;(b.subscriptions as unknown[]).forEach((s, i) => {
      const sub = s as Record<string, unknown>
      if (typeof sub.softwareName !== 'string')
        errors.push({ field: `subscriptions[${i}].softwareName`, message: 'Required string' })
      if (typeof sub.ourCost !== 'number' || (sub.ourCost as number) < 0)
        errors.push({ field: `subscriptions[${i}].ourCost`, message: 'Required non-negative number' })
      if (typeof sub.clientPrice !== 'number' || (sub.clientPrice as number) < 0)
        errors.push({ field: `subscriptions[${i}].clientPrice`, message: 'Required non-negative number' })
      if (!validCadences.includes(sub.billingCadence as BillingCadence))
        errors.push({ field: `subscriptions[${i}].billingCadence`, message: `Must be one of: ${validCadences.join(', ')}` })
    })
  }

  if (errors.length > 0) return { valid: false, errors }
  return { valid: true, data: b as unknown as FinancialsRequest }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/analytics/financials
 *
 * Accepts a client profile and returns the complete financial analytics
 * payload: budget splits, rolling time pools, billing profitability,
 * employee billable capacity, and software subscription margins.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Malformed request — body must be valid JSON' },
      { status: 400 },
    )
  }

  const validation = validateRequest(rawBody)
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Validation failed', validationErrors: validation.errors },
      { status: 422 },
    )
  }

  const { client, employees, timeLogs, subscriptions, periodContext } = validation.data

  // Resolve period context with safe defaults.
  const ctx = {
    currentQuarterMonth:    periodContext?.currentQuarterMonth    ?? 1,
    currentAnnualMonth:     periodContext?.currentAnnualMonth     ?? 1,
    actualQaHoursUsed:      periodContext?.actualQaHoursUsed      ?? 0,
    actualYearEndHoursUsed: periodContext?.actualYearEndHoursUsed ?? 0,
  }

  // Execute all calculation domains (pure — no side effects).
  const budget           = computeBudgetAllocation(client.totalMonthlyHours, timeLogs)
  const timePools        = computeTimePools(timeLogs, ctx)
  const employeeCapacity = computeEmployeeCapacity(employees, timeLogs)
  const subscriptionCalc = computeSubscriptions(subscriptions)
  const billing          = computeBillingMetrics(client, employeeCapacity, subscriptionCalc.totalMonthlyMargin)

  const response: FinancialsResponse = {
    clientId:      client.id,
    computedAt:    new Date().toISOString(),
    budget,
    timePools,
    billing,
    employees:     employeeCapacity,
    subscriptions: subscriptionCalc,
  }

  return NextResponse.json(response)
}

/**
 * GET /api/analytics/financials
 *
 * Returns engine metadata — allocation constants and the full request/response
 * schema — useful for client-side tooling and developer reference.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAuth(req); if (gate) return gate;

  return NextResponse.json({
    endpoint:    'POST /api/analytics/financials',
    description: 'Math engine for client financial analytics: budget splits, rolling pools, hybrid billing, subscription margins, and employee capacity.',
    version:     '1.0.0',
    constants: {
      QA_MONTHLY_ALLOC,
      MGMT_MONTHLY_ALLOC,
      YEAR_END_MONTHLY_ALLOC,
      TOTAL_MONTHLY_DEDUCTION,
      QUARTER_MONTHS,
      ANNUAL_MONTHS,
      WEEKS_PER_MONTH: r2(WEEKS_PER_MONTH),
    },
    requestSchema: {
      client: {
        id:               'string (required)',
        billingType:      "'FLAT' | 'HOURLY' (required)",
        totalMonthlyHours:'number ≥ 0 (required) — gross SOW hours before pool deductions',
        fixedMonthlyRate: 'number ≥ 0 (required when FLAT)',
        billingRate:      'number ≥ 0 (required when HOURLY) — rate per billable hour',
        isRefined:        'boolean (required) — false = Estimated, true = Refined',
      },
      employees: [{
        id:                    'string',
        name:                  'string',
        contractedWeeklyHours: 'number ≥ 0 — total contracted hours per week (e.g. 40)',
        adminTimePercent:      'number 0–100 — whole-number percentage of admin overhead (e.g. 20)',
        effectiveHourlyRate:   'number ≥ 0 — internal cost per billable hour',
      }],
      timeLogs: [{
        employeeId:  'string — must match an employee.id',
        hoursLogged: 'number ≥ 0',
        logType:     "'BOOKKEEPER' | 'QA' | 'MGMT' | 'YEAR_END' (optional, defaults to BOOKKEEPER)",
      }],
      subscriptions: [{
        softwareName:   'string',
        ourCost:        'number ≥ 0 — vendor cost per billing period',
        clientPrice:    'number ≥ 0 — amount billed to client per billing period',
        billingCadence: "'MONTHLY' | 'QUARTERLY' | 'ANNUAL'",
      }],
      periodContext: {
        currentQuarterMonth:    'number 1–3 — month within the current quarter',
        currentAnnualMonth:     'number 1–12 — calendar month',
        actualQaHoursUsed:      'number — rolling QA hours consumed this quarter (overrides payload derivation)',
        actualYearEndHoursUsed: 'number — rolling Year-End hours consumed this year (overrides payload derivation)',
      },
    },
    exampleRequest: {
      client: {
        id:               'THRN-001',
        billingType:      'FLAT',
        totalMonthlyHours: 5,
        fixedMonthlyRate: 3500,
        isRefined:        true,
      },
      employees: [
        { id: 'e1', name: 'Sarah Johnson', contractedWeeklyHours: 40, adminTimePercent: 20, effectiveHourlyRate: 85 },
      ],
      timeLogs: [
        { employeeId: 'e1', hoursLogged: 3.75, logType: 'BOOKKEEPER' },
        { employeeId: 'e1', hoursLogged: 0.25, logType: 'QA' },
      ],
      subscriptions: [
        { softwareName: 'QuickBooks Online', ourCost: 40, clientPrice: 65, billingCadence: 'MONTHLY' },
      ],
      periodContext: {
        currentQuarterMonth: 2,
        currentAnnualMonth:  5,
        actualQaHoursUsed:   0.5,
        actualYearEndHoursUsed: 0.25,
      },
    },
  })
}
