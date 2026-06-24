'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import AddEmployeePanel from '@/app/components/AddEmployeePanel'
import EmployeeDrawer   from '@/app/components/EmployeeDrawer'

interface Employee {
  id: string; name: string; email: string | null; title: string | null
  rateType: string; salary: number | null
  contractedHours: number; adminTimePercent: number; effectiveHourlyRate: number
  hubAccess: boolean; invitedAt: string | null
  createdAt?: string; updatedAt?: string
}

const WEEKS_PER_MONTH  = 4.33
const BILLABLE_FACTOR  = 0.80

type ColKey  = 'employee' | 'title' | 'email' | 'rate' | 'contractedHours' | 'hub'
type SortKey = ColKey

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: 'employee',        label: 'Employee'         },
  { key: 'title',           label: 'Title'            },
  { key: 'email',           label: 'Email'            },
  { key: 'rate',            label: 'Hourly Rate'      },
  { key: 'contractedHours', label: 'Contracted Hrs'   },
  { key: 'hub',             label: 'Hub Access'       },
]
const DEFAULT_COL_ORDER: ColKey[] = ALL_COLS.map(c => c.key)

function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100 }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() }
function billableMonthly(emp: Employee) {
  return r2(Number(emp.contractedHours) * BILLABLE_FACTOR * WEEKS_PER_MONTH)
}

