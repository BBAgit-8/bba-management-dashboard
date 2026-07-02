// lib/capacity.ts
// Pure computation engine for pod capacity planning.
// No Supabase calls here — pass data in, get numbers out. Testable anywhere.

export type TaskType =
  | "bkpr" | "bankFeed" | "rec" | "apAr" | "prRec" | "qa" | "ye" | "audit";

export interface CapacitySettings {
  bankFeedBuckets: Record<string, number>;      // { "0-100": 0.75, ... }
  recHoursPerAccount: number;                   // 0.5
  recHoursPerLoan: number;                      // 0
  tierRules: { thresholds: number[]; hours: number[] }; // [10,20] / [0.25,0.5,0.75]
  cleanupHourlyRate: number;                    // 125
}

export interface ClientWorkload {
  id: string;
  name: string;
  revenueType: string | null;                   // RevenueType enum: CLEANUP, HOURLY_CLEANUP, QBO_ONLY_*, RECURRING_MONTHLY_*, FREE
  totalBudgetedHours: number | null;
  numBankAccounts: number;
  numLoans: number;
  txnBucket: string | null;
  apArHours: number;
  prRecHours: number;
  auditHours: number;
  bankFeedHoursOverride: number | null;
  recHoursOverride: number | null;
  assignedPodId: string | null;
  // active cleanup engagement, if any
  cleanupPrice?: number | null;
  cleanupDurationMonths?: number | null;
}

export interface EmployeeCapacityInputs {
  id: string;
  name: string;
  podId: string | null;
  contractedHours: number | null;               // weekly hours (existing column)
  adminTimePercent: number;                     // 0-100 (existing column), e.g. 35
  fixedDeduction: number;                       // e.g. Deb's 10 hrs non-pod QA
}

export interface TaskAssignmentMap {
  // resolved per client: taskType -> employeeId
  podDefaults: Record<string, Partial<Record<TaskType, string>>>;   // podId -> map
  clientOverrides: Record<string, Partial<Record<TaskType, string>>>; // clientId -> map
}

export interface ClientCapacityBreakdown {
  clientId: string;
  clientName: string;
  qa: number;
  cs: number;                                   // pool, never assigned to a person
  ye: number;
  audit: number;
  bankFeed: number;
  rec: number;
  apAr: number;
  prRec: number;
  bkprRemainder: number;                        // bkprBudget - carve-outs
  bkprBudget: number;
  warnings: string[];
  hoursByEmployee: Record<string, Partial<Record<TaskType, number>>>;
  isCleanup: boolean;
}

const WEEKS_PER_MONTH = 4.33;

export function tierHours(total: number, rules: CapacitySettings["tierRules"]): number {
  for (let i = 0; i < rules.thresholds.length; i++) {
    if (total <= rules.thresholds[i]) return rules.hours[i];
  }
  return rules.hours[rules.hours.length - 1];
}

export function employeeCapacity(e: EmployeeCapacityInputs): number {
  if (e.contractedHours == null) return 0;
  const pct = (e.adminTimePercent ?? 0) / 100;
  return round2(e.contractedHours * WEEKS_PER_MONTH * (1 - pct) - (e.fixedDeduction ?? 0));
}

function resolveAssignee(
  clientId: string, podId: string | null, task: TaskType, a: TaskAssignmentMap
): string | null {
  return a.clientOverrides[clientId]?.[task]
    ?? (podId ? a.podDefaults[podId]?.[task] ?? null : null);
}

