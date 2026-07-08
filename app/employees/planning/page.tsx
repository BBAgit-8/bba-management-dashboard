"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { broadcastBookkeeperChange, useBookkeeperSync } from "@/app/hooks/useBookkeeperSync";

// ═══════════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ═══════════════════════════════════════════════════════════════════════════

// Individual-view types
interface DbEmployee {
  id: string
  name: string
  contractedHours: number
  adminTimePercent: number
  effectiveHourlyRate: number
}

interface DbClient {
  id: string
  name: string
  harvestProjectCode: string
  archiveStatus: string
  processingCadence: string
  projectType: string | null
  accountantName: string | null
  bookkeeper: string | null
  bkprHours: number | null
  totalHrsPerMonth: number | null
  tags: { id: string; name: string; color: string }[]
  sows: { billingType: string; fixedMonthlyRate: number | null; billingRate: number | null; targetHours: number | null }[]
}

// Pod-view types
type TaskType = 'bkpr' | 'bankFeed' | 'rec' | 'apAr' | 'prRec' | 'qa' | 'ye' | 'audit'

type EmployeeRollup = {
  employeeId: string
  name: string
  podId: string | null
  capacity: number
  byTask: Partial<Record<TaskType, number>>
  totalAssigned: number
  difference: number
}

type PodRollup = {
  podId: string
  name: string
  members: string[]
  byTask: Partial<Record<TaskType, number>>
  capacity: number
  totalAssigned: number
  difference: number
}

type ClientBreakdown = {
  clientId: string
  clientName: string
  qa: number; cs: number; ye: number; audit: number
  bankFeed: number; rec: number; apAr: number; prRec: number
  bkprRemainder: number; bkprBudget: number
  warnings: string[]
  isCleanup: boolean
}

type ClientAssignment = {
  id: string
  name: string
  bookkeeper: string | null
  assignedPodId: string | null
  revenueType: string | null
}

type CapacityResponse = {
  employees: EmployeeRollup[]
  pods: PodRollup[]
  csPool: number
  qaPool: number
  clients: ClientBreakdown[]
  clientAssignments: ClientAssignment[]
  warnings: { client: string; msgs: string[] }[]
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const WEEKS_PER_MONTH = 52 / 12;
const BILLABLE_FACTOR = 0.80;

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: "Weekly", BIWEEKLY: "Bi-Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly",
};

