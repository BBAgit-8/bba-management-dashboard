// lib/capacity.ts
// Pure computation engine for pod capacity planning.
// Reads hours DIRECTLY from the client form fields Dawn already maintains —
// no bucket lookups or tier formulas.

export type TaskType =
  | "bkpr" | "bankFeed" | "rec" | "apAr" | "prRec" | "qa" | "ye" | "audit";

export interface CapacitySettings {
  cleanupHourlyRate: number;  // used only for cleanup engagements
}

/**
 * A client's monthly workload as entered on the client form.
 *
 * Dawn's data model:
 *   Total Hrs / Mo = Bkpr Hours + QA + CS + YE + Audit
 *   Bkpr Hours is itself a CONTAINER:
 *     Bkpr Hours = Pure Bookkeeping + Bank Feed + Rec + AP/AR (+ PR Rec)
 *
 * So the bookkeeper's own share is:
 *   pureBkpr = bkprHours − bankFeed − rec − prRec
 *   (AR is currently included inside bkprHours — see routing note in code)
 */
export interface ClientWorkload {
  id: string;
  name: string;
  revenueType: string | null;
  assignedPodId: string | null;

  totalHrs: number | null;    // Total Hrs / Mo — for validation only

  bkprHours: number;          // Bkpr container (includes bank feed + rec + AP/AR)
  qaHours: number;            // → firm-wide QA pool
  csHours: number;            // → firm-wide CS pool
  yeHours: number;            // stays in pod (default: Jada)
  auditHours: number;
  apArHours: number;
  bankFeedHours: number;
  recHours: number;
  prRecHours: number;         // no form field yet; defaults to 0

  // Cleanup engagements only
  cleanupPrice?: number | null;
  cleanupDurationMonths?: number | null;
}

export interface EmployeeCapacityInputs {
  id: string;
  name: string;
  podId: string | null;
  contractedHours: number | null;
  adminTimePercent: number;
  fixedDeduction: number;
}

export interface TaskAssignmentMap {
  podDefaults: Record<string, Partial<Record<TaskType, string>>>;
  clientOverrides: Record<string, Partial<Record<TaskType, string>>>;
}

export interface ClientCapacityBreakdown {
  clientId: string;
  clientName: string;
  qa: number;
  cs: number;
  ye: number;
  audit: number;
  bankFeed: number;
  rec: number;
  apAr: number;
  prRec: number;
  pureBkpr: number;
  bkprContainer: number;
  totalEntered: number;
  totalOnClient: number | null;
  warnings: string[];
  hoursByEmployee: Record<string, Partial<Record<TaskType, number>>>;
  isCleanup: boolean;
}

const WEEKS_PER_MONTH = 4.33;

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
  if (rt.startsWith("QBO_ONLY")) return null;
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

  // ---- Cleanup engagements: hours = price / rate / duration ----
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
      pureBkpr: monthly, bkprContainer: monthly,
      totalEntered: monthly, totalOnClient: c.totalHrs,
      warnings, hoursByEmployee, isCleanup: true,
    };
  }

  // ---- Monthly clients: read direct-entered hours ----
  const qa = c.qaHours;
  const cs = c.csHours;
  const ye = c.yeHours;
  const audit = c.auditHours;
  // apAr is still on the input type (c.apArHours) but not consumed here —
  // see the pureBkpr comment above for the business-rule context.
  const bankFeed = c.bankFeedHours;
  const rec = c.recHours;
  const prRec = c.prRecHours;

  // AR is currently INCLUDED inside bkprHours per Dawn's business rule (July 2026).
  // Kept as a client-form field for tracking, but NOT deducted from pureBkpr and
  // NOT routed separately — it just lives inside the bookkeeper's container work.
  // If this changes back, restore `- apAr` on the pureBkpr line and re-add
  // `add("apAr", apAr)` on the routing line below.
  const bkprContainer = c.bkprHours;
  const pureBkpr = round2(bkprContainer - bankFeed - rec - prRec);
  if (pureBkpr < 0) {
    warnings.push(
      `Sub-tasks (Bank Feed ${bankFeed} + Rec ${rec}${prRec ? ` + PR ${prRec}` : ""}) ` +
      `exceed Bkpr Hours (${bkprContainer}) — check the client's hours split`
    );
  }

  const totalEntered = round2(bkprContainer + qa + cs + ye + audit);
  if (c.totalHrs != null && Math.abs(totalEntered - c.totalHrs) > 0.01) {
    warnings.push(
      `Total Hrs/Mo (${c.totalHrs}) doesn't match Bkpr + QA + CS + YE + Audit (${totalEntered})`
    );
  }

  if (bkprContainer === 0 && qa === 0 && cs === 0 && ye === 0)
    warnings.push("No hours entered on client");

  // Audit folds into YE — Jada handles both as year-end work.
  // PR Rec is Jada's regular maintenance work across all clients (done quarterly);
  // not tracked per-client here. When Dawn has the total-hours estimate we'll
  // add it as a fixed deduction on Jada's employee record.
  add("ye", ye + audit);
  add("bankFeed", bankFeed);
  add("rec", rec);
  // apAr NOT routed separately — see the pureBkpr note above.
  add("bkpr", Math.max(pureBkpr, 0));

  return {
    clientId: c.id, clientName: c.name,
    qa, cs, ye, audit, bankFeed, rec, apAr: c.apArHours, prRec,
    pureBkpr, bkprContainer,
    totalEntered, totalOnClient: c.totalHrs,
    warnings, hoursByEmployee, isCleanup: false,
  };
}

export interface EmployeeRollup {
  employeeId: string;
  name: string;
  podId: string | null;
  capacity: number;
  byTask: Partial<Record<TaskType, number>>;
  totalAssigned: number;
  difference: number;
}

export function rollup(
  clients: ClientCapacityBreakdown[],
  employees: EmployeeCapacityInputs[]
): { employees: EmployeeRollup[]; csPool: number; qaPool: number; warnings: { client: string; msgs: string[] }[] } {
  const byEmp = new Map<string, Partial<Record<TaskType, number>>>();
  let csPool = 0;
  let qaPool = 0;
  const warnings: { client: string; msgs: string[] }[] = [];

  for (const c of clients) {
    csPool = round2(csPool + c.cs);
    qaPool = round2(qaPool + c.qa);
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

  return { employees: rollups, csPool, qaPool, warnings };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
