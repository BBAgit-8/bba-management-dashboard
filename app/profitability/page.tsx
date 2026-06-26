'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useBookkeeperSync } from '@/app/hooks/useBookkeeperSync'

type ProfitRow = {
  id: string; name: string; code: string; projectType: string | null
  bookkeeper: string | null; costRate: number
  revenue: number; totalMonthly: number; harvestHrs: number | null; budgetedHrs: number
  hoursUsed: number; cost: number; profit: number; margin: number | null
}

type Totals = { revenue: number; cost: number; profit: number; margin: number | null }
type ColKey = 'name' | 'bookkeeper' | 'hoursUsed' | 'revenue' | 'totalMonthly' | 'cost' | 'profit' | 'margin'
type SortDir = 'asc' | 'desc'

const ALL_COLS: { key: ColKey; label: string; align: 'left' | 'right'; sortable: boolean }[] = [
  { key: 'name',         label: 'Client',      align: 'left',  sortable: true  },
  { key: 'bookkeeper',   label: 'Bookkeeper',  align: 'left',  sortable: true  },
  { key: 'hoursUsed',    label: 'Hours',       align: 'right', sortable: true  },
  { key: 'revenue',      label: 'BK Revenue',  align: 'right', sortable: true  },
  { key: 'totalMonthly', label: 'Total/Mo',    align: 'right', sortable: true  },
  { key: 'cost',         label: 'Cost',        align: 'right', sortable: true  },
  { key: 'profit',       label: 'Profit',      align: 'right', sortable: true  },
  { key: 'margin',       label: 'Margin',      align: 'right', sortable: true  },
]