export default function EmployeesPage() {
  const searchParams   = useSearchParams()
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [colOrder,     setColOrder]     = useState<ColKey[]>(DEFAULT_COL_ORDER)
  const [sortKey,      setSortKey]      = useState<SortKey>('employee')
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc')
  const [addOpen,      setAddOpen]      = useState(false)
  const [selectedEmp,  setSelectedEmp]  = useState<Employee | null>(null)

  const loadEmployees = useCallback(() => {
    setLoading(true)
    fetch('/api/employees')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data)
          // Auto-open drawer if ?open=<id> is in the URL
          const openId = searchParams?.get('open')
          if (openId) {
            const emp = data.find((e: Employee) => e.id === openId)
            if (emp) setSelectedEmp(emp)
          }
        }
        else setError(data.error ?? 'Unknown error')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadEmployees() }, [loadEmployees])

  const q = search.trim().toLowerCase()

  const filtered = useMemo(() =>
    employees.filter(e => !q || e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q)),
  [employees, q])

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'employee')        cmp = a.name.localeCompare(b.name)
      if (sortKey === 'title')           cmp = (a.title ?? '').localeCompare(b.title ?? '')
      if (sortKey === 'email')           cmp = (a.email ?? '').localeCompare(b.email ?? '')
      if (sortKey === 'rate')            cmp = Number(a.effectiveHourlyRate) - Number(b.effectiveHourlyRate)
      if (sortKey === 'contractedHours') cmp = Number(a.contractedHours) - Number(b.contractedHours)
      if (sortKey === 'hub')             cmp = Number(a.hubAccess) - Number(b.hubAccess)
      return sortDir === 'asc' ? cmp : -cmp
    }),
  [filtered, sortKey, sortDir])

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

  function renderCell(emp: Employee, key: ColKey): React.ReactNode {
    switch (key) {
      case 'employee':
        return (
          <td key={key} className="px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-bba-primary shrink-0"
                style={{ backgroundColor: 'rgba(78,0,142,0.1)' }}>
                {initials(emp.name)}
              </div>
              <span className="font-medium text-slate-800">{emp.name}</span>
            </div>
          </td>
        )
      case 'title':
        return <td key={key} className="px-5 py-3 text-sm text-slate-600">{emp.title ?? <span className="text-slate-300">—</span>}</td>
      case 'email':
        return <td key={key} className="px-5 py-3 text-xs text-slate-500">{emp.email ?? <span className="text-slate-300">—</span>}</td>
      case 'rate':
        return (
          <td key={key} className="px-5 py-3">
            <span className="text-sm font-semibold text-purple-700 tabular-nums">
              ${Number(emp.effectiveHourlyRate).toFixed(2)}/hr
            </span>
            {emp.rateType === 'salary' && <span className="ml-1 text-[10px] text-slate-400">salary</span>}
          </td>
        )
      case 'contractedHours':
        return <td key={key} className="px-5 py-3 text-sm tabular-nums text-slate-600">{emp.contractedHours} hrs/wk</td>
      case 'hub':
        return (
          <td key={key} className="px-5 py-3">
            {emp.hubAccess
              ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Active</span>
              : <span className="text-[10px] text-slate-400">No access</span>}
          </td>
        )
      default: return null
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bba-primary" />
    </div>
  )

  if (error) return (
    <div className="rounded-xl p-6 text-sm text-red-600 bg-red-50 border border-red-200">
      Failed to load employees: {error}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {employees.length} team member{employees.length !== 1 ? 's' : ''} · click a row to view profile
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/employees/planning"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Capacity Planning
          </Link>
          <button onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-bba-primary px-4 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </button>
        </div>
      </div>

      {/* Employee cards */}
      {employees.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => {
            const capacity = billableMonthly(emp)
            return (
              <button key={emp.id} onClick={() => setSelectedEmp(emp)}
                className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:shadow-md hover:border-purple-200 transition-all space-y-3 group">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-purple-700"
                    style={{ backgroundColor: 'rgba(109,40,217,0.1)' }}>
                    {initials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">{emp.name}</p>
                    <p className="text-xs text-slate-400 truncate">{emp.title ?? 'No title'}</p>
                  </div>
                  {emp.hubAccess && (
                    <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" title="Hub access active" />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div>
                    <p className="text-sm font-bold text-purple-700">${Number(emp.effectiveHourlyRate).toFixed(0)}/hr</p>
                    <p className="text-[10px] text-slate-400">Cost Rate</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{emp.contractedHours}h</p>
                    <p className="text-[10px] text-slate-400">Hrs/Week</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">{capacity.toFixed(0)}h</p>
                    <p className="text-[10px] text-slate-400">Cap/Mo</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      {employees.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-slate-200">
          <div className="px-5 py-3.5 flex items-center justify-between border-b"
            style={{ backgroundColor: 'var(--bba-primary)' }}>
            <h3 className="text-sm font-semibold text-white">{sorted.length} Employee{sorted.length !== 1 ? 's' : ''}</h3>
            <div className="relative max-w-xs">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="rounded-lg bg-white/10 border border-white/20 pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/40 w-44" />
            </div>
          </div>
          <div className="overflow-x-auto bg-white">
            <DragDropContext onDragEnd={onDragEnd}>
              <table className="w-full text-sm">
                <Droppable droppableId="emp-cols" direction="horizontal">
                  {dp => (
                    <thead>
                      <tr ref={dp.innerRef} {...dp.droppableProps}
                        style={{ backgroundColor: 'var(--bba-primary)', borderBottom: '2px solid rgba(78,0,142,0.3)' }}>
                        {colOrder.map((key, idx) => {
                          const col = ALL_COLS.find(c => c.key === key)!
                          return (
                            <Draggable key={key} draggableId={key} index={idx}>
                              {(dragP, snap) => (
                                <th ref={dragP.innerRef} {...dragP.draggableProps} {...dragP.dragHandleProps}
                                  className={`px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap select-none cursor-grab ${snap.isDragging ? 'opacity-50' : ''}`}
                                  style={dragP.draggableProps.style}>
                                  <button onClick={() => toggleSort(key)} className="flex items-center gap-1 hover:opacity-80">
                                    {col.label}
                                    <span className="text-[9px] opacity-60">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                                  </button>
                                </th>
                              )}
                            </Draggable>
                          )
                        })}
                        <th style={{ padding: 0 }}>{dp.placeholder}</th>
                      </tr>
                    </thead>
                  )}
                </Droppable>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={colOrder.length} className="px-5 py-10 text-center text-sm text-slate-400">No employees found.</td></tr>
                  ) : sorted.map((emp, i) => {
                    const bg = i % 2 === 0 ? '#ffffff' : '#faf5ff'
                    return (
                      <tr key={emp.id} onClick={() => setSelectedEmp(emp)}
                        style={{ backgroundColor: bg, borderBottom: '1px solid #f0e8f8', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3e8ff' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = bg }}>
                        {colOrder.map(key => renderCell(emp, key))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </DragDropContext>
          </div>
        </div>
      )}

      {employees.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">No employees yet.</p>
          <button onClick={() => setAddOpen(true)} className="mt-3 text-sm text-purple-600 underline underline-offset-2">
            Add your first employee
          </button>
        </div>
      )}

      <AddEmployeePanel
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); loadEmployees() }}
      />
      <EmployeeDrawer
        employee={selectedEmp}
        onClose={() => setSelectedEmp(null)}
        onUpdated={() => { loadEmployees(); setSelectedEmp(null) }}
      />
    </div>
  )
}