const TASK_COLS: { key: TaskType; label: string }[] = [
  { key: 'bkpr',     label: 'Bkpr Hrs' },
  { key: 'apAr',     label: 'AP/AR' },
  { key: 'bankFeed', label: 'Bank Feed' },
  { key: 'rec',      label: 'Recon' },
  { key: 'prRec',    label: 'PR Rec' },
  { key: 'ye',       label: 'YE' },
  { key: 'audit',    label: 'Audit' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function initials(name: string) { return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(); }

function billableMonthlyHrs(emp: DbEmployee): number {
  return r2(Number(emp.contractedHours) * BILLABLE_FACTOR * WEEKS_PER_MONTH);
}
function billableWeeklyHrs(emp: DbEmployee): number {
  return r2(Number(emp.contractedHours) * BILLABLE_FACTOR);
}
function clientMonthlyHrs(client: DbClient): number {
  if (client.bkprHours != null && client.bkprHours > 0) return client.bkprHours;
  return client.sows?.[0]?.targetHours ?? 0;
}

function barColor(pct: number) {
  if (pct > 100) return "bg-red-500";
  if (pct >= 90) return "bg-orange-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-bba-action";
}
function textColor(pct: number) {
  if (pct > 100) return "text-red-600";
  if (pct >= 90) return "text-orange-600";
  if (pct >= 70) return "text-amber-600";
  return "text-bba-primary";
}
function cardBorder(pct: number) {
  if (pct > 100) return "border-red-300";
  if (pct >= 90) return "border-orange-300";
  if (pct >= 70) return "border-amber-300";
  return "border-slate-200";
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  if (n === 0) return '—';
  return n.toFixed(2);
}

function diffColor(diff: number): string {
  if (diff < 0) return 'text-red-600';
  if (diff < 5) return 'text-amber-600';
  return 'text-green-700';
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function CapacityCard({ emp, assignedHrs, assignedCount, capacityHrs }: {
  emp: DbEmployee
  assignedHrs: number
  assignedCount: number
  capacityHrs: number
}) {
  const pct = capacityHrs > 0 ? r2((assignedHrs / capacityHrs) * 100) : 0;
  const overloaded = pct > 100;
  const remaining = r2(Math.max(capacityHrs - assignedHrs, 0));

  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-300 ${cardBorder(pct)}`}
      style={{ backgroundColor: pct > 100 ? 'rgba(239,68,68,0.06)' : pct >= 90 ? 'rgba(249,115,22,0.05)' : pct >= 70 ? 'rgba(245,158,11,0.05)' : '#ffffff' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${overloaded ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-bba-primary'}`}>
            {initials(emp.name)}
          </div>
          <div>
            <a href={`/employees?open=${emp.id}`} className={`text-sm font-semibold leading-tight hover:underline underline-offset-2 ${overloaded ? 'text-red-700' : 'text-bba-primary'}`}>{emp.name}</a>
            <p className={`text-[11px] mt-0.5 ${'text-slate-400'}`}>
              {emp.contractedHours}h/wk · 80% billable
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className={`text-xl font-bold tabular-nums leading-tight ${overloaded ? 'text-red-700' : textColor(pct)}`}>
            {pct.toFixed(1)}%
          </p>
          <p className={`text-[10px] ${'text-slate-400'}`}>utilized</p>
        </div>
      </div>

      <div className={`h-3 w-full overflow-hidden rounded-full mb-2 ${overloaded ? 'bg-red-100' : 'bg-slate-100'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <div className="flex items-end justify-between mt-2.5">
        <div className="space-y-0.5 text-xs">
          <p className="tabular-nums">
            <span className={`font-semibold ${'text-slate-700 font-semibold'}`}>{assignedHrs.toFixed(1)}</span>
            <span className={'text-slate-400'}> / {capacityHrs.toFixed(1)} hrs/mo</span>
          </p>
          <p className={'text-slate-400'}>
            {billableWeeklyHrs(emp).toFixed(1)} billable hrs/wk
            {!overloaded && <span className="text-slate-600"> · {remaining.toFixed(1)} free</span>}
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className={`text-xs font-semibold ${overloaded ? 'text-red-700' : textColor(pct)}`}>
            {assignedCount} client{assignedCount !== 1 ? "s" : ""}
          </p>
          {overloaded && (
            <span className="inline-flex items-center rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
              OVERLOADED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL CAPACITY VIEW (existing — unchanged)
// ═══════════════════════════════════════════════════════════════════════════

function IndividualCapacityView() {
  const [employees, setEmployees] = useState<DbEmployee[]>([])
  const [clients, setClients] = useState<DbClient[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [savedAssignments, setSavedAssignments] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [empFilter, setEmpFilter] = useState<string>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [ptFilter, setPtFilter] = useState<string>("all")
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [sortCol, setSortCol] = useState<"name" | "hrs" | "employee" | "cadence">("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([empData, clientData]) => {
      const emps: DbEmployee[] = Array.isArray(empData) ? empData : []
      const cls: DbClient[] = Array.isArray(clientData.clients) ? clientData.clients : []
      setEmployees(emps)
      setClients(cls)

      const active = cls.filter(c => c.archiveStatus === 'ACTIVE')
      const init: Record<string, string> = {}
      active.forEach(c => {
        if (!c.bookkeeper) return
        const emp = emps.find(e => e.name === c.bookkeeper)
        if (emp) init[c.id] = emp.id
      })
      setAssignments(init)
      setSavedAssignments(init)
    }).catch(e => setFetchErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const activeClients = useMemo(() => clients.filter(c => c.archiveStatus === 'ACTIVE'), [clients])

  const modifiedIds = useMemo(() => {
    const s = new Set<string>()
    activeClients.forEach(c => {
      if ((assignments[c.id] ?? "") !== (savedAssignments[c.id] ?? "")) s.add(c.id)
    })
    return s
  }, [assignments, savedAssignments, activeClients])

  const hasUnsaved = modifiedIds.size > 0

  const employeeStats = useMemo(() =>
    employees.map(emp => {
      const capacityHrs = billableMonthlyHrs(emp)
      const assigned = activeClients.filter(c => assignments[c.id] === emp.id)
      const assignedHrs = r2(assigned.reduce((s, c) => s + clientMonthlyHrs(c), 0))
      return { emp, capacityHrs, assignedHrs, assignedCount: assigned.length }
    }),
  [employees, activeClients, assignments])

  const allTags = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>()
    activeClients.forEach(c => c.tags.forEach(t => seen.set(t.id, t)))
    return [...seen.values()]
  }, [activeClients])

  const visibleClients = useMemo(() => {
    let list = activeClients
    if (empFilter !== "all") list = list.filter(c => assignments[c.id] === empFilter)
    if (tagFilter !== "all") list = list.filter(c => c.tags.some(t => t.id === tagFilter))
    if (ptFilter !== "all") list = list.filter(c => (c.projectType ?? "MONTHLY_MAINTENANCE") === ptFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.harvestProjectCode.toLowerCase().includes(q)
    )
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortCol === "name") cmp = a.name.localeCompare(b.name)
      if (sortCol === "hrs") cmp = clientMonthlyHrs(a) - clientMonthlyHrs(b)
      if (sortCol === "employee") cmp = (assignments[a.id] ?? "").localeCompare(assignments[b.id] ?? "")
      if (sortCol === "cadence") cmp = a.processingCadence.localeCompare(b.processingCadence)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [activeClients, search, empFilter, tagFilter, ptFilter, assignments, sortCol, sortDir])

  function togglePlanSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
  }

  function PlanSortBtn({ col, children }: { col: typeof sortCol; children: React.ReactNode }) {
    const active = sortCol === col
    return (
      <button onClick={() => togglePlanSort(col)} className="flex items-center gap-1 hover:opacity-80 cursor-pointer select-none w-full">
        <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{children}</span>
        <span className="text-[9px] opacity-60 shrink-0">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    )
  }

  const unassignedClients = activeClients.filter(c => !assignments[c.id])
  const totalAllocatedHrs = r2(activeClients.reduce((s, c) => s + (assignments[c.id] ? clientMonthlyHrs(c) : 0), 0))

  const [savingClients, setSavingClients] = useState<Set<string>>(new Set())

  async function handleAssign(clientId: string, projectCode: string, empId: string) {
    setAssignments(prev => ({ ...prev, [clientId]: empId }))
    setSavingClients(prev => new Set(prev).add(clientId))

    try {
      const empMap: Record<string, string> = {}
      employees.forEach((e: any) => { empMap[e.id] = e.name })
      const bookkeeper = empId ? (empMap[empId] ?? null) : null

      const res = await fetch(`/api/clients/${projectCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookkeeper }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      setSavedAssignments(prev => ({ ...prev, [clientId]: empId }))
      broadcastBookkeeperChange(clientId, bookkeeper)
    } catch (err) {
      console.error('Assignment save failed:', err)
      setAssignments(prev => {
        const next = { ...prev }
        const saved = savedAssignments[clientId]
        if (saved) next[clientId] = saved
        else delete next[clientId]
        return next
      })
    } finally {
      setSavingClients(prev => { const next = new Set(prev); next.delete(clientId); return next })
    }
  }

  async function handleConfirm() {
    setSyncStatus("saving")
    try {
      const empMap: Record<string, string> = {}
      employees.forEach((e: any) => { empMap[e.id] = e.name })

      await Promise.all(
        activeClients.map(client => {
          const empId = assignments[client.id] ?? ''
          const bookkeeper = empId ? (empMap[empId] ?? null) : null
          return fetch(`/api/clients/${client.harvestProjectCode}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookkeeper }),
          })
        })
      )

      setSavedAssignments({ ...assignments })
      setSyncStatus("saved")
      setTimeout(() => setSyncStatus("idle"), 2200)

      Object.entries(assignments).forEach(([clientId, empId]) => {
        broadcastBookkeeperChange(clientId, empMap[empId] ?? null)
      })
    } catch (err) {
      console.error('Confirm sync failed:', err)
      setSyncStatus("idle")
    }
  }

  useBookkeeperSync(useCallback(({ clientId, bookkeeper }) => {
    if (!bookkeeper) {
      setAssignments(prev => { const next = { ...prev }; delete next[clientId]; return next })
      setSavedAssignments(prev => { const next = { ...prev }; delete next[clientId]; return next })
    } else {
      const emp = employees.find((e: any) => e.name === bookkeeper)
      if (emp) {
        setAssignments(prev => ({ ...prev, [clientId]: emp.id }))
        setSavedAssignments(prev => ({ ...prev, [clientId]: emp.id }))
      }
    }
  }, [employees]))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bba-action" />
    </div>
  )

  if (fetchErr) return (
    <div className="rounded-xl p-6 text-sm text-red-400 bg-red-950/30 border border-red-800">
      Failed to load capacity data: {fetchErr}
    </div>
  )

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-8 px-8 backdrop-blur" style={{ backgroundColor: 'rgba(240,238,237,0.97)', borderBottom: '1px solid #e2d8e8' }}>
        <div className="flex items-center justify-between py-4 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Capacity Planning</h1>
            <p className="mt-0.5 text-sm text-slate-400 flex items-center gap-2 flex-wrap">
              <span>{employees.length} employees · {activeClients.length} active clients</span>
              <span className="text-slate-700">·</span>
              <span className="tabular-nums">{totalAllocatedHrs} hrs/mo allocated</span>
              {hasUnsaved && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="font-medium text-amber-400">
                    {modifiedIds.size} unsaved change{modifiedIds.size !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </p>
          </div>

          <button
            onClick={handleConfirm}
            disabled={syncStatus === "saving" || Object.keys(assignments).length === 0}
            className={`
              shrink-0 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold
              transition-all duration-200 active:scale-95
              ${syncStatus === "saved"
                ? "bg-emerald-600 text-white"
                : syncStatus === "saving"
                  ? "bg-bba-action/70 text-white cursor-wait"
                  : Object.keys(assignments).length > 0
                    ? "bg-bba-action text-white hover:bg-bba-action/85 shadow-lg shadow-bba-action/20"
                    : "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
              }
            `}
          >
            {syncStatus === "saving" && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {syncStatus === "saved"
              ? "✓ Synced"
              : syncStatus === "saving"
                ? "Syncing…"
                : (
                  <>
                    Confirm &amp; Sync Changes
                    {hasUnsaved && (
                      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                        {modifiedIds.size}
                      </span>
                    )}
                  </>
                )
            }
          </button>
        </div>
      </div>

      <div className="pt-6 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Live Employee Capacity</h2>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              {(["< 70% healthy", "70–89% moderate", "90–100% near-full", "> 100% overloaded"] as const).map(label => {
                const color = label.startsWith("<") ? "bg-emerald-500" : label.startsWith("70") ? "bg-amber-500" : label.startsWith("90") ? "bg-orange-500" : "bg-red-500"
                return (
                  <span key={label} className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${color}`}/>{label}
                  </span>
                )
              })}
            </div>
          </div>

          {employees.length === 0 ? (
            <div className="rounded-xl p-10 text-center text-sm border" style={{ borderColor: '#e2d8e8', backgroundColor: '#faf8f8', color: '#8a6a90' }}>
              No employees yet — seed the employees table to see capacity cards.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {employeeStats.map(stat => (
                <CapacityCard key={stat.emp.id} {...stat} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Client Assignment Matrix</h2>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {visibleClients.length} of {activeClients.length} shown
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#b8a0c0' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-full rounded-lg bg-white border border-surface-border pl-9 pr-9 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity" style={{ color: '#b8a0c0' }}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
              className="rounded-lg bg-white border border-surface-border px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-primary">
              <option value="all">All Employees</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              <option value="">Unassigned</option>
            </select>

            <select value={ptFilter} onChange={e => setPtFilter(e.target.value)}
              className="rounded-lg bg-white border border-surface-border px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-primary">
              <option value="all">All Project Types</option>
              <option value="ANNUAL">Annual</option>
              <option value="CLEAN_UP">Clean Up</option>
              <option value="MONTHLY_MAINTENANCE">Monthly Maintenance</option>
              <option value="QBO_ONLY">QBO Only</option>
              <option value="RECURRING">Recurring</option>
            </select>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setTagFilter("all")}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all ${tagFilter === "all" ? "bg-purple-100 ring-purple-300 text-bba-action" : "ring-slate-200 text-slate-500 hover:text-slate-700"}`}>
                All Tags
              </button>
              {allTags.map(tag => (
                <button key={tag.id} onClick={() => setTagFilter(tagFilter === tag.id ? "all" : tag.id)}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                  style={{ boxShadow: `0 0 0 1px ${tagFilter === tag.id ? tag.color : tag.color + '55'}`, backgroundColor: tagFilter === tag.id ? `${tag.color}20` : 'transparent', color: tagFilter === tag.id ? tag.color : `${tag.color}99` }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}
                </button>
              ))}
            </div>
          </div>

          {(empFilter !== "all" || tagFilter !== "all" || ptFilter !== "all" || search) && (
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
              <span>Showing {visibleClients.length} of {activeClients.length} clients</span>
              <button onClick={() => { setEmpFilter("all"); setTagFilter("all"); setPtFilter("all"); setSearch("") }}
                className="text-bba-highlight hover:text-bba-highlight/80 underline underline-offset-2 transition-colors">
                Clear filters
              </button>
            </div>
          )}

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2d8e8' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bba-primary)', borderBottom: '1px solid rgba(78,0,142,0.3)' }}>
                  <th className="w-6 px-3 py-3" />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                    <PlanSortBtn col="name">Client Name</PlanSortBtn>
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                    <span className="uppercase tracking-wider font-bold text-white block w-full text-center">Project Code</span>
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">
                    <PlanSortBtn col="hrs">Monthly Hrs</PlanSortBtn>
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                    <PlanSortBtn col="employee">Assigned Employee</PlanSortBtn>
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                    <PlanSortBtn col="cadence">Cadence</PlanSortBtn>
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">
                    <span className="uppercase tracking-wider font-bold text-white block w-full text-center">% of Assignee Load</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ backgroundColor: '#faf8f8', color: '#8a6a90' }}>
                      No clients match your filters.
                    </td>
                  </tr>
                ) : visibleClients.map((client, idx) => {
                  const isModified = modifiedIds.has(client.id)
                  const assignedEmpId = assignments[client.id] ?? ""
                  const assignedEmp = employees.find(e => e.id === assignedEmpId)
                  const hours = clientMonthlyHrs(client)
                  const empCapacity = assignedEmp ? billableMonthlyHrs(assignedEmp) : 0
                  const loadPct = empCapacity > 0 ? r2((hours / empCapacity) * 100) : 0
                  const baseBg = isModified ? 'rgba(245,158,11,0.06)' : idx % 2 === 0 ? '#ffffff' : '#faf5ff'

                  return (
                    <tr
                      key={client.id}
                      className="transition-all duration-150 border-l-[3px]"
                      style={{ backgroundColor: baseBg, borderLeftColor: isModified ? 'rgba(245,158,11,0.7)' : 'transparent', borderBottom: '1px solid #f0e8f8' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = isModified ? 'rgba(245,158,11,0.1)' : '#f3e8ff' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}
                    >
                      <td className="px-3 py-3 text-center">
                        {savingClients.has(client.id)
                          ? <span title="Saving…" className="inline-block h-2 w-2 rounded-full bg-purple-400 ring-2 ring-purple-400/20 animate-pulse" />
                          : isModified
                            ? <span title="Unsaved change" className="inline-block h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20 animate-pulse" />
                            : null
                        }
                      </td>

                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{client.name}</p>
                          {client.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {client.tags.slice(0, 2).map(tag => (
                                <span key={tag.id} className="rounded-full px-1.5 py-px text-[9px] font-semibold"
                                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                          {client.harvestProjectCode}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold tabular-nums text-sm ${hours === 0 ? "text-slate-400" : "text-slate-700"}`}>
                          {hours > 0 ? `${hours}h` : "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="relative">
                          <select
                            value={assignedEmpId}
                            onChange={e => handleAssign(client.id, client.harvestProjectCode, e.target.value)}
                            disabled={savingClients.has(client.id)}
                            className={`w-full max-w-[200px] rounded-lg border py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
                              savingClients.has(client.id) ? "bg-purple-50 border-purple-200 text-bba-action"
                                : isModified ? "bg-amber-50 border-amber-300 text-amber-700"
                                : "bg-white border-surface-border text-slate-700"
                            }`}
                          >
                            <option value="">— Unassigned —</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                          </select>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {CADENCE_LABEL[client.processingCadence]}
                      </td>

                      <td className="px-4 py-3">
                        {assignedEmp && hours > 0 ? (
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full transition-all duration-500 ${barColor(loadPct)}`} style={{ width: `${Math.min(loadPct, 100)}%` }} />
                            </div>
                            <span className={`text-xs tabular-nums font-medium ${textColor(loadPct)}`}>{loadPct.toFixed(1)}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {visibleClients.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid #e2d8e8', backgroundColor: '#f9f5ff' }}>
                    <td colSpan={3} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Totals (active)</td>
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-200">
                      {r2(activeClients.reduce((s, c) => s + clientMonthlyHrs(c), 0))}h
                    </td>
                    <td colSpan={3} className="px-4 py-3 text-xs text-slate-500">
                      {activeClients.filter(c => assignments[c.id]).length} of {activeClients.length} assigned
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {unassignedClients.length > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2.5 text-xs">
              <svg className="h-4 w-4 shrink-0 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span className="text-orange-400 font-semibold">{unassignedClients.length} client{unassignedClients.length !== 1 ? "s" : ""} unassigned:</span>
              <span className="text-slate-300">{unassignedClients.map(c => c.name).join(", ")}</span>
            </div>
          )}

          {hasUnsaved && syncStatus === "idle" && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400 font-semibold">{modifiedIds.size} assignment{modifiedIds.size !== 1 ? "s" : ""} modified</span>
                <span className="text-slate-400">— capacity bars above are showing a live preview</span>
              </div>
              <button onClick={handleConfirm} className="rounded-md bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors">
                Sync now →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// POD CAPACITY VIEW (new — from /api/capacity)
// ═══════════════════════════════════════════════════════════════════════════

function PodCapacityView() {
  const [data, setData] = useState<CapacityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWarnings, setShowWarnings] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/capacity', { cache: 'no-store' })
      const d = await r.json()
      if (d.error) setError(d.error)
      else { setData(d); setError(null) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const grouped = useMemo(() => {
    if (!data) return { pods: [], podMembers: [] as EmployeeRollup[] }
    const byPod: Record<string, EmployeeRollup[]> = {}
    for (const e of data.employees) {
      if (e.podId) {
        byPod[e.podId] = byPod[e.podId] ?? []
        byPod[e.podId].push(e)
      }
    }
    const pods = data.pods.map(p => ({
      pod: p,
      members: byPod[p.podId] ?? [],
    }))
    const podMembers = pods.flatMap(p => p.members)
    return { pods, podMembers }
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#b20476' }}>
            Pod Capacity
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monthly hour capacity vs. assigned task hours per person and pod
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-bba-action border-t-transparent" />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard
              label="Pod Capacity"
              value={grouped.podMembers.reduce((s, e) => s + e.capacity, 0).toFixed(1)}
              sub={`${grouped.podMembers.length} people in ${grouped.pods.length} pod${grouped.pods.length !== 1 ? 's' : ''}`}
            />
            <StatCard
              label="Assigned Hours"
              value={grouped.podMembers.reduce((s, e) => s + e.totalAssigned, 0).toFixed(1)}
              sub={`${data.clients.length} clients`}
            />
            <StatCard
              label="Available"
              value={grouped.podMembers.reduce((s, e) => s + e.difference, 0).toFixed(1)}
              color={grouped.podMembers.reduce((s, e) => s + e.difference, 0) < 0 ? 'text-red-600' : 'text-green-700'}
              sub="Capacity − Assigned"
            />
            <StatCard
              label="QA Pool"
              value={(data.qaPool ?? 0).toFixed(2)}
              sub="Quarterly rotating QA"
            />
            <StatCard
              label="CS Pool"
              value={data.csPool.toFixed(2)}
              sub="Customer success hours"
            />
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#4e008e' }}>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white">
                    Owner
                  </th>
                  {TASK_COLS.map(c => (
                    <th key={c.key} className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white">
                    Assigned
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white">
                    Capacity
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.pods.map(({ pod, members }) => (
                  <PodBlock key={pod.podId} pod={pod} members={members} />
                ))}

                {grouped.pods.length === 0 && (
                  <tr>
                    <td colSpan={TASK_COLS.length + 4} className="px-4 py-12 text-center text-sm text-slate-400">
                      No pods configured yet. Assign employees to pods from the Employees page.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ClientPodAssignments
            assignments={data.clientAssignments}
            pods={data.pods}
            onChange={reload}
          />

          {data.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
              <button
                onClick={() => setShowWarnings(w => !w)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-amber-50 transition-colors"
              >
                <span className="text-sm font-semibold text-amber-800">
                  ⚠ {data.warnings.length} clients need attention
                </span>
                <svg className={`h-4 w-4 text-amber-600 transition-transform ${showWarnings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showWarnings && (
                <div className="border-t border-amber-200 divide-y divide-amber-100 max-h-96 overflow-y-auto">
                  {data.warnings.map((w, i) => (
                    <div key={i} className="px-5 py-3 text-xs">
                      <p className="font-semibold text-slate-700 mb-1">{w.client}</p>
                      <ul className="space-y-0.5 text-slate-600 pl-4">
                        {w.msgs.map((m, j) => <li key={j} className="list-disc">{m}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">How capacity is calculated</h2>
            <div className="text-xs text-slate-600 space-y-1.5">
              <p><strong className="text-slate-700">Employee capacity</strong> = weekly contracted hours × 4.33 weeks − admin time % − any fixed deduction (e.g. Deb&apos;s 10 hrs of non-pod QA)</p>
              <p><strong className="text-slate-700">Per client:</strong> Total Budgeted Hours − QA (0.25) − CS (0.25) − YE (0.25) − Audit = Bookkeeper&apos;s monthly budget. QA and CS go to firm-wide pools (not the pod). YE stays in the pod (protected — cannot be reallocated to bookkeeping).</p>
              <p><strong className="text-slate-700">Bank Feed hours</strong> come from the transaction bucket lookup, <strong>Recon</strong> = 0.5 hr × (bank + CC accounts), <strong>AP/AR</strong> and <strong>PR Rec</strong> are entered per client.</p>
              <p><strong className="text-slate-700">Pod 1</strong> defaults: Deb owns bookkeeping. Jada owns Bank Feed, Recon, AP/AR, PR Rec, YE. Rec can be overridden per client (e.g. Deb&apos;s one exception client).</p>
              <p><strong className="text-slate-700">Excluded from capacity:</strong> QBO-only clients. <strong>Cleanup</strong> clients: hours = price ÷ $125 ÷ duration in months.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PodBlock({ pod, members }: { pod: PodRollup; members: EmployeeRollup[] }) {
  return (
    <>
      <tr style={{ backgroundColor: 'rgba(78,0,142,0.08)', borderTop: '2px solid rgba(78,0,142,0.15)', borderBottom: '1px solid rgba(78,0,142,0.15)' }}>
        <td className="px-4 py-3 font-bold text-slate-800">
          {pod.name}
          <span className="ml-2 text-[10px] font-normal text-slate-500">({members.length} people)</span>
        </td>
        {TASK_COLS.map(c => (
          <td key={c.key} className="px-3 py-3 text-right tabular-nums font-semibold text-slate-700">
            {fmt(pod.byTask[c.key])}
          </td>
        ))}
        <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-800">
          {pod.totalAssigned.toFixed(2)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-800">
          {pod.capacity.toFixed(2)}
        </td>
        <td className={`px-3 py-3 text-right tabular-nums font-bold ${diffColor(pod.difference)}`}>
          {pod.difference.toFixed(2)}
        </td>
      </tr>

      {members.map((e, i) => (
        <EmployeeRow key={e.employeeId} emp={e} rowIndex={i} inPod />
      ))}
    </>
  )
}

function EmployeeRow({ emp, rowIndex, inPod }: { emp: EmployeeRollup; rowIndex: number; inPod?: boolean }) {
  const bg = rowIndex % 2 === 0 ? '#ffffff' : '#faf5ff'
  return (
    <tr
      style={{ backgroundColor: bg, borderBottom: '1px solid #f0e8f8' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3e8ff' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = bg }}
    >
      <td className={`px-4 py-3 ${inPod ? 'pl-8 text-slate-600' : 'font-medium text-slate-800'}`}>
        {inPod && <span className="text-slate-300 mr-2">└</span>}
        {emp.name}
      </td>
      {TASK_COLS.map(c => (
        <td key={c.key} className="px-3 py-3 text-right tabular-nums text-slate-700">
          {fmt(emp.byTask[c.key])}
        </td>
      ))}
      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
        {emp.totalAssigned > 0 ? emp.totalAssigned.toFixed(2) : '—'}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-slate-700 font-semibold">
        {emp.capacity.toFixed(2)}
      </td>
      <td className={`px-3 py-3 text-right tabular-nums font-semibold ${diffColor(emp.difference)}`}>
        {emp.difference.toFixed(2)}
      </td>
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN — TAB SWITCHER
// ═══════════════════════════════════════════════════════════════════════════

export default function CapacityPlanningPage() {
  const [tab, setTab] = useState<'individual' | 'pod'>('individual')

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        <TabButton active={tab === 'individual'} onClick={() => setTab('individual')}>
          Individual Capacity
        </TabButton>
        <TabButton active={tab === 'pod'} onClick={() => setTab('pod')}>
          Pod Capacity
        </TabButton>
      </div>

      {tab === 'individual' && <IndividualCapacityView />}
      {tab === 'pod' && <PodCapacityView />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 text-sm font-semibold transition-colors relative"
      style={{
        color: active ? '#4e008e' : '#64748b',
        borderBottom: active ? '2px solid #4e008e' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {children}
    </button>
  )
}

function ClientPodAssignments({
  assignments,
  pods,
  onChange,
}: {
  assignments: ClientAssignment[]
  pods: PodRollup[]
  onChange: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'unassigned' | string>('unassigned')
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assignments.filter(a => {
      if (filter === 'unassigned' && a.assignedPodId != null) return false
      if (filter !== 'unassigned' && filter !== 'all' && a.assignedPodId !== filter) return false
      if (q && !a.name.toLowerCase().includes(q) && !(a.bookkeeper ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [assignments, filter, search])

  const unassignedCount = assignments.filter(a => !a.assignedPodId).length

  const setPod = async (clientId: string, podId: string | null) => {
    setSavingId(clientId)
    try {
      const r = await fetch(`/api/clients/${clientId}/pod`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedPodId: podId }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert(j.error ?? 'Failed to assign pod')
      } else {
        onChange()
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Client → Pod Assignments</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {unassignedCount > 0
              ? `${unassignedCount} client${unassignedCount === 1 ? '' : 's'} not yet assigned to a pod`
              : 'All clients are assigned to a pod'}
          </p>
        </div>
        <svg className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <>
          <div className="border-t border-slate-200 px-5 py-3 flex items-center gap-2 flex-wrap bg-slate-50/50">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs focus:border-[#4e008e] focus:outline-none focus:ring-1 focus:ring-[#4e008e]"
            >
              <option value="unassigned">Unassigned only ({unassignedCount})</option>
              <option value="all">All clients ({assignments.length})</option>
              {pods.map(p => (
                <option key={p.podId} value={p.podId}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs w-40 focus:border-[#4e008e] focus:outline-none focus:ring-1 focus:ring-[#4e008e]"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              {filter === 'unassigned' ? 'No unassigned clients.' : 'No clients match.'}
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">Client</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">Bookkeeper</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 w-48">Pod</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(a => (
                    <tr key={a.id} className="hover:bg-purple-50/30">
                      <td className="px-4 py-2 text-slate-800">{a.name}</td>
                      <td className="px-4 py-2 text-slate-600">{a.bookkeeper ?? <span className="text-slate-400 italic">—</span>}</td>
                      <td className="px-4 py-2">
                        <select
                          value={a.assignedPodId ?? ''}
                          onChange={(e) => setPod(a.id, e.target.value || null)}
                          disabled={savingId === a.id}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-[#4e008e] focus:outline-none focus:ring-1 focus:ring-[#4e008e] disabled:opacity-50"
                        >
                          <option value="">— Unassigned —</option>
                          {pods.map(p => (
                            <option key={p.podId} value={p.podId}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
