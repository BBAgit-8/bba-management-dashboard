'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

type ProfitRow = {
  id: string; name: string; code: string; projectType: string | null
  bookkeeper: string | null; costRate: number
  revenue: number; harvestHrs: number | null; budgetedHrs: number
  hoursUsed: number; cost: number; profit: number; margin: number | null
}

type Totals = { revenue: number; cost: number; profit: number; margin: number | null }

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtFull(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function marginColor(m: number | null) {
  if (m === null) return 'text-slate-400'
  if (m < 0)   return 'text-red-600'
  if (m < 20)  return 'text-orange-600'
  if (m < 40)  return 'text-amber-600'
  return 'text-green-600'
}
function marginBg(m: number | null) {
  if (m === null) return 'bg-slate-100'
  if (m < 0)   return 'bg-red-100'
  if (m < 20)  return 'bg-orange-100'
  if (m < 40)  return 'bg-amber-100'
  return 'bg-green-100'
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// First day of current month
function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}
function today() { return new Date().toISOString().split('T')[0] }

export default function ProfitabilityPage() {
  const [rows,             setRows]             = useState<ProfitRow[]>([])
  const [totals,           setTotals]           = useState<Totals | null>(null)
  const [harvestConnected, setHarvestConnected] = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [from,             setFrom]             = useState(firstOfMonth())
  const [to,               setTo]               = useState(today())
  const [search,           setSearch]           = useState('')
  const [bkFilter,         setBkFilter]         = useState('all')
  const [sortKey,          setSortKey]          = useState<'name' | 'revenue' | 'cost' | 'profit' | 'margin' | 'hoursUsed'>('profit')
  const [sortDir,          setSortDir]          = useState<'asc' | 'desc'>('desc')

  function load() {
    setLoading(true); setError(null)
    fetch(`/api/profitability?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setRows(d.rows ?? [])
        setTotals(d.totals ?? null)
        setHarvestConnected(d.harvestConnected ?? false)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const bookkeepers = useMemo(() => [...new Set(rows.map(r => r.bookkeeper).filter(Boolean))].sort() as string[], [rows])

  const filtered = useMemo(() => {
    let list = rows
    if (search.trim()) list = list.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()))
    if (bkFilter !== 'all') list = list.filter(r => r.bookkeeper === bkFilter)
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')      cmp = a.name.localeCompare(b.name)
      if (sortKey === 'revenue')   cmp = a.revenue   - b.revenue
      if (sortKey === 'cost')      cmp = a.cost       - b.cost
      if (sortKey === 'profit')    cmp = a.profit     - b.profit
      if (sortKey === 'margin')    cmp = (a.margin ?? -999) - (b.margin ?? -999)
      if (sortKey === 'hoursUsed') cmp = a.hoursUsed - b.hoursUsed
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, bkFilter, sortKey, sortDir])

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  function SortTh({ k, children, right }: { k: typeof sortKey; children: React.ReactNode; right?: boolean }) {
    const active = sortKey === k
    return (
      <th className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
        <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:opacity-80 w-full justify-end">
          <span className={right ? 'ml-auto' : ''}>{children}</span>
          <span className="text-[9px] opacity-60">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Profitability</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revenue minus cost of delivery per client
            {harvestConnected
              ? <span className="ml-2 inline-flex items-center gap-1 text-green-600 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Harvest connected</span>
              : <span className="ml-2 inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Using budgeted hours</span>}
          </p>
        </div>
        {/* Date range */}
        <div className="flex items-center gap-2 shrink-0">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:light]" />
          <span className="text-slate-400 text-sm">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:light]" />
          <button onClick={load} disabled={loading}
            className="rounded-lg bg-bba-primary px-4 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 transition-colors disabled:opacity-60">
            {loading ? '…' : 'Run'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Revenue"  value={fmt(totals.revenue)} sub={`${rows.length} clients`} />
          <StatCard label="Cost of Delivery" value={fmt(totals.cost)} color="text-slate-700" />
          <StatCard label="Gross Profit"   value={fmt(totals.profit)}
            color={totals.profit >= 0 ? 'text-green-700' : 'text-red-600'} />
          <StatCard label="Gross Margin"
            value={totals.margin !== null ? `${totals.margin}%` : '—'}
            color={marginColor(totals.margin)}
            sub="Revenue − Cost ÷ Revenue" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-52" />
        </div>
        <select value={bkFilter} onChange={e => setBkFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="all">All Bookkeepers</option>
          {bookkeepers.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <p className="text-xs text-slate-400 ml-auto">
          {filtered.length} of {rows.length} clients
          {!harvestConnected && ' · hours are budgeted estimates'}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bba-primary)' }}>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-white">Client</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-white">Bookkeeper</th>
                <SortTh k="hoursUsed" right>Hours</SortTh>
                <SortTh k="revenue"   right>Revenue</SortTh>
                <SortTh k="cost"      right>Cost</SortTh>
                <SortTh k="profit"    right>Profit</SortTh>
                <SortTh k="margin"    right>Margin</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">No clients match your filters.</td></tr>
              ) : filtered.map((row, i) => {
                const bg = i % 2 === 0 ? '#ffffff' : '#faf5ff'
                return (
                  <tr key={row.id} style={{ backgroundColor: bg, borderBottom: '1px solid #f0e8f8' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3e8ff' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = bg }}>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${row.code}`} className="group">
                        <p className="font-medium text-slate-800 group-hover:text-purple-700 transition-colors">{row.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 group-hover:text-purple-400 transition-colors">{row.code}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {row.bookkeeper ?? <span className="text-slate-300">—</span>}
                      {row.costRate > 0 && <span className="ml-1 text-[10px] text-slate-400">(${row.costRate}/hr)</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {row.hoursUsed.toFixed(1)}
                      {row.harvestHrs === null && row.budgetedHrs > 0 && (
                        <span className="ml-1 text-[10px] text-slate-400">est</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtFull(row.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtFull(row.cost)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmtFull(row.profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.margin !== null ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${marginBg(row.margin)} ${marginColor(row.margin)}`}>
                          {row.margin}%
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totals row */}
            {totals && filtered.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'rgba(78,0,142,0.06)', borderTop: '2px solid rgba(78,0,142,0.15)' }}>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider" colSpan={2}>
                    Totals ({filtered.length} clients)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-slate-700">
                    {filtered.reduce((s, r) => s + r.hoursUsed, 0).toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-slate-700">
                    {fmtFull(filtered.reduce((s, r) => s + r.revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm font-semibold text-slate-700">
                    {fmtFull(filtered.reduce((s, r) => s + r.cost, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-green-700">
                    {fmtFull(filtered.reduce((s, r) => s + r.profit, 0))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const rev = filtered.reduce((s, r) => s + r.revenue, 0)
                      const pft = filtered.reduce((s, r) => s + r.profit, 0)
                      const m   = rev > 0 ? parseFloat(((pft / rev) * 100).toFixed(1)) : null
                      return m !== null
                        ? <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${marginBg(m)} ${marginColor(m)}`}>{m}%</span>
                        : <span className="text-slate-300">—</span>
                    })()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
