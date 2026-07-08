// app/api/capacity/route.ts
// GET: full capacity rollup — per-client breakdowns + per-employee totals + pod rollup
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  computeClient, rollup,
  type CapacitySettings, type ClientWorkload,
  type EmployeeCapacityInputs, type TaskAssignmentMap, type TaskType,
} from "@/lib/capacity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settingsRes, clientsRes, employeesRes, podDefaultsRes, overridesRes, engagementsRes, podsRes] =
      await Promise.all([
        supabase.from("capacitySettings").select("key, value"),
        supabase.from("clients").select(
          `id, name, revenueType, totalBudgetedHours, numBankAccounts, numLoans,
           txnBucket, numPmtPortals, pettyCash, apArHours, prRecHours, auditHours,
           bankFeedHoursOverride, recHoursOverride, assignedPodId, "Bookkeeper"`
        ),
        supabase.from("employees").select(
          `id, name, podId, contractedHours, adminTimePercent, fixedDeduction, fixedDeductionLabel`
        ),
        supabase.from("podTaskDefaults").select("podId, taskType, employeeId"),
        supabase.from("clientTaskOverrides").select("clientId, taskType, employeeId"),
        supabase.from("clientEngagements")
          .select("clientId, engagementType, cleanupPrice, cleanupDurationMonths")
          .is("endDate", null),
        supabase.from("pods").select("id, name"),
      ]);

    const firstError =
      settingsRes.error || clientsRes.error || employeesRes.error ||
      podDefaultsRes.error || overridesRes.error || engagementsRes.error || podsRes.error;
    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    // settings jsonb -> typed object
    const raw = Object.fromEntries((settingsRes.data ?? []).map((r) => [r.key, r.value]));
    const settings: CapacitySettings = {
      bankFeedBuckets: raw.bankFeedBuckets ?? {},
      recHoursPerAccount: Number(raw.recHoursPerAccount ?? 0.5),
      recHoursPerLoan: Number(raw.recHoursPerLoan ?? 0),
      tierRules: raw.tierRules ?? { thresholds: [10, 20], hours: [0.25, 0.5, 0.75] },
      cleanupHourlyRate: Number(raw.cleanupHourlyRate ?? 125),
    };

    const assignments: TaskAssignmentMap = { podDefaults: {}, clientOverrides: {} };
    for (const d of podDefaultsRes.data ?? []) {
      assignments.podDefaults[d.podId] = assignments.podDefaults[d.podId] ?? {};
      assignments.podDefaults[d.podId][d.taskType as TaskType] = d.employeeId;
    }
    for (const o of overridesRes.data ?? []) {
      assignments.clientOverrides[o.clientId] = assignments.clientOverrides[o.clientId] ?? {};
      assignments.clientOverrides[o.clientId][o.taskType as TaskType] = o.employeeId;
    }

    const activeCleanups = new Map(
      (engagementsRes.data ?? [])
        .filter((e) => e.engagementType === "cleanup")
        .map((e) => [e.clientId, e])
    );

    const breakdowns = (clientsRes.data ?? [])
      .map((c) => {
        const cleanup = activeCleanups.get(c.id);
        const workload: ClientWorkload = {
          ...c,
          totalBudgetedHours: c.totalBudgetedHours != null ? Number(c.totalBudgetedHours) : null,
          numBankAccounts: c.numBankAccounts ?? 0,
          numLoans: c.numLoans ?? 0,
          apArHours: Number(c.apArHours ?? 0),
          prRecHours: Number(c.prRecHours ?? 0),
          auditHours: Number(c.auditHours ?? 0),
          bankFeedHoursOverride: c.bankFeedHoursOverride != null ? Number(c.bankFeedHoursOverride) : null,
          recHoursOverride: c.recHoursOverride != null ? Number(c.recHoursOverride) : null,
          cleanupPrice: cleanup?.cleanupPrice != null ? Number(cleanup.cleanupPrice) : null,
          cleanupDurationMonths: cleanup?.cleanupDurationMonths ?? null,
          revenueType: cleanup ? "CLEANUP" : c.revenueType,
        };
        return computeClient(workload, settings, assignments);
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    const employees: EmployeeCapacityInputs[] = (employeesRes.data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      podId: e.podId ?? null,
      contractedHours: e.contractedHours != null ? Number(e.contractedHours) : null,
      adminTimePercent: Number(e.adminTimePercent ?? 0),
      fixedDeduction: Number(e.fixedDeduction ?? 0),
    }));

    const result = rollup(breakdowns, employees);

    // pod rollups: sum members
    const pods = (podsRes.data ?? []).map((p) => {
      const members = result.employees.filter((e) => e.podId === p.id);
      const byTask: Partial<Record<TaskType, number>> = {};
      for (const m of members) {
        for (const [t, h] of Object.entries(m.byTask) as [TaskType, number][]) {
          byTask[t] = Math.round(((byTask[t] ?? 0) + h) * 100) / 100;
        }
      }
      return {
        podId: p.id,
        name: p.name,
        members: members.map((m) => m.employeeId),
        byTask,
        capacity: Math.round(members.reduce((s, m) => s + m.capacity, 0) * 100) / 100,
        totalAssigned: Math.round(members.reduce((s, m) => s + m.totalAssigned, 0) * 100) / 100,
        difference: Math.round(members.reduce((s, m) => s + m.difference, 0) * 100) / 100,
      };
    });

    // For the pod-assignment UI: flat list of every non-QBO_ONLY client with
    // its current bookkeeper + pod, so Dawn can assign clients to pods directly.
    const clientAssignments = (clientsRes.data ?? [])
      .filter((c) => !(c.revenueType ?? "").startsWith("QBO_ONLY"))
      .map((c) => ({
        id: c.id,
        name: c.name,
        bookkeeper: c.Bookkeeper ?? null,
        assignedPodId: c.assignedPodId ?? null,
        revenueType: c.revenueType ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      employees: result.employees,
      pods,
      csPool: result.csPool,
      qaPool: result.qaPool,
      clients: breakdowns,
      clientAssignments,
      warnings: result.warnings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