export function computeClient(
  c: ClientWorkload, settings: CapacitySettings, assignments: TaskAssignmentMap
): ClientCapacityBreakdown | null {
  const rt = c.revenueType ?? "";
  if (rt.startsWith("QBO_ONLY")) return null;   // excluded from capacity entirely
  const isCleanup = rt === "CLEANUP" || rt === "HOURLY_CLEANUP";

  const warnings: string[] = [];
  const hoursByEmployee: ClientCapacityBreakdown["hoursByEmployee"] = {};
  const add = (task: TaskType, hours: number) => {
    if (hours <= 0) return;
    const emp = resolveAssignee(c.id, c.assignedPodId, task, assignments);
    if (!emp) { warnings.push(`No assignee for ${task}`); return; }
    hoursByEmployee[emp] = hoursByEmployee[emp] ?? {};
    hoursByEmployee[emp][task] = round2((hoursByEmployee[emp][task] ?? 0) + hours);
  };

  // ---- Cleanup engagements: hours = price / rate, spread across duration ----
  if (isCleanup) {
    const monthly =
      c.cleanupPrice != null && c.cleanupDurationMonths
        ? round2(c.cleanupPrice / settings.cleanupHourlyRate / c.cleanupDurationMonths)
        : 0;
    if (monthly === 0) warnings.push("Cleanup missing price/duration — 0 hrs counted");
    add("bkpr", monthly);
    return {
      clientId: c.id, clientName: c.name,
      qa: 0, cs: 0, ye: 0, audit: 0, bankFeed: 0, rec: 0, apAr: 0, prRec: 0,
      bkprRemainder: monthly, bkprBudget: monthly, warnings, hoursByEmployee,
      isCleanup: true,
    };
  }

  // ---- Monthly clients ----
  const total = c.totalBudgetedHours ?? 0;
  if (total === 0) warnings.push("No total budgeted hours set");

  const qa = tierHours(total, settings.tierRules);
  const cs = tierHours(total, settings.tierRules);
  const ye = tierHours(total, settings.tierRules);
  const audit = c.auditHours ?? 0;

  const bkprBudget = round2(total - qa - cs - ye - audit);

  const bankFeed = c.bankFeedHoursOverride
    ?? (c.txnBucket ? settings.bankFeedBuckets[c.txnBucket] ?? 0 : 0);
  if (!c.txnBucket && c.bankFeedHoursOverride == null)
    warnings.push("No transaction bucket set — bank feed = 0");

  const rec = c.recHoursOverride
    ?? round2(settings.recHoursPerAccount * c.numBankAccounts + settings.recHoursPerLoan * c.numLoans);

  const carveOuts = round2(bankFeed + rec + (c.apArHours ?? 0) + (c.prRecHours ?? 0));
  const bkprRemainder = round2(bkprBudget - carveOuts);
  if (bkprRemainder < 0)
    warnings.push(`Task carve-outs (${carveOuts}) exceed bookkeeper budget (${bkprBudget}) — total budgeted hours may be too low`);

  add("qa", qa);            // pod default: Deb (monthly pre-final QA)
  add("ye", ye);            // pod default: Jada (annualized pool, counted monthly)
  add("audit", audit);
  add("bankFeed", bankFeed);
  add("rec", rec);          // default Jada; per-client override for Deb's one client
  add("apAr", c.apArHours ?? 0);
  add("prRec", c.prRecHours ?? 0);
  add("bkpr", Math.max(bkprRemainder, 0));
  // cs intentionally NOT added — accrues to the shared pool

  return {
    clientId: c.id, clientName: c.name,
    qa, cs, ye, audit, bankFeed, rec,
    apAr: c.apArHours ?? 0, prRec: c.prRecHours ?? 0,
    bkprRemainder, bkprBudget, warnings, hoursByEmployee,
    isCleanup: false,
  };
}

export interface EmployeeRollup {
  employeeId: string;
  name: string;
  podId: string | null;
  capacity: number;
  byTask: Partial<Record<TaskType, number>>;
  totalAssigned: number;
  difference: number;                            // capacity - totalAssigned
}

export function rollup(
  clients: ClientCapacityBreakdown[],
  employees: EmployeeCapacityInputs[]
): { employees: EmployeeRollup[]; csPool: number; warnings: { client: string; msgs: string[] }[] } {
  const byEmp = new Map<string, Partial<Record<TaskType, number>>>();
  let csPool = 0;
  const warnings: { client: string; msgs: string[] }[] = [];

  for (const c of clients) {
    csPool = round2(csPool + c.cs);
    if (c.warnings.length) warnings.push({ client: c.clientName, msgs: c.warnings });
    for (const [empId, tasks] of Object.entries(c.hoursByEmployee)) {
      const acc = byEmp.get(empId) ?? {};
      for (const [t, h] of Object.entries(tasks) as [TaskType, number][]) {
        acc[t] = round2((acc[t] ?? 0) + h);
      }
      byEmp.set(empId, acc);
    }
  }

  const rollups: EmployeeRollup[] = employees.map((e) => {
    const byTask = byEmp.get(e.id) ?? {};
    const totalAssigned = round2(Object.values(byTask).reduce((s, h) => s + (h ?? 0), 0));
    const capacity = employeeCapacity(e);
    return {
      employeeId: e.id, name: e.name, podId: e.podId,
      capacity, byTask, totalAssigned,
      difference: round2(capacity - totalAssigned),
    };
  });

  return { employees: rollups, csPool, warnings };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
