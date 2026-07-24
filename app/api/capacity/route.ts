// app/api/capacity/route.ts
// GET: full capacity rollup — per-client breakdowns + per-employee totals + pod rollup.
// Reads client workload hours directly from the client form fields.
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  computeClient, rollup,
  type CapacitySettings, type ClientWorkload,
  type EmployeeCapacityInputs, type TaskAssignmentMap, type TaskType,
} from "@/lib/capacity";
import { requireAuth } from '@/lib/require-auth'

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAuth(req); if (gate) return gate;

  try {
    const [settingsRes, clientsRes, employeesRes, podDefaultsRes, overridesRes, engagementsRes, podsRes] =
      await Promise.all([
        supabase.from("capacitySettings").select("key, value"),
        supabase.from("clients").select(
          `id, name, harvestProjectCode, revenueType, revType, projectType, qboOnly, assignedPodId, "Bookkeeper",
           totalHrsPerMonth, bkprHours, qaHours, custSuccessMgmtHrs, yeOrTaxHours,
           auditHours, apArHrs, bankFeedTime, recTime,
           numBanksAndCCs, numLoans, numPmtPortals`
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

    const raw = Object.fromEntries((settingsRes.data ?? []).map((r) => [r.key, r.value]));
    const settings: CapacitySettings = {
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

    const num = (v: unknown) => v == null ? 0 : Number(v);

    // Exclude QBO-only clients from capacity planning — they don't consume
    // bookkeeper hours, so including them skews pod capacity math. We check
    // every marker (boolean flag, current and legacy projectType values, both
    // revenueType columns) because the data has drift across those fields.
    const QBO_ONLY_PROJECT_TYPES = new Set(['QBO_ONLY', 'QBO']);
    const QBO_ONLY_REVENUE_TYPES = new Set(['QBO_ONLY_ANCHOR', 'QBO_ONLY_QBO', 'QBO_ONLY_QB']);
    const isQboOnly = (c: any) =>
      c.qboOnly === true
      || QBO_ONLY_PROJECT_TYPES.has(c.projectType)
      || QBO_ONLY_REVENUE_TYPES.has(c.revenueType)
      || QBO_ONLY_REVENUE_TYPES.has(c.revType);

    const breakdowns = (clientsRes.data ?? [])
      .filter((c) => !isQboOnly(c))
      .map((c) => {
        const cleanup = activeCleanups.get(c.id);
        const workload: ClientWorkload = {
          id: c.id,
          name: c.name,
          revenueType: cleanup ? "CLEANUP" : c.revenueType,
          assignedPodId: c.assignedPodId ?? null,
          totalHrs: c.totalHrsPerMonth != null ? Number(c.totalHrsPerMonth) : null,
          bkprHours: num(c.bkprHours),
          qaHours: num(c.qaHours),
          csHours: num(c.custSuccessMgmtHrs),
          yeHours: num(c.yeOrTaxHours),
          auditHours: num(c.auditHours),
          apArHours: num(c.apArHrs),
          bankFeedHours: num(c.bankFeedTime),
          recHours: num(c.recTime),
          prRecHours: 0, // no dedicated column yet
          cleanupPrice: cleanup?.cleanupPrice != null ? Number(cleanup.cleanupPrice) : null,
          cleanupDurationMonths: cleanup?.cleanupDurationMonths ?? null,
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

    const clientAssignments = (clientsRes.data ?? [])
      .filter((c) => !(c.revenueType ?? "").startsWith("QBO_ONLY"))
      .map((c) => ({
        id: c.id,
        name: c.name,
        harvestProjectCode: c.harvestProjectCode ?? null,
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
