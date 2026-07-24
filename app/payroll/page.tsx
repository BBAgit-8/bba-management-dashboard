'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import EmployeeDrawer from '@/app/components/EmployeeDrawer'
import { usePersistedState } from '@/lib/use-persisted-state'

type PayrollRow = {
  id:             string
  employeeId:     string
  name:           string
  dept:           string
  isContractor:   boolean
  isActive:       boolean
  /** Second-most-recent rate from employee_rate_history. Readonly display. */
  previousRate:   number | null
  /** Current effective hourly rate — source of truth is employees.effectiveHourlyRate. */
  currentRate:    number | null
  /** Sandbox-only proposed next-year rate. Not persisted anywhere. */
  proposedRate?:  number | null
  /** Sandbox-only virtual — raise% applied to currentRate. Not persisted. */
  raisePercent?:  number | null
  hoursPerWeek:   number
  isHourly:       boolean
  annualSalary:   number
  perPeriodRate:  number
  perPeriodTax:   number | null
  monthsExpected: number | null
  bonusCalc:      number
  bonusManual:    number | null
  retirement401k: number | null
  techReimb:      number | null
  adminPercent:   number | null
  booksCapWk:     number
  booksCapMo:     number
}

type SectionTotals = {
  annualSalary:   number
  perPeriodRate:  number
  perPeriodTax:   number
  bonusCalc:      number
  bonusManual:    number
  retirement401k: number
  techReimb:      number
  booksCapWk:     number
  booksCapMo:     number
}

type Totals = { ee: SectionTotals; cntr: SectionTotals; all: SectionTotals }

