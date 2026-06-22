"use client";

import { useState, useMemo, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  tags: { id: string; name: string; color: string }[]
  sows: { billingType: string; fixedMonthlyRate: number | null; billingRate: number | null; targetHours: number | null }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKS_PER_MONTH = 52 / 12;
const BILLABLE_FACTOR = 0.80;

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: "Weekly", BIWEEKLY: "Bi-Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly",
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function initials(name: string) { return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(); }

function billableMonthlyHrs(emp: DbEmployee): number {
  return r2(Number(emp.contractedHours) * BILLABLE_FACTOR * WEEKS_PER_MONTH);
}
function billableWeeklyHrs(emp: DbEmployee): number {
  return r2(Number(emp.contractedHours) * BILLABLE_FACTOR);
}
function clientMonthlyHrs(client: DbClient): number {
  return client.sows?.[0]?.targetHours ?? 0;
}

// ─── Color scale ──────────────────────────────────────────────────────────────
function barColor(pct: number) {
  if (pct > 100) return "bg-red-500";
  if (pct >= 90)  return "bg-orange-500";
  if (pct >= 70)  return "bg-amber-500";
  return "bg-bba-primary";
}
function textColor(pct: number) {
  if (pct > 100) return "text-red-400";
  if (pct >= 90)  return "text-orange-400";
  if (pct >= 70)  return "text-amber-400";
  return "text-bba-secondary";
}
function cardBorder(pct: number) {
  if (pct > 100) return "border-red-500/50";
  if (pct >= 90)  return "border-orange-500/40";
  if (pct >= 70)  return "border-amber-500/30";
  return "border-slate-700/60";
}

// ─── CapacityCard ─────────────────────────────────────────────────────────────
function CapacityCard({ emp, assignedHrs, assignedCount, capacityHrs }: {
  emp: DbEmployee
  assignedHrs: number
  assignedCount: number
  capacityHrs: number
}) {
  const pct        = capacityHrs > 0 ? r2((assignedHrs / capacityHrs) * 100) : 0;
  const overloaded = pct > 100;
  const remaining  = r2(Math.max(capacityHrs - assignedHrs, 0));

  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-300 ${cardBorder(pct)}`}
      style={{ backgroundColor: pct > 100 ? 'rgba(239,68,68,0.06)' : pct >= 90 ? 'rgba(249,115,22,0.05)' : pct >= 70 ? 'rgba(245,158,11,0.05)' : '#ffffff' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${overloaded ? 'bg-red-200 text-red-900' : 'bg-slate-700 text-slate-200'}`}>
            {initials(emp.name)}
          </div>
          <div>
            <p className={`text-sm font-semibold leading-tight ${overloaded ? 'text-red-950' : 'text-slate-100'}`}>{emp.name}</p>
            <p className={`text-[11px] mt-0.5 ${overloaded ? 'text-red-800' : 'text-slate-500'}`}>
              {emp.contractedHours}h/wk · 80% billable
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className={`text-xl font-bold tabular-nums leading-tight ${overloaded ? 'text-red-700' : textColor(pct)}`}>
            {pct.toFixed(1)}%
          </p>
          <p className={`text-[10px] ${overloaded ? 'text-red-800' : 'text-slate-500'}`}>utilized</p>
        </div>
      </div>

      <div className={`h-3 w-full overflow-hidden rounded-full mb-2 ${overloaded ? 'bg-red-200/70' : 'bg-slate-700/80'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <div className="flex items-end justify-between mt-2.5">
        <div className="space-y-0.5 text-xs">
          <p className="tabular-nums">
            <span className={`font-semibold ${overloaded ? 'text-slate-100' : 'text-slate-200'}`}>{assignedHrs.toFixed(1)}</span>
            <span className={overloaded ? 'text-red-800' : 'text-slate-500'}> / {capacityHrs.toFixed(1)} hrs/mo</span>
          </p>
          <p className={overloaded ? 'text-red-800' : 'text-slate-500'}>
            {billableWeeklyHrs(emp).toFixed(1)} billable hrs/wk
            {!overloaded && <span className="text-slate-600"> · {remaining.toFixed(1)} free</span>}
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className={`text-xs font-semibold ${overloaded ? 'text-red-700' : textColor(pct)}`}>
            {assignedCount} client{assignedCount !== 1 ? "s" : ""}
          </p>
          {overloaded && (
            <span className="inline-flex items-center rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white">
              OVERLOADED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CapacityPlanningPage() {
  const [employees,  setEmployees]  = useState<DbEmployee[]>([])
  const [clients,    setClients]    = useState<DbClient[]>([])
  const [loading,    setLoading]    = useState(true)
  const [fetchErr,   setFetchErr]   = useState<string | null>(null)

  const [assignments,      setAssignments]      = useState<Record<string, string>>({})
  const [savedAssignments, setSavedAssignments] = useState<Record<string, string>>({})
  const [search,           setSearch]           = useState("")
  const [empFilter,        setEmpFilter]        = useState<string>("all")
  const [tagFilter,        setTagFilter]        = useState<string>("all")
  const [ptFilter,         setPtFilter]         = useState<string>("all")
  const [syncStatus,       setSyncStatus]       = useState<"idle" | "saving" | "saved">("idle")
  const [sortCol,          setSortCol]          = useState<"name" | "hrs" | "employee" | "cadence">("name")
  const [sortDir,          setSortDir]          = useState<"asc" | "desc">("asc")

  // ── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]).then(([empData, clientData]) => {
      const emps: DbEmployee[] = Array.isArray(empData) ? empData : []
      const cls: DbClient[]    = Array.isArray(clientData.clients) ? clientData.clients : []
      setEmployees(emps)
      setClients(cls)

      // Build initial assignments from accountantName → employee id
      const active = cls.filter(c => c.archiveStatus === 'ACTIVE')
      const init: Record<string, string> = {}
      active.forEach(c => {
        const emp = emps.find(e => e.name === c.accountantName)
        if (emp) init[c.id] = emp.id
      })
      setAssignments(init)
      setSavedAssignments(init)
    }).catch(e => setFetchErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const activeClients = useMemo(() => clients.filter(c => c.archiveStatus === 'ACTIVE'), [clients])

  // ── Modified ids ────────────────────────────────────────────────────────────
  const modifiedIds = useMemo(() => {
    const s = new Set<string>()
    activeClients.forEach(c => {
      if ((assignments[c.id] ?? "") !== (savedAssignments[c.id] ?? "")) s.add(c.id)
    })
    return s
  }, [assignments, savedAssignments, activeClients])

  const hasUnsaved = modifiedIds.size > 0

  // ── Employee stats ──────────────────────────────────────────────────────────
  const employeeStats = useMemo(() =>
    employees.map(emp => {
      const capacityHrs   = billableMonthlyHrs(emp)
      const assigned      = activeClients.filter(c => assignments[c.id] === emp.id)
      const assignedHrs   = r2(assigned.reduce((s, c) => s + clientMonthlyHrs(c), 0))
      return { emp, capacityHrs, assignedHrs, assignedCount: assigned.length }
    }),
  [employees, activeClients, assignments])

  // ── Tags ────────────────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>()
    activeClients.forEach(c => c.tags.forEach(t => seen.set(t.id, t)))
    return [...seen.values()]
  }, [activeClients])

  // ── Filtered clients ────────────────────────────────────────────────────────
  const visibleClients = useMemo(() => {
    let list = activeClients
    if (empFilter !== "all") list = list.filter(c => assignments[c.id] === empFilter)
    if (tagFilter !== "all") list = list.filter(c => c.tags.some(t => t.id === tagFilter))
    if (ptFilter  !== "all") list = list.filter(c => (c.projectType ?? "MONTHLY_MAINTENANCE") === ptFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.harvestProjectCode.toLowerCase().includes(q)
    )
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortCol === "name")     cmp = a.name.localeCompare(b.name)
      if (sortCol === "hrs")      cmp = clientMonthlyHrs(a) - clientMonthlyHrs(b)
      if (sortCol === "employee") cmp = (assignments[a.id] ?? "").localeCompare(assignments[b.id] ?? "")
      if (sortCol === "cadence")  cmp = a.processingCadence.localeCompare(b.processingCadence)
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

  const unassignedClients  = activeClients.filter(c => !assignments[c.id])
  const totalAllocatedHrs  = r2(activeClients.reduce((s, c) => s + (assignments[c.id] ? clientMonthlyHrs(c) : 0), 0))

  function handleAssign(clientId: string, empId: string) {
    setAssignments(prev => ({ ...prev, [clientId]: empId }))
  }

  async function handleConfirm() {
    setSyncStatus("saving")
    try {
      await fetch('/api/assignments/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })
      setSavedAssignments({ ...assignments })
      setSyncStatus("saved")
      setTimeout(() => setSyncStatus("idle"), 2200)
    } catch {
      setSyncStatus("idle")
    }
  }

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bba-primary" />
    </div>
  )

  if (fetchErr) return (
    <div className="rounded-xl p-6 text-sm text-red-400 bg-red-950/30 border border-red-800">
      Failed to load capacity data: {fetchErr}
    </div>
  )

  return (
    <div>
      {/* ── Sticky header ────────────────────────────────────────────────── */}
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
            disabled={!hasUnsaved || syncStatus === "saving"}
            className={`
              shrink-0 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold
              transition-all duration-200 active:scale-95
              ${syncStatus === "saved"
                ? "bg-emerald-600 text-white"
                : hasUnsaved
                  ? "bg-bba-primary text-white hover:bg-bba-primary/85 shadow-lg shadow-bba-primary/20"
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
        {/* ── Capacity cards ────────────────────────────────────────────── */}
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

        {/* ── Assignment matrix ─────────────────────────────────────────── */}
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
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all ${tagFilter === "all" ? "bg-slate-600 ring-slate-500 text-slate-100" : "ring-slate-700 text-slate-400 hover:text-slate-200"}`}>
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
                  const isModified    = modifiedIds.has(client.id)
                  const assignedEmpId = assignments[client.id] ?? ""
                  const assignedEmp   = employees.find(e => e.id === assignedEmpId)
                  const hours         = clientMonthlyHrs(client)
                  const empCapacity   = assignedEmp ? billableMonthlyHrs(assignedEmp) : 0
                  const loadPct       = empCapacity > 0 ? r2((hours / empCapacity) * 100) : 0
                  const baseBg        = isModified ? 'rgba(245,158,11,0.06)' : idx % 2 === 0 ? '#ffffff' : '#faf5ff'

                  return (
                    <tr
                      key={client.id}
                      className="transition-all duration-150 border-l-[3px]"
                      style={{ backgroundColor: baseBg, borderLeftColor: isModified ? 'rgba(245,158,11,0.7)' : 'transparent', borderBottom: '1px solid #f0e8f8' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = isModified ? 'rgba(245,158,11,0.1)' : '#f3e8ff' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}
                    >
                      <td className="px-3 py-3 text-center">
                        {isModified && <span title="Unsaved change" className="inline-block h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20 animate-pulse" />}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700/80 text-[10px] font-bold text-slate-300">
                            {initials(client.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-100 truncate">{client.name}</p>
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
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
                          {client.harvestProjectCode}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold tabular-nums text-sm ${hours === 0 ? "text-slate-600" : "text-slate-200"}`}>
                          {hours > 0 ? `${hours}h` : "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={assignedEmpId}
                          onChange={e => handleAssign(client.id, e.target.value)}
                          className={`w-full max-w-[200px] rounded-lg border py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent transition-colors cursor-pointer ${isModified ? "bg-amber-500/10 border-amber-500/40 text-amber-200" : "bg-white border-surface-border text-slate-700"}`}
                        >
                          <option value="">— Unassigned —</option>
                          {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {CADENCE_LABEL[client.processingCadence]}
                      </td>

                      <td className="px-4 py-3">
                        {assignedEmp && hours > 0 ? (
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
                              <div className={`h-full rounded-full transition-all duration-500 ${barColor(loadPct)}`} style={{ width: `${Math.min(loadPct, 100)}%` }} />
                            </div>
                            <span className={`text-xs tabular-nums font-medium ${textColor(loadPct)}`}>{loadPct.toFixed(1)}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
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