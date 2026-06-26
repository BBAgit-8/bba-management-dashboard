'use client'

import { useEffect, useState, useRef } from 'react'

type PayrollRow = {
  id:             string
  employeeId:     string
  name:           string
  dept:           string
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
  isContractor:   boolean
  booksCapWk:     number
  booksCapMo:     number
}

type Totals = {
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

function fmt$(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtN(n: number | null | undefined, dec = 2) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

type EditField = {
  rowId: string
  field: string
  value: string
}

export default function PayrollPage() {
  const [rows,    setRows]    = useState<PayrollRow[]>([])
  const [totals,  setTotals]  = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)
  const [edit,    setEdit]    = useState<EditField | null>(null)
  const [saved,   setSaved]   = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/payroll')
    const json = await res.json()
    if (json.payroll) setRows(json.payroll)
    if (json.totals)  setTotals(json.totals)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function patchRow(id: string, field: string, raw: string) {
    setSaving(id)
    const value = raw === '' ? null : isNaN(Number(raw)) ? raw : Number(raw)
    await fetch('/api/payroll', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, [field]: value }),
    })
    setSaved(id)
    setTimeout(() => setSaved(null), 1500)
    await load()
    setSaving(null)
  }

  const cogsRows = rows.filter(r => r.dept === 'COGS' && !r.isContractor)
  const gaRows   = rows.filter(r => r.dept === 'GA'   && !r.isContractor)
  const cntrRows = rows.filter(r => r.isContractor)

  const totalAnnual = rows.reduce((s, r) => s + r.annualSalary, 0)

  const COLS = [
    { key: 'dept',           label: 'Dept',         w: 64  },
    { key: 'hourlyRate2023', label: '2023 Rate',     w: 90  },
    { key: 'hourlyRate2024', label: '2024-25 Rate',  w: 90  },
    { key: 'hourlyRate2025', label: '2025-26 Rate',  w: 90  },
    { key: 'hoursPerWeek',   label: 'Hrs/Wk',        w: 72  },
    { key: 'annualSalary',   label: 'Annual Salary', w: 120 },
    { key: 'perPeriodRate',  label: 'Per Pd Rate',   w: 100 },
    { key: 'perPeriodTax',   label: 'Per Pd Tax',    w: 90  },
    { key: 'monthsExpected', label: 'Months Exp.',   w: 80  },
    { key: 'bonusCalc',      label: 'Bonus (3%)',    w: 100 },
    { key: 'bonusManual',    label: 'Bonus Manual',  w: 100 },
    { key: 'retirement401k', label: '401(k)',         w: 90  },
    { key: 'techReimb',      label: 'Tech Reimb',    w: 90  },
    { key: 'adminPercent',   label: 'Admin %',       w: 80  },
    { key: 'booksCapWk',     label: 'Cap Hrs/Wk',   w: 90  },
    { key: 'booksCapMo',     label: 'Cap Hrs/Mo',   w: 90  },
  ]

  // Which fields are read-only (calculated)
  const READONLY = new Set(['annualSalary', 'perPeriodRate', 'bonusCalc', 'booksCapWk', 'booksCapMo'])

  function cellVal(row: PayrollRow, key: string): string {
    const v = (row as any)[key]
    if (v == null) return ''
    return String(v)
  }

  function displayVal(row: PayrollRow, key: string): string {
    const v = (row as any)[key]
    if (key === 'dept') return String(v ?? '—')
    if (key === 'adminPercent') return v != null ? `${Number(v).toFixed(0)}%` : '—'
    if (key === 'hoursPerWeek' || key === 'monthsExpected' || key === 'booksCapWk' || key === 'booksCapMo')
      return fmtN(v, key === 'monthsExpected' ? 1 : 1)
    const dollarKeys = ['hourlyRate2023','hourlyRate2024','hourlyRate2025','annualSalary','perPeriodRate','perPeriodTax','bonusCalc','bonusManual','retirement401k','techReimb']
    if (dollarKeys.includes(key)) return fmt$(v)
    return v != null ? String(v) : '—'
  }

  function EditCell({ row, col }: { row: PayrollRow; col: typeof COLS[0] }) {
    const isEditing = edit?.rowId === row.id && edit?.field === col.key
    const isReadOnly = READONLY.has(col.key) || col.key === 'dept'
    const isSavingRow = saving === row.id

    if (isReadOnly || col.key === 'dept') {
      return (
        <td className="px-3 py-2 text-right text-slate-500 text-xs bg-slate-50/50 whitespace-nowrap">
          {displayVal(row, col.key)}
        </td>
      )
    }

    if (isEditing) {
      return (
        <td className="px-1 py-1">
          <input
            autoFocus
            defaultValue={cellVal(row, col.key)}
            onBlur={e => {
              const val = e.target.value
              setEdit(null)
              if (val !== cellVal(row, col.key)) patchRow(row.id, col.key, val)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEdit(null)
            }}
            className="w-full rounded border border-bba-action px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-bba-action"
            style={{ width: col.w - 8 }}
          />
        </td>
      )
    }

    return (
      <td
        onClick={() => !isSavingRow && setEdit({ rowId: row.id, field: col.key, value: cellVal(row, col.key) })}
        className={`px-3 py-2 text-right text-xs whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors ${
          saved === row.id ? 'bg-green-50' : ''
        }`}
        title="Click to edit"
      >
        {displayVal(row, col.key)}
      </td>
    )
  }

  function SectionRows({ sectionRows, label }: { sectionRows: PayrollRow[]; label: string }) {
    if (sectionRows.length === 0) return null
    return (
      <>
        <tr>
          <td colSpan={COLS.length + 1} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 bg-bba-primary/80">
            {label}
          </td>
        </tr>
        {sectionRows.map((row, idx) => (
          <tr key={row.id}
            style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#faf5ff' }}
            className={saving === row.id ? 'opacity-60' : ''}>
            {/* Name — sticky */}
            <td className="sticky left-0 z-10 px-4 py-2 font-semibold text-slate-800 whitespace-nowrap text-sm"
              style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#faf5ff', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center gap-2">
                {row.isContractor && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">CNTR</span>
                )}
                {row.isHourly && !row.isContractor && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Hourly</span>
                )}
                {row.name.split(' ')[0]}
              </div>
            </td>
            {COLS.map(col => (
              <EditCell key={col.key} row={row} col={col} />
            ))}
          </tr>
        ))}
      </>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#b20476' }}>Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">
            Click any cell to edit · Calculated fields are shaded · {rows.length} employees
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center shadow-sm">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Total Annual</p>
          <p className="mt-0.5 text-xl font-bold text-bba-primary">{fmt$(totalAnnual)}</p>
        </div>
      </div>

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Per Period (EE)',   value: fmt$(totals.perPeriodRate) },
            { label: 'Per Period Tax',    value: fmt$(totals.perPeriodTax)  },
            { label: 'Bonus (3% Calc)',   value: fmt$(totals.bonusCalc)     },
            { label: 'Books Cap/Mo',      value: fmtN(totals.booksCapMo, 1) + ' hrs' },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{card.label}</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-800">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-bba-primary border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">Loading payroll data…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <p className="text-slate-500 font-medium">No payroll records yet.</p>
          <p className="text-sm text-slate-400">Run the SQL seed below to populate employee records.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: '#4e008e' }}>
                  <th className="sticky left-0 z-20 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white whitespace-nowrap"
                    style={{ backgroundColor: '#4e008e', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.15)', minWidth: 140 }}>
                    Employee
                  </th>
                  {COLS.map(col => (
                    <th key={col.key}
                      className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white whitespace-nowrap"
                      style={{ minWidth: col.w }}>
                      {col.label}
                      {READONLY.has(col.key) && <span className="ml-1 text-white/40 text-[9px]">calc</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SectionRows sectionRows={cogsRows} label="COGS — Cost of Goods Sold" />
                <SectionRows sectionRows={gaRows}   label="GA — General & Administrative" />
                <SectionRows sectionRows={cntrRows} label="CNTR — Contractors" />

                {/* Totals row */}
                <tr className="border-t-2 border-slate-300" style={{ backgroundColor: '#f5f0ff' }}>
                  <td className="sticky left-0 z-10 px-4 py-2.5 text-sm font-bold text-bba-primary"
                    style={{ backgroundColor: '#f5f0ff', boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                    TOTALS
                  </td>
                  {COLS.map(col => {
                    const dollarKeys = ['annualSalary','perPeriodRate','perPeriodTax','bonusCalc','bonusManual','retirement401k','techReimb']
                    const val = totals ? (totals as any)[col.key] : null
                    return (
                      <td key={col.key} className="px-3 py-2.5 text-right text-xs font-bold text-bba-primary whitespace-nowrap">
                        {val != null
                          ? dollarKeys.includes(col.key) ? fmt$(val)
                          : col.key.includes('Cap') ? fmtN(val, 1)
                          : '—'
                          : '—'}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seed instructions */}
      {rows.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">Run this SQL in Supabase to seed your payroll records:</p>
          <p className="text-xs text-amber-700">
            Go to Supabase → SQL Editor and paste the seed script provided separately.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-400">
        * Shaded columns (calc) are calculated automatically and cannot be edited directly.
        Annual Salary = Rate × Hrs/Wk × 52 for hourly employees; entered directly for salaried.
        Bonus (3%) = Annual × (Months/12) × 3%. Books Capacity = Hrs/Wk × (1 − Admin%) × 4.33.
      </p>
    </div>
  )
}