function fmt$(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtN(n: number | null | undefined, dec = 1) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

type ColDef = {
  key: string
  label: string
  w: number
  ro: boolean
  sandboxOnly?: boolean
  actualsOnly?: boolean
}

const COLS: ColDef[] = [
  { key: 'dept',           label: 'Dept',           w: 64,  ro: false },
  { key: 'previousRate',   label: 'Previous Rate',  w: 100, ro: true  },  // label overridden at render time
  { key: 'currentRate',    label: 'Current Rate',   w: 100, ro: false }, // label overridden at render time; edits → employees.effectiveHourlyRate
  { key: 'raisePercent',   label: 'Raise %',        w: 78,  ro: false, sandboxOnly: true },
  { key: 'proposedRate',   label: 'Proposed Rate',  w: 100, ro: false, sandboxOnly: true }, // label overridden at render time
  { key: 'hoursPerWeek',   label: 'Hrs/Wk',         w: 70,  ro: true  },
  { key: 'annualSalary',   label: 'Annual Salary',  w: 118, ro: false },
  { key: 'perPeriodRate',  label: 'Per Pd Rate',    w: 100, ro: true  },
  { key: 'perPeriodTax',   label: 'Per Pd Tax',     w: 88,  ro: true  },
  { key: 'monthsExpected', label: 'Months Exp.',    w: 78,  ro: false },
  { key: 'bonusCalc',      label: 'Bonus (3%)',     w: 96,  ro: true  },
  { key: 'bonusManual',    label: 'Bonus Manual',   w: 96,  ro: false },
  { key: 'retirement401k', label: '401(k)',         w: 88,  ro: true  },
  { key: 'techReimb',      label: 'Tech Reimb',     w: 88,  ro: false },
  { key: 'adminPercent',   label: 'Admin %',        w: 78,  ro: false },
  { key: 'booksCapWk',     label: 'Cap Hrs/Wk',     w: 88,  ro: true  },
  { key: 'booksCapMo',     label: 'Cap Hrs/Mo',     w: 88,  ro: true  },
]

const DOLLAR_KEYS = new Set(['previousRate','currentRate','proposedRate','annualSalary','perPeriodRate','perPeriodTax','bonusCalc','bonusManual','retirement401k','techReimb'])

// Builds fiscal-year labels like "2025-26" from a start year.
function fyLabel(startYear: number): string {
  const nextTwo = String((startYear + 1) % 100).padStart(2, '0')
  return `${startYear}-${nextTwo}`
}

// Given the base ColDef and the current fiscal year start, return the label
// that should actually be shown. Year-dependent columns get dynamic labels.
function labelFor(col: ColDef, fyStart: number): string {
  if (col.key === 'previousRate') return `Prev Rate (${fyLabel(fyStart - 1)})`
  if (col.key === 'currentRate')  return `Current Rate (${fyLabel(fyStart)})`
  if (col.key === 'proposedRate') return `Proposed Rate (${fyLabel(fyStart + 1)})`
  return col.label
}

function displayVal(col: ColDef, row: PayrollRow): string {
  const v = (row as any)[col.key]
  if (col.key === 'dept') return String(v ?? '—')
  if (col.key === 'adminPercent') return v != null ? `${Number(v).toFixed(0)}%` : '—'
  if (col.key === 'raisePercent') return v != null ? `${Number(v).toFixed(1)}%` : '—'
  if (col.key === 'hoursPerWeek' || col.key === 'monthsExpected') return v != null ? fmtN(v, col.key === 'monthsExpected' ? 1 : 0) : '—'
  if (col.key === 'booksCapWk' || col.key === 'booksCapMo') return v != null ? fmtN(v) : '—'
  if (DOLLAR_KEYS.has(col.key)) return fmt$(v)
  return v != null ? String(v) : '—'
}

function TotalsRow({ label, t, bg, cols }: { label: string; t: SectionTotals; bg: string; cols: ColDef[] }) {
  return (
    <tr style={{ backgroundColor: bg }}>
      <td className="sticky left-0 z-10 px-4 py-2 text-xs font-bold text-bba-primary whitespace-nowrap"
        style={{ backgroundColor: bg, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
        {label}
      </td>
      {cols.map(col => {
        const v = (t as any)[col.key]
        return (
          <td key={col.key} className="px-3 py-2 text-right text-xs font-bold text-bba-primary whitespace-nowrap">
            {v != null
              ? DOLLAR_KEYS.has(col.key) ? fmt$(v)
              : (col.key === 'booksCapWk' || col.key === 'booksCapMo') ? fmtN(v)
              : '—'
              : '—'}
          </td>
        )
      })}
      <td className="px-3 py-2" />
    </tr>
  )
}

// Shared recalc — used by both actuals patch-in-place and sandbox edits.
// In sandbox with a proposedRate set, annualSalary is computed from
// proposedRate * hours * 52 for BOTH hourly and salaried employees. This
// matches how Dawn thinks about raises: "I'm giving them a raise from $30 to
// $32/hr" — new salary is derived, not scaled from the old salary.
function recalcRow(row: PayrollRow, mode: 'actuals' | 'sandbox' = 'actuals'): PayrollRow {
  const hoursPerWeek  = Number(row.hoursPerWeek ?? 40)
  const adminPct      = Number(row.adminPercent ?? 0) / 100

  let annualSalary: number
  if (mode === 'sandbox' && row.proposedRate != null) {
    // Both hourly and salaried: proposed rate * hours * 52.
    annualSalary = Number(row.proposedRate) * hoursPerWeek * 52
  } else if (row.isHourly) {
    annualSalary = Number(row.currentRate ?? 0) * hoursPerWeek * 52
  } else {
    // Salaried in actuals: use the stored annual salary.
    annualSalary = Number(row.annualSalary ?? 0)
  }

  const perPeriodRate = annualSalary / 26
  const perPeriodTax  = perPeriodRate * 0.091
  const retirement401k = perPeriodRate * 0.04
  const bonusCalc     = (annualSalary * (Number(row.monthsExpected ?? 12) / 12)) * 0.03
  const booksCapWk    = hoursPerWeek * (1 - adminPct)
  const booksCapMo    = booksCapWk * 4.333
  return { ...row, annualSalary, perPeriodRate, perPeriodTax, retirement401k, bonusCalc, booksCapWk, booksCapMo }
}

// Fields that write to the payroll DB row on individual sandbox → actuals patches.
// currentRate + proposedRate route through a separate publish flow (see publishRaises).
const SANDBOX_WRITABLE_FIELDS: (keyof PayrollRow)[] = [
  'dept', 'annualSalary', 'monthsExpected', 'bonusManual', 'techReimb', 'adminPercent',
]

const SANDBOX_STORAGE_KEY = 'bba.payroll.sandboxRows.v3'

function sumSection(subset: PayrollRow[]): SectionTotals {
  return {
    annualSalary:   subset.reduce((s, r) => s + r.annualSalary, 0),
    perPeriodRate:  subset.reduce((s, r) => s + r.perPeriodRate, 0),
    perPeriodTax:   subset.reduce((s, r) => s + Number(r.perPeriodTax ?? 0), 0),
    bonusCalc:      subset.reduce((s, r) => s + r.bonusCalc, 0),
    bonusManual:    subset.reduce((s, r) => s + Number(r.bonusManual ?? 0), 0),
    retirement401k: subset.reduce((s, r) => s + Number(r.retirement401k ?? 0), 0),
    techReimb:      subset.reduce((s, r) => s + Number(r.techReimb ?? 0), 0),
    booksCapWk:     subset.reduce((s, r) => s + r.booksCapWk, 0),
    booksCapMo:     subset.reduce((s, r) => s + r.booksCapMo, 0),
  }
}

export default function PayrollPage() {
  const [rows,           setRows]           = useState<PayrollRow[]>([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState<string | null>(null)
  const [saved,          setSaved]          = useState<string | null>(null)
  const [editCell,       setEditCell]       = useState<{ rowId: string; field: string } | null>(null)
  const [offboardId,     setOffboardId]     = useState<string | null>(null)
  const [offboardResult, setOffboardResult] = useState<{ name: string; count: number } | null>(null)
  const [offboarding,    setOffboarding]    = useState(false)

  // Sandbox mode — a local copy of rows the user can play with. Changes stay
  // in localStorage; nothing hits the DB until they click "Publish Raises."
  const [mode,           setMode]           = usePersistedState<'actuals' | 'sandbox'>('bba.payroll.mode', 'actuals')
  const [sandboxRows,    setSandboxRows]    = useState<PayrollRow[]>([])
  const [fyStart,        setFyStart]        = useState<number>(new Date().getFullYear())
  const [publishOpen,    setPublishOpen]    = useState(false)      // Publish confirm modal
  const [publishing,     setPublishing]     = useState(false)
  const [publishResult,  setPublishResult]  = useState<{ published: number; currentFiscalYearStart?: number; results?: { name: string; newRate: number }[]; errors?: string[] } | null>(null)
  const [resetOpen,      setResetOpen]      = useState(false)
  const [showArchived,   setShowArchived]   = usePersistedState<boolean>('bba.payroll.showArchived', false)

  // Employee quick-view drawer
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null)
  const openEmp = useCallback(async (empId: string) => {
    try {
      // Include archived in case they clicked an inactive row (only visible with toggle on)
      const res = await fetch('/api/employees?includeInactive=1')
      const data = await res.json()
      if (Array.isArray(data)) {
        const full = data.find((e: any) => e.id === empId)
        if (full) setSelectedEmp(full)
      }
    } catch (err) {
      console.error('Failed to load employee:', err)
    }
  }, [])

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/payroll')
    const json = await res.json()
    if (typeof json.currentFiscalYearStart === 'number') {
      setFyStart(json.currentFiscalYearStart)
    }
    if (json.payroll) {
      const sorted = [...json.payroll].sort((a: PayrollRow, b: PayrollRow) => a.name.localeCompare(b.name))
      setRows(sorted)
      // Hydrate sandbox from localStorage on first load; fall back to a clone of actuals.
      // If saved sandbox has a different row-set (e.g. someone was added/removed since),
      // discard it — safer than trying to merge.
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(SANDBOX_STORAGE_KEY)
          if (saved) {
            const parsed = JSON.parse(saved) as PayrollRow[]
            const sameShape = Array.isArray(parsed)
              && parsed.length === sorted.length
              && parsed.every(p => sorted.some((r: PayrollRow) => r.id === p.id))
            if (sameShape) {
              setSandboxRows(parsed)
            } else {
              localStorage.removeItem(SANDBOX_STORAGE_KEY)
              setSandboxRows(sorted.map(r => ({ ...r })))
            }
          } else {
            setSandboxRows(sorted.map(r => ({ ...r })))
          }
        } catch {
          setSandboxRows(sorted.map(r => ({ ...r })))
        }
      } else {
        setSandboxRows(sorted.map(r => ({ ...r })))
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Persist sandbox on any change (skip empty initial state).
  useEffect(() => {
    if (sandboxRows.length === 0) return
    try { localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(sandboxRows)) } catch {}
  }, [sandboxRows])

  // What the UI actually shows — one line for the whole file.
  const rawRows = mode === 'sandbox' ? sandboxRows : rows
  const displayedRows = showArchived ? rawRows : rawRows.filter(r => r.isActive)
  // Show sandbox-only columns (raisePercent) only in sandbox mode.
  const visibleCols: ColDef[] = COLS.filter(c => (!c.sandboxOnly || mode === 'sandbox') && (!c.actualsOnly || mode === 'actuals'))

  // Totals derived from displayedRows (used to be state; deriving is simpler
  // and can't fall out of sync).
  const totals = useMemo<Totals | null>(() => {
    if (displayedRows.length === 0) return null
    return {
      ee:   sumSection(displayedRows.filter(r => !r.isContractor)),
      cntr: sumSection(displayedRows.filter(r =>  r.isContractor)),
      all:  sumSection(displayedRows),
    }
  }, [displayedRows])

  // Special dept change: updates payroll.dept AND flips employees.employeeType
  // so isContractor stays in sync (payroll's isContractor derives from employeeType).
  async function patchDept(row: PayrollRow, newDept: 'COGS' | 'GA' | 'CNTR') {
    if (row.dept === newDept) return
    setSaving(row.id)

    // Sandbox: mutate local only; also derive isContractor from new dept.
    if (mode === 'sandbox') {
      setSandboxRows(prev => prev.map(r => {
        if (r.id !== row.id) return r
        return recalcRow({ ...r, dept: newDept, isContractor: newDept === 'CNTR' } as PayrollRow, 'sandbox')
      }).sort((a, b) => a.name.localeCompare(b.name)))
      setSaved(row.id); setTimeout(() => setSaved(null), 1500)
      setSaving(null)
      return
    }

    // Actuals: patch payroll AND employees in parallel.
    const newEmployeeType = newDept === 'CNTR' ? 'contractor' : 'employee'
    await Promise.all([
      fetch('/api/payroll', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: row.id, dept: newDept }),
      }),
      fetch(`/api/employees/${row.employeeId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employeeType: newEmployeeType }),
      }),
    ])
    setRows(prev => prev.map(r => {
      if (r.id !== row.id) return r
      return recalcRow({ ...r, dept: newDept, isContractor: newDept === 'CNTR' } as PayrollRow)
    }).sort((a, b) => a.name.localeCompare(b.name)))
    setSaved(row.id); setTimeout(() => setSaved(null), 1500)
    setSaving(null)
  }

  async function patchRow(id: string, field: string, raw: string) {
    setSaving(id)
    const value = raw === '' ? null : isNaN(Number(raw)) ? raw : Number(raw)

    // Sandbox: no network call, just mutate local state.
    if (mode === 'sandbox') {
      setSandboxRows(prev => prev.map(r => {
        if (r.id !== id) return r
        const baseline = rows.find(x => x.id === id)  // pre-edit actuals row

        // Two-way binding between raisePercent and proposedRate.
        // Clearing either field also clears its partner (so leaving raise% blank
        // means the proposed rate reverts to whatever recalcRow computes without
        // it — i.e. back to previous year's numbers).
        let next: any = { ...r, [field]: value }
        if (field === 'raisePercent') {
          if (value == null) {
            next.proposedRate = null
          } else if (baseline?.currentRate != null) {
            next.proposedRate = Number((Number(baseline.currentRate) * (1 + Number(value) / 100)).toFixed(2))
          }
        } else if (field === 'proposedRate') {
          if (value == null) {
            next.raisePercent = null
          } else if (baseline?.currentRate) {
            const b = Number(baseline.currentRate)
            next.raisePercent = Number((((Number(value) - b) / b) * 100).toFixed(2))
          }
        }

        return recalcRow(next as PayrollRow, 'sandbox')
      }).sort((a, b) => a.name.localeCompare(b.name)))
      setSaved(id); setTimeout(() => setSaved(null), 1500)
      setSaving(null)
      return
    }

    // Actuals path.
    // currentRate edits route through the employees endpoint (which also logs
    // rate history and, for salaried folks, syncs salary). Everything else
    // stays on the payroll table.
    const row = rows.find(r => r.id === id)
    if (field === 'currentRate' && row?.employeeId) {
      await fetch(`/api/employees/${row.employeeId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          effectiveHourlyRate: value,
          // For salaried: also update salary so it stays in sync.
          ...(row.isHourly ? {} : value != null ? { salary: Number(value) * (row.hoursPerWeek ?? 40) * 52 } : {}),
        }),
      })
      setRows(prev => prev.map(r => {
        if (r.id !== id) return r
        return recalcRow({ ...r, currentRate: value as number | null } as PayrollRow, 'actuals')
      }).sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      // All other payroll-table fields.
      await fetch('/api/payroll', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, [field]: value }),
      })
      setRows(prev => prev.map(r => {
        if (r.id !== id) return r
        return recalcRow({ ...r, [field]: value } as PayrollRow, 'actuals')
      }).sort((a, b) => a.name.localeCompare(b.name)))
    }
    setSaved(id); setTimeout(() => setSaved(null), 1500)
    setSaving(null)
  }

  // Reset sandbox back to a fresh clone of actuals.
  function resetSandbox() {
    setSandboxRows(rows.map(r => ({ ...r })))
    try { localStorage.removeItem(SANDBOX_STORAGE_KEY) } catch {}
    setResetOpen(false)
  }

  // Copy sandbox → actuals: diff each row against actuals, PATCH only changed
  // writable fields. Sequential to keep it simple; parallel would be faster
  // but harder to reason about if one fails midway.
  // Publish raises — the one-button flow that replaces Copy-to-Actuals + Promote.
  //
  // Also flushes any other sandbox edits (dept, monthsExpected, bonusManual, etc.)
  // to the payroll table so those changes aren't lost.
  async function publishRaises() {
    setPublishing(true)

    // Gather raises: any sandbox row with a proposedRate set.
    const raises = sandboxRows
      .filter(r => r.proposedRate != null)
      .map(r => ({ employeeId: r.employeeId, newRate: Number(r.proposedRate) }))

    // Flush non-rate sandbox edits to payroll table first.
    let otherChanged = 0
    for (const s of sandboxRows) {
      const orig = rows.find(r => r.id === s.id)
      if (!orig) continue
      const diff: Record<string, unknown> = {}
      for (const f of SANDBOX_WRITABLE_FIELDS) {
        if (s[f] !== orig[f]) diff[f as string] = s[f]
      }
      if (Object.keys(diff).length === 0) continue
      otherChanged++
      await fetch('/api/payroll', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: s.id, ...diff }),
      })
    }

    // Now publish raises through the atomic endpoint.
    let published = 0
    if (raises.length > 0) {
      const res = await fetch('/api/payroll/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ raises }),
      })
      const json = await res.json()
      published = json.published ?? 0
      setPublishResult(json)
    }

    setPublishing(false); setPublishOpen(false)
    await load()
    setMode('actuals')
    try { localStorage.removeItem(SANDBOX_STORAGE_KEY) } catch {}
    if (raises.length === 0 && otherChanged > 0) {
      // No raises but other edits shipped — reuse the offboard toast slot.
      setOffboardResult({ name: 'Sandbox saved', count: otherChanged })
      setTimeout(() => setOffboardResult(null), 3000)
    }
  }

  async function doOffboard(employeeId: string) {
    setOffboarding(true)
    const res  = await fetch('/api/employees/offboard', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ employeeId }),
    })
    const json = await res.json()
    setOffboardResult({ name: json.employeeName, count: json.clientsUnassigned })
    setOffboardId(null)
    setOffboarding(false)
    await load()
  }

  const eeRows   = displayedRows.filter(r => !r.isContractor)
  const cntrRows = displayedRows.filter(r =>  r.isContractor)
  const cogsRows = eeRows.filter(r => r.dept === 'COGS')
  const gaRows   = eeRows.filter(r => r.dept === 'GA')

  function SectionLabel({ label }: { label: string }) {
    return (
      <tr>
        <td colSpan={visibleCols.length + 2}
          className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70"
          style={{ backgroundColor: 'rgba(78,0,142,0.75)' }}>
          {label}
        </td>
      </tr>
    )
  }

  function DataRow({ row, idx }: { row: PayrollRow; idx: number }) {
    const rowBg  = idx % 2 === 0 ? '#ffffff' : '#faf5ff'
    const isSave = saving === row.id

    return (
      <tr style={{ backgroundColor: isSave ? '#f5f0ff' : rowBg }} className={isSave ? 'opacity-60' : ''}>
        {/* Name — sticky */}
        <td className="sticky left-0 z-10 px-4 py-2 text-sm font-semibold text-slate-800 whitespace-nowrap"
          style={{ backgroundColor: saved === row.id ? '#f0fdf4' : rowBg, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2">
            {row.isContractor
              ? <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">CNTR</span>
              : row.isHourly
              ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Hourly</span>
              : null}
            {!row.isActive && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">Inactive</span>}
            <button type="button" onClick={() => openEmp(row.employeeId)}
              className="hover:text-bba-action hover:underline underline-offset-2 transition-colors bg-transparent p-0 border-0 cursor-pointer font-semibold text-slate-800">
              {row.name.split(' ')[0]}
            </button>
          </div>
        </td>

        {/* Data cells */}
        {visibleCols.map(col => {
          // Dept: inline select. Skips the generic click-to-edit path.
          if (col.key === 'dept') return (
            <td key={col.key} className="px-2 py-1 text-center">
              <select
                value={row.dept}
                onChange={e => patchDept(row, e.target.value as 'COGS' | 'GA' | 'CNTR')}
                disabled={isSave}
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-bba-action hover:border-purple-300 cursor-pointer"
              >
                <option value="COGS">COGS</option>
                <option value="GA">G&amp;A</option>
                <option value="CNTR">CNTR</option>
              </select>
            </td>
          )

          const isEditing = editCell?.rowId === row.id && editCell?.field === col.key
          const isRO = col.ro ||
            (col.key === 'annualSalary' && row.isHourly) // hourly: calculated; salaried: editable

          if (isRO) return (
            <td key={col.key} className="px-3 py-2 text-right text-xs text-slate-400 bg-slate-50/60 whitespace-nowrap">
              {displayVal(col, row)}
            </td>
          )

          if (isEditing) return (
            <td key={col.key} className="px-1 py-1">
              <input autoFocus
                defaultValue={String((row as any)[col.key] ?? '') === '0' ? '' : String((row as any)[col.key] ?? '')}
                onBlur={e => { setEditCell(null); patchRow(row.id, col.key, e.target.value) }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditCell(null) }}
                className="w-full rounded border border-bba-action px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-bba-action"
                style={{ width: col.w - 8 }}
              />
            </td>
          )

          return (
            <td key={col.key}
              onClick={() => !isSave && setEditCell({ rowId: row.id, field: col.key })}
              title="Click to edit"
              className={`px-3 py-2 text-right text-xs whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors border border-transparent hover:border-purple-200 ${saved === row.id ? 'bg-green-50' : ''}`}>
              {displayVal(col, row)}
            </td>
          )
        })}

        {/* Offboard button */}
        <td className="px-3 py-2 text-center">
          {row.isActive ? (
            <button onClick={() => setOffboardId(row.employeeId)}
              className="rounded px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent hover:border-red-200">
              Offboard
            </button>
          ) : (
            <button onClick={async () => {
              await fetch('/api/employees/offboard', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: row.employeeId }) })
              load()
            }}
              className="rounded px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors border border-transparent hover:border-green-200">
              Reinstate
            </button>
          )}
        </td>
      </tr>
    )
  }

  const totalAnnual = totals?.all.annualSalary ?? 0

  return (
    <div className="p-8 space-y-6">

      {/* Offboard confirm modal */}
      {offboardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Offboard Employee</h2>
            <p className="text-sm text-slate-600">
              This will archive the employee and, across the whole system:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc marker:text-slate-400">
              <li>Set all their assigned clients to <strong>Unassigned</strong></li>
              <li>Remove their capacity-planning task assignments (pod defaults &amp; client overrides)</li>
              <li>Revoke their Client Hub access and delete their login</li>
              <li>Drop them from their pod</li>
            </ul>
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Historical time logs and pay history are preserved. Reinstating restores the record but not their hub access or client assignments.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setOffboardId(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => doOffboard(offboardId)} disabled={offboarding}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {offboarding ? 'Processing…' : 'Confirm Offboard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offboard result toast */}
      {offboardResult && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-800 px-5 py-3 text-white shadow-xl flex items-center gap-3">
          <svg className="h-5 w-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-semibold">{offboardResult.name} offboarded</p>
            <p className="text-xs text-slate-300">{offboardResult.count} client{offboardResult.count !== 1 ? 's' : ''} set to Unassigned</p>
          </div>
          <button onClick={() => setOffboardResult(null)} className="ml-2 text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#b20476' }}>Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">Click any white cell to edit · Shaded = calculated · {displayedRows.length} records{showArchived ? ' (incl. archived)' : ''}</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-bba-action focus:ring-bba-action focus:ring-1"
            />
            Show archived
          </label>
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center shadow-sm">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Annual Payroll</p>
            <p className="mt-0.5 text-xl font-bold text-bba-primary">{fmt$(totalAnnual)}</p>
          </div>
        </div>
      </div>

      {/* Actuals / Sandbox tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-1">
          {(['actuals', 'sandbox'] as const).map(m => {
            const active = mode === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${
                  active
                    ? m === 'sandbox'
                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-white border-slate-200 text-bba-primary'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {m === 'actuals' ? 'Actuals' : '🧪 Sandbox'}
              </button>
            )
          })}
        </div>
        {mode === 'sandbox' && (
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset to Actuals
            </button>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              disabled={publishing}
              className="rounded-lg bg-bba-action px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              title="Apply sandbox raises and flush edits. Updates employees, logs rate history, bumps fiscal year."
            >
              Publish Raises →
            </button>
          </div>
        )}
      </div>

      {/* Sandbox mode banner */}
      {mode === 'sandbox' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <span className="font-semibold">You're in Sandbox mode.</span> Edits stay in this browser until you click <span className="font-semibold">Publish Raises</span>. Use the <span className="font-semibold">Raise %</span> column to preview how a raise flows through Annual Salary and totals. Publish updates employee rates, logs history, and rolls the fiscal-year labels forward — no separate steps.
        </div>
      )}

      {/* Publish confirm */}
      {publishOpen && (() => {
        const raiseCount = sandboxRows.filter(r => r.proposedRate != null).length
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Publish Raises</h2>
              <p className="text-sm text-slate-600">
                You're about to publish <span className="font-semibold">{raiseCount}</span> raise{raiseCount === 1 ? '' : 's'} from your sandbox. This will:
              </p>
              <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
                <li>Update each employee's effective hourly rate (and salary for salaried folks)</li>
                <li>Log a rate history entry for every raise</li>
                <li>Roll the fiscal-year labels forward ({fyLabel(fyStart)} → {fyLabel(fyStart + 1)})</li>
                <li>Save any non-rate sandbox edits (dept, bonuses, etc.)</li>
              </ul>
              <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                Rates take effect immediately across capacity planning, profitability, and employee profiles. Only publish once you're sure.
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setPublishOpen(false)} disabled={publishing}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={publishRaises} disabled={publishing}
                  className="rounded-lg bg-bba-action px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {publishing ? 'Publishing…' : 'Confirm & Publish'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Publish result toast */}
      {publishResult && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm rounded-lg border border-green-300 bg-green-50 p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-900">Published {publishResult.published} raise{publishResult.published === 1 ? '' : 's'}</p>
              {publishResult.currentFiscalYearStart && (
                <p className="text-xs text-green-800 mt-0.5">Fiscal year is now {fyLabel(publishResult.currentFiscalYearStart)}</p>
              )}
              {publishResult.errors && publishResult.errors.length > 0 && (
                <p className="text-xs text-red-700 mt-1">{publishResult.errors.length} error(s): {publishResult.errors[0]}</p>
              )}
            </div>
            <button onClick={() => setPublishResult(null)} className="text-green-700 hover:text-green-900 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      {/* Reset confirm */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Reset Sandbox</h2>
            <p className="text-sm text-slate-600">
              Throw away every change you made in the sandbox and start over from the current actuals?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setResetOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={resetSandbox}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EE vs CNTR summary */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'EE Annual',     value: fmt$(totals.ee.annualSalary),   sub: 'Employees'    },
            { label: 'CNTR Annual',   value: fmt$(totals.cntr.annualSalary), sub: 'Contractors'  },
            { label: 'Per Period EE', value: fmt$(totals.ee.perPeriodRate),  sub: 'Bi-weekly'    },
            { label: 'Books Cap/Mo',  value: fmtN(totals.all.booksCapMo) + ' hrs', sub: 'Firm total' },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{card.label}</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-800">{card.value}</p>
              <p className="text-[10px] text-slate-400">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-bba-primary border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">Loading payroll…</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: '#4e008e' }}>
                  <th className="sticky left-0 z-20 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white whitespace-nowrap"
                    style={{ backgroundColor: '#4e008e', minWidth: 140, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.15)' }}>
                    Employee
                  </th>
                  {visibleCols.map(col => (
                    <th key={col.key}
                      className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white whitespace-nowrap"
                      style={{ minWidth: col.w }}>
                      {labelFor(col, fyStart)}
                      {(col.ro || col.key === 'annualSalary') && <span className="ml-1 text-white/40 text-[9px]">{col.key === 'annualSalary' ? 'hrly=calc' : 'calc'}</span>}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-white whitespace-nowrap" style={{ minWidth: 80 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* COGS */}
                {cogsRows.length > 0 && <SectionLabel label="COGS — Cost of Goods Sold" />}
                {cogsRows.map((row, i) => <DataRow key={row.id} row={row} idx={i} />)}

                {/* COGS totals */}
                {totals && cogsRows.length > 0 && (
                  <TotalsRow label="COGS Total" t={{
                    ...totals.ee,
                    annualSalary:   cogsRows.reduce((s, r) => s + r.annualSalary, 0),
                    perPeriodRate:  cogsRows.reduce((s, r) => s + r.perPeriodRate, 0),
                    bonusCalc:      cogsRows.reduce((s, r) => s + r.bonusCalc, 0),
                    booksCapWk:     cogsRows.reduce((s, r) => s + r.booksCapWk, 0),
                    booksCapMo:     cogsRows.reduce((s, r) => s + r.booksCapMo, 0),
                    perPeriodTax:   cogsRows.reduce((s, r) => s + Number(r.perPeriodTax ?? 0), 0),
                    bonusManual:    cogsRows.reduce((s, r) => s + Number(r.bonusManual ?? 0), 0),
                    retirement401k: cogsRows.reduce((s, r) => s + Number(r.retirement401k ?? 0), 0),
                    techReimb:      cogsRows.reduce((s, r) => s + Number(r.techReimb ?? 0), 0),
                  }} bg="#ede9fe" cols={visibleCols} />
                )}

                {/* GA */}
                {gaRows.length > 0 && <SectionLabel label="GA — General & Administrative" />}
                {gaRows.map((row, i) => <DataRow key={row.id} row={row} idx={i} />)}

                {/* GA totals */}
                {totals && gaRows.length > 0 && (
                  <TotalsRow label="GA Total" t={{
                    ...totals.ee,
                    annualSalary:   gaRows.reduce((s, r) => s + r.annualSalary, 0),
                    perPeriodRate:  gaRows.reduce((s, r) => s + r.perPeriodRate, 0),
                    bonusCalc:      gaRows.reduce((s, r) => s + r.bonusCalc, 0),
                    booksCapWk:     gaRows.reduce((s, r) => s + r.booksCapWk, 0),
                    booksCapMo:     gaRows.reduce((s, r) => s + r.booksCapMo, 0),
                    perPeriodTax:   gaRows.reduce((s, r) => s + Number(r.perPeriodTax ?? 0), 0),
                    bonusManual:    gaRows.reduce((s, r) => s + Number(r.bonusManual ?? 0), 0),
                    retirement401k: gaRows.reduce((s, r) => s + Number(r.retirement401k ?? 0), 0),
                    techReimb:      gaRows.reduce((s, r) => s + Number(r.techReimb ?? 0), 0),
                  }} bg="#ede9fe" cols={visibleCols} />
                )}

                {/* CNTR */}
                {cntrRows.length > 0 && <SectionLabel label="CNTR — Contractors" />}
                {cntrRows.map((row, i) => <DataRow key={row.id} row={row} idx={i} />)}

                {/* Grand total */}
                {totals && <TotalsRow label="GRAND TOTAL" t={totals.all} bg="#ddd6fe" cols={visibleCols} />}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Shaded (calc): Annual Salary = Rate × Hrs/Wk × 52 (hourly) or entered directly (salary). Per Period = Annual ÷ 26.
        Bonus 3% = Annual × (Months/12) × 3%. Books Cap = Hrs/Wk × (1 − Admin%) × 4.33.
      </p>

      <EmployeeDrawer
        employee={selectedEmp}
        onClose={() => setSelectedEmp(null)}
        onUpdated={() => { setSelectedEmp(null); load() }}
      />
    </div>
  )
}
