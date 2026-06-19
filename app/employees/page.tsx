'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { EMPLOYEES, CLIENTS, SOWS, TIME_LOGS, type EmployeeRole } from '@/lib/mock-data'

// ── Constants ────────────────────────────────────────────────────────────────
const WEEKS_PER_MONTH = 52 / 12
const BILLABLE_FACTOR = 0.80

// ── Column definitions ────────────────────────────────────────────────────────
type ColKey  = 'employee' | 'clients' | 'totalHrs' | 'capacity' | 'load'
type SortKey = ColKey

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: 'employee', label: 'Employee'          },
  { key: 'clients',  label: 'Assigned Clients'  },
  { key: 'totalHrs', label: 'Total Target Hrs'  },
  { key: 'capacity', label: 'Billable Capacity' },
  { key: 'load',     label: 'Load'              },
]
const DEFAULT_COL_ORDER: ColKey[] = ALL_COLS.map(c => c.key)

// ── Dark purple palette ───────────────────────────────────────────────────────
const BG_CARD_HEADER = 'var(--bba-primary)'
const BG_TABLE       = '#ffffff'
const BG_THEAD       = '#f9f5ff'
const ROW_ODD        = '#ffffff'
const ROW_EVEN       = '#faf5ff'
const ROW_HOVER      = '#f3e8ff'

// ── Helpers ───────────────────────────────────────────────────────────────────
function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100 }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function billableMonthly(emp: typeof EMPLOYEES[0]) { return r2(emp.contractedHours * BILLABLE_FACTOR * WEEKS_PER_MONTH) }

