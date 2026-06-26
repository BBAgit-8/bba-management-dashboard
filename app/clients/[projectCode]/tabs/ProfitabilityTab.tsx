"use client";

import { useState, useEffect } from "react";

interface Props { clientId: string }

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProfitabilityTab({ clientId }: Props) {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    // Find this client in the profitability API
    const now   = new Date()
    const from  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const today = now.toISOString().split('T')[0]

    fetch(`/api/profitability?from=${from}&to=${today}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        const row = (d.rows ?? []).find((r: any) => r.id === clientId)
        if (row) setData({ ...row, harvestConnected: d.harvestConnected })
        else setError('Client not found in profitability data')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-bba-action border-t-transparent" />
    </div>
  )

  if (error || !data) return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
      {error ?? 'No data available'}
    </div>
  )

  const revenue    = data.revenue    ?? 0
  const totalCost  = data.cost       ?? 0
  const netProfit  = data.profit     ?? 0
  const margin     = data.margin     ?? 0
  const hoursUsed  = data.hoursUsed  ?? 0
  const harvestHrs = data.harvestHrs
  const budgetHrs  = data.budgetedHrs ?? 0
  const isPositive = netProfit >= 0

  return (
    <div className="space-y-6">

      {/* Hero metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Net Profitability</p>
          <p className={`mt-2 text-4xl font-bold tracking-tight tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : '−'}${fmt(Math.abs(netProfit))}
          </p>
          <p className={`mt-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {margin != null ? `${margin.toFixed(1)}% margin` : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">BK Revenue</p>
          <p className="mt-2 text-3xl font-bold text-slate-800 tabular-nums">${fmt(revenue)}</p>
          <p className="mt-1 text-xs text-slate-400">Bookkeeping rate (excl. software)</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Cost of Delivery</p>
          <p className="mt-2 text-3xl font-bold text-slate-800 tabular-nums">${fmt(totalCost)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {hoursUsed.toFixed(2)} hrs × ${data.costRate ?? 0}/hr
            {data.harvestConnected
              ? <span className="ml-1.5 inline-flex items-center gap-1 text-green-600"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Harvest</span>
              : <span className="ml-1.5 text-amber-500">budgeted</span>
            }
          </p>
        </div>
      </div>

      {/* Visual bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Revenue vs Cost</h3>
        {[
          { label: 'BK Revenue',   value: revenue,   color: 'bg-bba-action' },
          { label: 'Cost of Delivery', value: totalCost, color: isPositive ? 'bg-rose-400' : 'bg-red-600' },
        ].map(row => (
          <div key={row.label}>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>{row.label}</span>
              <span className="tabular-nums font-medium text-slate-700">${fmt(row.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                style={{ width: `${revenue > 0 ? Math.min((row.value / revenue) * 100, 100) : 0}%` }} />
            </div>
          </div>
        ))}
        <div className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
          isPositive ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          Net {isPositive ? 'profit' : 'loss'} of ${fmt(Math.abs(netProfit))}
          {margin != null ? ` — ${margin.toFixed(1)}% margin` : ''}
        </div>
      </div>

      {/* Hours detail */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-bba-primary">
          <h3 className="text-sm font-semibold text-white">Hours Detail</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { label: 'Bookkeeper', value: data.bookkeeper ?? '—' },
            { label: 'Effective Rate', value: data.costRate ? `$${data.costRate}/hr` : '—' },
            { label: 'Hours Used', value: `${hoursUsed.toFixed(2)} hrs`, note: data.harvestConnected ? 'from Harvest' : 'budgeted estimate' },
            { label: 'Harvest Hours', value: harvestHrs != null ? `${harvestHrs.toFixed(2)} hrs` : '—', note: 'actual logged' },
            { label: 'Budgeted Hours', value: `${budgetHrs.toFixed(2)} hrs`, note: 'from client record' },
          ].map(({ label, value, note }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-700">
                {value}
                {note && <span className="ml-1.5 text-xs text-slate-400">({note})</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