const STORAGE_ORDER  = 'prof-col-order-v1'
const STORAGE_WIDTHS = 'prof-col-widths-v1'

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtFull(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function marginColor(m: number | null) {
  if (m === null) return 'text-slate-400'
  if (m < 0)  return 'text-red-600'
  if (m < 20) return 'text-orange-600'
  if (m < 40) return 'text-amber-600'
  return 'text-green-600'
}
function marginBg(m: number | null) {
  if (m === null) return 'bg-slate-100'
  if (m < 0)  return 'bg-red-100'
  if (m < 20) return 'bg-orange-100'
  if (m < 40) return 'bg-amber-100'
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

function CollapsibleCard({ title, rows, keyFn }: { title: string; rows: ProfitRow[]; keyFn: keyof ProfitRow }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
        style={{ backgroundColor: open ? 'rgba(78,0,142,0.04)' : undefined }}>
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{rows.length} clients</span>
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Client','Bookkeeper','Hours','Revenue','Profit','Margin'].map(h => (
                  <th key={h} className={`px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${h === 'Client' || h === 'Bookkeeper' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-4 py-2">
                    <Link href={`/clients/${r.code}`} className="font-medium text-slate-800 hover:text-bba-action transition-colors">{r.name}</Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.bookkeeper ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{r.hoursUsed.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{fmt(r.revenue)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(r.profit)}</td>
                  <td className="px-4 py-2 text-right">
                    {r.margin !== null
                      ? <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${marginBg(r.margin)} ${marginColor(r.margin)}`}>{r.margin}%</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}
function today() { return new Date().toISOString().split('T')[0] }

export default function ProfitabilityPage() {
  const [rows,             setRows]             = useState<ProfitRow[]>([])
  const [totals,           setTotals]           = useState<Totals | null>(null)
  const [harvestConnected, setHarvestConnected] = useState(false)
  const [harvestError,     setHarvestError]     = useState<string | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)
  const [from,             setFrom]             = useState(firstOfMonth())
  const [to,               setTo]               = useState(today())
  const [search,           setSearch]           = useState('')
  const [bkFilter,         setBkFilter]         = useState('all')
  const [sortKey,          setSortKey]          = useState<ColKey>('profit')
  const [sortDir,          setSortDir]          = useState<SortDir>('desc')

  // Column order & widths
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    try { const s = localStorage.getItem(STORAGE_ORDER); if (s) return JSON.parse(s) } catch {}
    return ALL_COLS.map(c => c.key)
  })
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { const s = localStorage.getItem(STORAGE_WIDTHS); if (s) return JSON.parse(s) } catch {}
    return {}
  })

  // Pointer drag for col reorder
  const colDrag = useRef<{ key: string } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  function startColDrag(e: React.MouseEvent, key: string) {
    e.preventDefault()
    colDrag.current = { key }
    let latest: string | null = null
    function onMove(ev: MouseEvent) {
      const ths = document.querySelectorAll('[data-prof-col]')
      for (const th of ths) {
        const r = th.getBoundingClientRect()
        if (ev.clientX >= r.left && ev.clientX <= r.right) { latest = (th as HTMLElement).dataset.profCol ?? null; setDragOver(latest); break }
      }
    }
    function onUp() {
      if (colDrag.current && latest && latest !== colDrag.current.key) {
        setColOrder(prev => {
          const next = [...prev]
          const fi = next.indexOf(colDrag.current!.key as ColKey)
          const ti = next.indexOf(latest as ColKey)
          if (fi !== -1 && ti !== -1) { next.splice(fi, 1); next.splice(ti, 0, colDrag.current!.key as ColKey) }
          localStorage.setItem(STORAGE_ORDER, JSON.stringify(next))
          return next
        })
      }
      colDrag.current = null; setDragOver(null)
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // Column resize
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null)
  function startResize(e: React.MouseEvent, key: string) {
    e.preventDefault(); e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement
    resizing.current = { key, startX: e.clientX, startW: th.getBoundingClientRect().width }
    function onMove(ev: MouseEvent) {
      if (!resizing.current) return
      const w = Math.max(60, resizing.current.startW + ev.clientX - resizing.current.startX)
      setColWidths(prev => { const next = { ...prev, [resizing.current!.key]: w }; localStorage.setItem(STORAGE_WIDTHS, JSON.stringify(next)); return next })
    }
    function onUp() { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  function load() {
    setLoading(true); setError(null)
    fetch(`/api/profitability?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setRows(d.rows ?? []); setTotals(d.totals ?? null)
        setHarvestConnected(d.harvestConnected ?? false); setHarvestError(d.harvestError ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  useBookkeeperSync(useCallback(({ clientId, bookkeeper }) => {
    setRows(prev => prev.map(r => r.id === clientId ? { ...r, bookkeeper: bookkeeper ?? '' } : r))
  }, []))

  const bookkeepers = useMemo(() => [...new Set(rows.map(r => r.bookkeeper).filter(Boolean))].sort() as string[], [rows])

  const filtered = useMemo(() => {
    let list = rows
    if (search.trim()) list = list.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()))
    if (bkFilter !== 'all') list = list.filter(r => r.bookkeeper === bkFilter)
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')         cmp = a.name.localeCompare(b.name)
      if (sortKey === 'bookkeeper')   cmp = (a.bookkeeper ?? '').localeCompare(b.bookkeeper ?? '')
      if (sortKey === 'revenue')      cmp = a.revenue - b.revenue
      if (sortKey === 'totalMonthly') cmp = a.totalMonthly - b.totalMonthly
      if (sortKey === 'cost')         cmp = a.cost - b.cost
      if (sortKey === 'profit')       cmp = a.profit - b.profit
      if (sortKey === 'margin')       cmp = (a.margin ?? -999) - (b.margin ?? -999)
      if (sortKey === 'hoursUsed')    cmp = a.hoursUsed - b.hoursUsed
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, search, bkFilter, sortKey, sortDir])

  function toggleSort(k: ColKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  // Collapsible card data
  const byProfit  = [...filtered].sort((a, b) => b.profit  - a.profit)
  const byRevenue = [...filtered].sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#b20476" }}>Profitability</h1>
          <p className="mt-1 text-sm text-slate-500">
            Revenue minus cost of delivery per client
            {harvestConnected
              ? <span className="ml-2 inline-flex items-center gap-1 text-green-600 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Harvest connected</span>
              : <span className="ml-2 inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Using budgeted hours</span>}
            {harvestError && <span className="ml-2 text-xs text-red-500 font-mono">⚠ {harvestError.slice(0, 80)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-action [color-scheme:light]" />
          <span className="text-slate-400 text-sm">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-action [color-scheme:light]" />
          <button onClick={load} disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: '#b20476' }}>
            {loading ? '…' : 'Run'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4"><p className="text-sm text-red-600">{error}</p></div>}

      {/* Summary cards */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Revenue"    value={fmt(totals.revenue)} sub={`${rows.length} clients`} />
          <StatCard label="Cost of Delivery" value={fmt(totals.cost)} color="text-slate-700" />
          <StatCard label="Gross Profit"     value={fmt(totals.profit)} color={totals.profit >= 0 ? 'text-green-700' : 'text-red-600'} />
          <StatCard label="Gross Margin"     value={totals.margin !== null ? `${totals.margin}%` : '—'} color={marginColor(totals.margin)} sub="Revenue − Cost ÷ Revenue" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
            className="rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-action w-52" />
        </div>
        <select value={bkFilter} onChange={e => setBkFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-action">
          <option value="all">All Bookkeepers</option>
          {bookkeepers.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <p className="text-xs text-slate-400 ml-auto">
          {filtered.length} of {rows.length} clients{!harvestConnected && ' · hours are budgeted estimates'}
        </p>
      </div>

      {/* Collapsible summary cards */}
      {filtered.length > 0 && !loading && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Rankings</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleCard title="Top 15 by Profit"     rows={byProfit.slice(0, 15)}               keyFn="profit"  />
            <CollapsibleCard title="Bottom 15 by Profit"  rows={[...byProfit].reverse().slice(0, 15)} keyFn="profit"  />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleCard title="Top 15 by Revenue"    rows={byRevenue.slice(0, 15)}               keyFn="revenue" />
            <CollapsibleCard title="Bottom 15 by Revenue" rows={[...byRevenue].reverse().slice(0, 15)} keyFn="revenue" />
          </div>
        </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-bba-action border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#4e008e' }}>
                {colOrder.map((key) => {
                  const col = ALL_COLS.find(c => c.key === key)!
                  const isDragOver = dragOver === key && colDrag.current?.key !== key
                  return (
                    <th key={key} data-prof-col={key}
                      onMouseDown={e => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        if (e.clientX > rect.right - 16) return
                        startColDrag(e, key)
                      }}
                      className={`relative px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider select-none cursor-grab active:cursor-grabbing transition-colors ${isDragOver ? 'bg-white/20' : ''}`}
                      style={{ width: colWidths[key] ?? undefined, minWidth: colWidths[key] ?? undefined }}
                    >
                      <button onClick={() => toggleSort(key)}
                        className="flex items-center justify-center gap-1 w-full text-white font-bold leading-tight hover:opacity-80 transition-opacity">
                        {col.label}
                        <span className="text-[9px] opacity-60 shrink-0">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                      {/* Resize handle */}
                      <div onMouseDown={e => startResize(e, key)}
                        className="absolute right-0 top-0 h-full w-4 cursor-col-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
                        onClick={e => e.stopPropagation()}>
                        <div className="h-4 w-0.5 rounded-full bg-white/40" />
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={colOrder.length} className="px-4 py-12 text-center text-sm text-slate-400">No clients match your filters.</td></tr>
              ) : filtered.map((row, i) => {
                const bg = i % 2 === 0 ? '#ffffff' : '#faf5ff'
                return (
                  <tr key={row.id} style={{ backgroundColor: bg, borderBottom: '1px solid #f0e8f8' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3e8ff' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = bg }}>
                    {colOrder.map(key => {
                      const col = ALL_COLS.find(c => c.key === key)!
                      const cls = `px-4 py-3 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`
                      switch (key) {
                        case 'name':       return <td key={key} className={cls}><Link href={`/clients/${row.code}`} className="group"><p className="font-medium text-slate-800 group-hover:text-bba-action transition-colors">{row.name}</p><p className="text-[10px] font-mono text-slate-400">{row.code}</p></Link></td>
                        case 'bookkeeper': return <td key={key} className={cls + ' text-slate-600'}>{row.bookkeeper ?? <span className="text-slate-300">—</span>}{row.costRate > 0 && <span className="ml-1 text-[10px] text-slate-400">(${row.costRate}/hr)</span>}</td>
                        case 'hoursUsed':  return <td key={key} className={cls + ' text-slate-700'}>{row.hoursUsed.toFixed(1)}{row.harvestHrs === null && row.budgetedHrs > 0 && <span className="ml-1 text-[10px] text-slate-400">est</span>}</td>
                        case 'revenue':    return <td key={key} className={cls + ' text-slate-700'}>{fmtFull(row.revenue)}</td>
                        case 'totalMonthly': return <td key={key} className={cls + ' text-slate-500'}>{fmtFull(row.totalMonthly ?? 0)}</td>
                        case 'cost':       return <td key={key} className={cls + ' text-slate-700'}>{fmtFull(row.cost)}</td>
                        case 'profit':     return <td key={key} className={cls + ` font-semibold ${row.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtFull(row.profit)}</td>
                        case 'margin':     return <td key={key} className={cls}>{row.margin !== null ? <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${marginBg(row.margin)} ${marginColor(row.margin)}`}>{row.margin}%</span> : <span className="text-slate-300">—</span>}</td>
                        default:           return <td key={key} />
                      }
                    })}
                  </tr>
                )
              })}
            </tbody>
            {totals && filtered.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'rgba(78,0,142,0.06)', borderTop: '2px solid rgba(78,0,142,0.15)' }}>
                  {colOrder.map((key, i) => {
                    const cls = 'px-4 py-3 text-right tabular-nums text-sm font-semibold text-slate-700'
                    if (i === 0) return <td key={key} className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider" colSpan={2}>Totals ({filtered.length} clients)</td>
                    if (i === 1) return null
                    switch (key) {
                      case 'hoursUsed':    return <td key={key} className={cls}>{filtered.reduce((s, r) => s + r.hoursUsed, 0).toFixed(1)}</td>
                      case 'revenue':      return <td key={key} className={cls}>{fmtFull(filtered.reduce((s, r) => s + r.revenue, 0))}</td>
                      case 'totalMonthly': return <td key={key} className={cls}>{fmtFull(filtered.reduce((s, r) => s + (r.totalMonthly ?? 0), 0))}</td>
                      case 'cost':         return <td key={key} className={cls}>{fmtFull(filtered.reduce((s, r) => s + r.cost, 0))}</td>
                      case 'profit':       return <td key={key} className="px-4 py-3 text-right tabular-nums text-sm font-bold text-green-700">{fmtFull(filtered.reduce((s, r) => s + r.profit, 0))}</td>
                      case 'margin': {
                        const rev = filtered.reduce((s, r) => s + r.revenue, 0)
                        const pft = filtered.reduce((s, r) => s + r.profit, 0)
                        const m   = rev > 0 ? parseFloat(((pft / rev) * 100).toFixed(1)) : null
                        return <td key={key} className="px-4 py-3 text-right">{m !== null ? <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${marginBg(m)} ${marginColor(m)}`}>{m}%</span> : <span className="text-slate-300">—</span>}</td>
                      }
                      default: return <td key={key} />
                    }
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