function barColor(pct: number) {
  if (pct > 100) return 'bg-red-500'
  if (pct >= 90)  return 'bg-orange-500'
  if (pct >= 70)  return 'bg-amber-500'
  return 'bg-bba-primary'
}
function textColor(pct: number) {
  if (pct > 100) return 'text-red-400'
  if (pct >= 90)  return 'text-orange-400'
  if (pct >= 70)  return 'text-amber-400'
  return 'text-bba-secondary'
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const active = CLIENTS.filter(c => c.archiveStatus === 'ACTIVE')

  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | EmployeeRole>('all')
  const [colOrder,   setColOrder]   = useState<ColKey[]>(DEFAULT_COL_ORDER)
  const [sortKey,    setSortKey]    = useState<SortKey>('employee')
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('asc')

  const q = search.trim().toLowerCase()

  const filteredEmployees = useMemo(() =>
    EMPLOYEES.filter(emp => {
      if (roleFilter !== 'all' && emp.role !== roleFilter) return false
      if (q && !emp.name.toLowerCase().includes(q)) return false
      return true
    }),
  [q, roleFilter])

  const employeeStats = useMemo(() =>
    filteredEmployees.map(emp => {
      const capacityHrs     = billableMonthly(emp)
      const assignedClients = active.filter(c => c.accountantName === emp.name)
      const assignedHrs     = r2(assignedClients.reduce((s, c) => {
        const sow = SOWS.find(sw => sw.clientId === c.id)
        return s + (sow?.targetHours ?? 0)
      }, 0))
      const utilPct   = capacityHrs > 0 ? r2((assignedHrs / capacityHrs) * 100) : 0
      const myLogs    = TIME_LOGS.filter(l => l.employeeId === emp.id)
      const loggedHrs = r2(myLogs.reduce((s, l) => s + l.hoursLogged, 0))
      const laborCost = r2(loggedHrs * emp.effectiveHourlyRate)
      return { emp, capacityHrs, assignedClients, assignedHrs, utilPct, loggedHrs, laborCost }
    }),
  [filteredEmployees])

  const sortedStats = useMemo(() =>
    [...employeeStats].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'employee') cmp = a.emp.name.localeCompare(b.emp.name)
      if (sortKey === 'clients')  cmp = a.assignedClients.length - b.assignedClients.length
      if (sortKey === 'totalHrs') cmp = a.assignedHrs - b.assignedHrs
      if (sortKey === 'capacity') cmp = a.capacityHrs - b.capacityHrs
      if (sortKey === 'load')     cmp = a.utilPct - b.utilPct
      return sortDir === 'asc' ? cmp : -cmp
    }),
  [employeeStats, sortKey, sortDir])

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = Array.from(colOrder)
    const [removed] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, removed)
    setColOrder(next)
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function SortBtn({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const isActive = sortKey === k
    return (
      <button
        onClick={e => { e.stopPropagation(); toggleSort(k) }}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer select-none w-full"
      >
        <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{children}</span>
        <span className="text-[9px] opacity-60 shrink-0">{isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    )
  }

  function renderCell(stat: typeof sortedStats[0], key: ColKey): React.ReactNode {
    const { emp, assignedClients, assignedHrs, capacityHrs, utilPct, loggedHrs, laborCost } = stat
    switch (key) {
      case 'employee':
        return (
          <td key={key} className="px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-bba-primary shrink-0"
                style={{ backgroundColor: 'rgba(78,0,142,0.1)' }}
              >
                {initials(emp.name)}
              </div>
              <div>
                <span className="font-medium text-slate-800 block">{emp.name}</span>
                <span
                  className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold"
                  style={{
                    backgroundColor: emp.role === 'contractor' ? 'rgba(251,191,36,0.15)' : 'rgba(78,0,142,0.08)',
                    color: emp.role === 'contractor' ? '#d97706' : '#6a4c80',
                  }}
                >
                  {emp.role === 'contractor' ? 'Contractor' : 'Employee'}
                </span>
              </div>
            </div>
          </td>
        )
      case 'clients':
        return (
          <td key={key} className="px-5 py-3 tabular-nums" style={{ color: '#4a2870' }}>
            {assignedClients.length}
          </td>
        )
      case 'totalHrs':
        return (
          <td key={key} className="px-5 py-3 tabular-nums" style={{ color: '#4a2870' }}>
            {assignedHrs.toFixed(1)} hrs
          </td>
        )
      case 'capacity':
        return (
          <td key={key} className="px-5 py-3 tabular-nums" style={{ color: '#4a2870' }}>
            {capacityHrs.toFixed(1)} hrs/mo
          </td>
        )
      case 'load':
        return (
          <td key={key} className="px-5 py-3">
            <span className={`text-xs font-semibold tabular-nums ${utilPct > 100 ? 'text-red-400' : 'text-emerald-400'}`}>
              {utilPct.toFixed(1)}% {utilPct > 100 ? '⚠️' : ''}
            </span>
          </td>
        )
      default:
        return null
    }
  }

  const anyFilter = roleFilter !== 'all' || !!q

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Employees</h1>
          <p className="mt-1 text-sm text-slate-400">
            {EMPLOYEES.length} team members · capacity and assignment overview
          </p>
        </div>
        <Link
          href="/employees/planning"
          className="inline-flex items-center gap-2 rounded-lg bg-bba-primary px-4 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Capacity Planning
        </Link>
      </div>

      {/* ── Search + Role filter ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#b8a0c0' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent border"
            style={{ backgroundColor: '#ffffff', borderColor: '#e2d8e8' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity" style={{ color: '#b8a0c0' }}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as 'all' | EmployeeRole)}
          className="rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-primary border border-surface-border bg-white"
          style={{ backgroundColor: '#ffffff', borderColor: '#e2d8e8' }}
        >
          <option value="all">All Roles</option>
          <option value="employee">Employees</option>
          <option value="contractor">Contractors</option>
        </select>

        {anyFilter && (
          <button
            onClick={() => { setSearch(''); setRoleFilter('all') }}
            className="text-xs underline underline-offset-2 transition-colors"
            style={{ color: '#b20476' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Employee Capacity Cards ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {employeeStats.map(({ emp, utilPct, assignedClients, capacityHrs, assignedHrs, loggedHrs, laborCost }) => {
          const over = utilPct > 100
          const borderCol = over ? 'border-red-500/50' : utilPct >= 90 ? 'border-orange-500/40' : utilPct >= 70 ? 'border-amber-500/30' : ''
          return (
            <div
              key={emp.id}
              className={`rounded-xl border p-5 space-y-4 ${borderCol}`}
              style={{ backgroundColor: over ? 'rgba(239,68,68,0.06)' : '#ffffff', borderColor: borderCol ? undefined : '#e2d8e8' }}
            >
              {/* ── Avatar + name ── */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${over ? 'text-red-900' : 'text-bba-primary'}`}
                  style={{ backgroundColor: over ? 'rgba(239,68,68,0.18)' : 'rgba(78,0,142,0.1)' }}
                >
                  {initials(emp.name)}
                </div>
                <div>
                  <p className={`font-semibold ${over ? 'text-red-950' : 'text-slate-800'}`}>{emp.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs" style={{ color: over ? '#7f1d1d' : '#8a6a90' }}>
                      {emp.contractedHours}h/wk · 80% billable · ${emp.effectiveHourlyRate}/hr
                    </p>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: over
                          ? 'rgba(127,29,29,0.12)'
                          : emp.role === 'contractor' ? 'rgba(251,191,36,0.12)' : 'rgba(212,190,190,0.1)',
                        color: over
                          ? '#7f1d1d'
                          : emp.role === 'contractor' ? '#fbbf24' : '#d4bebe',
                      }}
                    >
                      {emp.role === 'contractor' ? 'Contractor' : 'Employee'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Utilization bar ── */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: over ? '#7f1d1d' : '#8a6a90' }}>Capacity Utilization</span>
                  {/* Keep pct in bold crimson — switch to dark red on light bg */}
                  <span className={`font-semibold tabular-nums ${over ? 'text-red-700' : textColor(utilPct)}`}>
                    {utilPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: over ? 'rgba(239,68,68,0.2)' : 'rgba(78,0,142,0.1)' }}>
                  <div className={`h-full rounded-full transition-all ${barColor(utilPct)}`} style={{ width: `${Math.min(utilPct, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] mt-1" style={{ color: over ? '#991b1b' : '#b8a0c0' }}>
                  <span>{assignedHrs.toFixed(1)} hrs assigned</span>
                  <span>{capacityHrs.toFixed(1)} hrs capacity</span>
                </div>
              </div>

              {/* ── Stats grid ── */}
              <div
                className="grid grid-cols-3 gap-2 pt-3"
                style={{ borderTop: `1px solid ${over ? 'rgba(127,29,29,0.2)' : '#f0e8f8'}` }}
              >
                {[
                  { label: 'Clients',    value: assignedClients.length.toString() },
                  { label: 'Hrs Logged', value: loggedHrs.toFixed(1) },
                  { label: 'Labor Cost', value: `$${(laborCost / 1000).toFixed(1)}k` },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={`text-sm font-bold tabular-nums ${over ? 'text-red-900' : 'text-bba-primary'}`}>{s.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: over ? '#7f1d1d' : '#8a6a90' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {filteredEmployees.length === 0 && (
          <div className="col-span-full rounded-xl p-8 text-center text-sm" style={{ border: '1px solid #e2d8e8', backgroundColor: '#faf8f8', color: '#8a6a90' }}>
            No team members match your filters.
          </div>
        )}
      </div>

      {/* ── Client Assignments Table with DnD + Sort ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2d8e8' }}>

        <div
          className="border-b px-5 py-3.5 flex items-center justify-between"
          style={{ backgroundColor: BG_CARD_HEADER, borderColor: 'rgba(78,0,142,0.2)' }}
        >
          <h3 className="text-sm font-semibold text-white">Client Assignments</h3>
          <span className="text-[10px] font-medium text-white">Drag headers to reorder · click to sort</span>
        </div>

        <div className="overflow-x-auto" style={{ backgroundColor: BG_TABLE }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <table className="w-full text-sm">
              <Droppable droppableId="emp-cols" direction="horizontal">
                {(dp) => (
                  <thead>
                    <tr
                      ref={dp.innerRef}
                      {...dp.droppableProps}
                      style={{ backgroundColor: BG_THEAD, borderBottom: '1px solid rgba(212,190,190,0.13)' }}
                    >
                      {colOrder.map((key, idx) => {
                        const col = ALL_COLS.find(c => c.key === key)!
                        return (
                          <Draggable key={key} draggableId={key} index={idx}>
                            {(dragP, snap) => (
                              <th
                                ref={dragP.innerRef}
                                {...dragP.draggableProps}
                                {...dragP.dragHandleProps}
                                className={`px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-opacity ${snap.isDragging ? 'opacity-50' : ''}`}
                                style={dragP.draggableProps.style}
                              >
                                <SortBtn k={key}>{col.label}</SortBtn>
                              </th>
                            )}
                          </Draggable>
                        )
                      })}
                      <th style={{ padding: 0, border: 'none' }}>{dp.placeholder}</th>
                    </tr>
                  </thead>
                )}
              </Droppable>
              <tbody>
                {sortedStats.length === 0 ? (
                  <tr>
                    <td colSpan={colOrder.length} className="px-5 py-10 text-center text-sm" style={{ color: 'rgba(212,190,190,0.4)' }}>
                      No employees match your filters.
                    </td>
                  </tr>
                ) : sortedStats.map((stat, i) => {
                  const baseBg = i % 2 === 0 ? ROW_ODD : ROW_EVEN
                  return (
                    <tr
                      key={stat.emp.id}
                      style={{ backgroundColor: baseBg, borderBottom: '1px solid rgba(212,190,190,0.07)' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = ROW_HOVER }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}
                    >
                      {colOrder.map(key => renderCell(stat, key))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DragDropContext>
        </div>
      </div>
    </div>
  )
}
