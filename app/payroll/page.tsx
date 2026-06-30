'use client'

import { useEffect, useState } from 'react'

type PayrollRow = {
  id:             string
  employeeId:     string
  name:           string
  dept:           string
  isContractor:   boolean
  isActive:       boolean
  hourlyRate2023: number | null
  hourlyRate2024: number | null
  hourlyRate2025: number | null
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

  const COLS = [
  { key: 'dept',           label: 'Dept',          w: 64,  ro: false },
  { key: 'hourlyRate2024', label: '2024-25 Rate',   w: 88,  ro: false },
  { key: 'hourlyRate2025', label: '2025-26 Rate',   w: 88,  ro: false },
  { key: 'hoursPerWeek',   label: 'Hrs/Wk',         w: 70,  ro: true  },
  { key: 'annualSalary',   label: 'Annual Salary',  w: 118, ro: false },
  { key: 'perPeriodRate',  label: 'Per Pd Rate',    w: 100, ro: true  },
  { key: 'perPeriodTax',   label: 'Per Pd Tax',     w: 88,  ro: true  },
  { key: 'monthsExpected', label: 'Months Exp.',    w: 78,  ro: false },
  { key: 'bonusCalc',      label: 'Bonus (3%)',     w: 96,  ro: true  },
  { key: 'bonusManual',    label: 'Bonus Manual',   w: 96,  ro: false },
  { key: 'retirement401k', label: '401(k)',          w: 88,  ro: true  },
  { key: 'techReimb',      label: 'Tech Reimb',     w: 88,  ro: false },
  { key: 'adminPercent',   label: 'Admin %',        w: 78,  ro: false },
  { key: 'booksCapWk',     label: 'Cap Hrs/Wk',    w: 88,  ro: true  },
  { key: 'booksCapMo',     label: 'Cap Hrs/Mo',    w: 88,  ro: true  },
]

const DOLLAR_KEYS = new Set(['hourlyRate2023','hourlyRate2024','hourlyRate2025','annualSalary','perPeriodRate','perPeriodTax','bonusCalc','bonusManual','retirement401k','techReimb'])

function displayVal(col: typeof COLS[0], row: PayrollRow): string {
  const v = (row as any)[col.key]
  if (col.key === 'dept') return String(v ?? '—')
  if (col.key === 'adminPercent') return v != null ? `${Number(v).toFixed(0)}%` : '—'
  if (col.key === 'hoursPerWeek' || col.key === 'monthsExpected') return v != null ? fmtN(v, col.key === 'monthsExpected' ? 1 : 0) : '—'
  if (col.key === 'booksCapWk' || col.key === 'booksCapMo') return v != null ? fmtN(v) : '—'
  if (DOLLAR_KEYS.has(col.key)) return fmt$(v)
  return v != null ? String(v) : '—'
}

function TotalsRow({ label, t, bg }: { label: string; t: SectionTotals; bg: string }) {
  return (
    <tr style={{ backgroundColor: bg }}>
      <td className="sticky left-0 z-10 px-4 py-2 text-xs font-bold text-bba-primary whitespace-nowrap"
        style={{ backgroundColor: bg, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
        {label}
      </td>
      {COLS.map(col => {
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

export default function PayrollPage() {
  const [rows,           setRows]           = useState<PayrollRow[]>([])
  const [totals,         setTotals]         = useState<Totals | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState<string | null>(null)
  const [saved,          setSaved]          = useState<string | null>(null)
  const [editCell,       setEditCell]       = useState<{ rowId: string; field: string } | null>(null)
  const [offboardId,     setOffboardId]     = useState<string | null>(null)
  const [offboardResult, setOffboardResult] = useState<{ name: string; count: number } | null>(null)
  const [offboarding,    setOffboarding]    = useState(false)

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/payroll')
    const json = await res.json()
    if (json.payroll) setRows([...json.payroll].sort((a: PayrollRow, b: PayrollRow) => a.name.localeCompare(b.name)))
    if (json.totals)  setTotals(json.totals)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function patchRow(id: string, field: string, raw: string) {
    setSaving(id)
    const value = raw === '' ? null : isNaN(Number(raw)) ? raw : Number(raw)
    const res  = await fetch('/api/payroll', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, [field]: value }),
    })
    // Recalculate derived fields client-side so we don't need a full reload
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, [field]: value }
      const hoursPerWeek  = Number(updated.hoursPerWeek ?? 40)
      const adminPct      = Number(updated.adminPercent ?? 0) / 100
      const annualSalary  = updated.isHourly
        ? Number(updated.hourlyRate2025 ?? 0) * hoursPerWeek * 52
        : Number(updated.annualSalary ?? 0)
      const perPeriodRate = annualSalary / 26
      const perPeriodTax  = perPeriodRate * 0.091
      const retirement401k = perPeriodRate * 0.04
      const bonusCalc     = (annualSalary * (Number(updated.monthsExpected ?? 12) / 12)) * 0.03
      const booksCapWk    = hoursPerWeek * (1 - adminPct)
      const booksCapMo    = booksCapWk * 4.333
      return { ...updated, annualSalary, perPeriodRate, perPeriodTax, retirement401k, bonusCalc, booksCapWk, booksCapMo }
    }).sort((a, b) => a.name.localeCompare(b.name)))
    setSaved(id)
    setTimeout(() => setSaved(null), 1500)
    setSaving(null)
    // Recalculate totals from updated rows
    setRows(prev => {
      const updated = prev
      function sumSection(subset: PayrollRow[]) {
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
      setTotals({
        ee:   sumSection(updated.filter(r => !r.isContractor)),
        cntr: sumSection(updated.filter(r => r.isContractor)),
        all:  sumSection(updated),
      })
      return prev
    })
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

  const eeRows   = rows.filter(r => !r.isContractor)
  const cntrRows = rows.filter(r => r.isContractor)
  const cogsRows = eeRows.filter(r => r.dept === 'COGS')
  const gaRows   = eeRows.filter(r => r.dept === 'GA')

  function SectionLabel({ label }: { label: string }) {
    return (
      <tr>
        <td colSpan={COLS.length + 2}
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
            <a href={`/employees?open=${row.employeeId}`}
              className="hover:text-bba-action hover:underline underline-offset-2 transition-colors">
              {row.name.split(' ')[0]}
            </a>
          </div>
        </td>

        {/* Data cells */}
        {COLS.map(col => {
          const isEditing = editCell?.rowId === row.id && editCell?.field === col.key
          const isRO = (col.ro || col.key === 'dept') ||
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
              This will mark the employee as <strong>inactive</strong> and set all their assigned clients to <strong>Unassigned</strong>.
            </p>
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              You can reassign clients from the Client List after offboarding. This cannot be undone automatically.
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
          <p className="mt-1 text-sm text-slate-500">Click any white cell to edit · Shaded = calculated · {rows.length} records</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Annual Payroll</p>
          <p className="mt-0.5 text-xl font-bold text-bba-primary">{fmt$(totalAnnual)}</p>
        </div>
      </div>

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
                  {COLS.map(col => (
                    <th key={col.key}
                      className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white whitespace-nowrap"
                      style={{ minWidth: col.w }}>
                      {col.label}
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
                  }} bg="#ede9fe" />
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
                  }} bg="#ede9fe" />
                )}

                {/* CNTR */}
                {cntrRows.length > 0 && <SectionLabel label="CNTR — Contractors" />}
                {cntrRows.map((row, i) => <DataRow key={row.id} row={row} idx={i} />)}

                {/* Grand total */}
                {totals && <TotalsRow label="GRAND TOTAL" t={totals.all} bg="#ddd6fe" />}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Shaded (calc): Annual Salary = Rate × Hrs/Wk × 52 (hourly) or entered directly (salary). Per Period = Annual ÷ 26.
        Bonus 3% = Annual × (Months/12) × 3%. Books Cap = Hrs/Wk × (1 − Admin%) × 4.33.
      </p>
    </div>
  )
}
