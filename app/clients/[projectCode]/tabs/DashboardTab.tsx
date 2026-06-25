"use client";

import { useState, useEffect, useCallback } from "react";

function poolHrs(targetHours: number): number {
  if (targetHours <= 10) return 0.25;
  if (targetHours <= 20) return 0.50;
  return 0.75;
}

function fmtHrs(n: number) {
  return n % 1 === 0 ? `${n}` : n.toFixed(2)
}

interface HarvestHours {
  bkpr: number; qa: number; ye: number; mgmt: number; other: number; total: number
}

interface Props {
  clientId: string
  client: any
  projectCode: string
}

export default function DashboardTab({ client, projectCode }: Props) {
  const [rawNotes,    setRawNotes]   = useState('');
  const [submitState, setSubmit]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [harvest,     setHarvest]    = useState<HarvestHours | null>(null)
  const [harvestConnected, setHarvestConnected] = useState(false)
  const [harvestLoading,   setHarvestLoading]   = useState(true)
  const [harvestError,     setHarvestError]      = useState<string | null>(null)

  // Date range — current month
  const now   = new Date()
  const from  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]

  // Pool accumulation periods
  const qtrStart = (() => {
    const m = now.getMonth()
    const qtrMonth = Math.floor(m / 3) * 3
    return `${now.getFullYear()}-${String(qtrMonth + 1).padStart(2, '0')}-01`
  })()
  const yearStart = `${now.getFullYear()}-01-01`
  const monthsInQtr  = Math.floor((now.getMonth() % 3)) + 1
  const monthsInYear = now.getMonth() + 1

  const [harvestAccum, setHarvestAccum] = useState<{ qa: number; ye: number; mgmt: number } | null>(null)

  // Fetch Harvest hours for this client
  const loadHarvest = useCallback(() => {
    if (!projectCode) return
    setHarvestLoading(true)

    // Current month hours
    Promise.all([
      fetch(`/api/harvest/hours?code=${projectCode}&from=${from}&to=${today}`).then(r => r.json()),
      fetch(`/api/harvest/hours?code=${projectCode}&from=${qtrStart}&to=${today}`).then(r => r.json()),
      fetch(`/api/harvest/hours?code=${projectCode}&from=${yearStart}&to=${today}`).then(r => r.json()),
    ])
      .then(([month, qtr, year]) => {
        setHarvestConnected(month.connected ?? false)
        setHarvestError(month.error ?? null)
        if (month.hours) setHarvest(month.hours)
        if (qtr.hours && year.hours) {
          setHarvestAccum({
            qa:   qtr.hours.qa   ?? 0,
            mgmt: qtr.hours.mgmt ?? 0,
            ye:   year.hours.ye  ?? 0,
          })
        }
      })
      .catch(e => setHarvestError(e.message))
      .finally(() => setHarvestLoading(false))
  }, [projectCode, from, today, qtrStart, yearStart])

  useEffect(() => { loadHarvest() }, [loadHarvest])

  // Hours budget from client record
  const target      = Number(client?.totalHrsPerMonth ?? 0)
  const PER_CAT     = poolHrs(target)
  const QA_BUDGET   = Number(client?.qaHours         ?? PER_CAT)
  const MGMT_BUDGET = Number(client?.custSuccessMgmtHrs ?? PER_CAT)
  const YE_BUDGET   = Number(client?.yeOrTaxHours    ?? PER_CAT)
  const POOL_TOTAL  = QA_BUDGET + MGMT_BUDGET + YE_BUDGET
  const NET_BK      = Math.max(target - POOL_TOTAL, 0)

  // Actual hours — from Harvest if connected, else from DB bkprHours
  const bkUsed   = harvestConnected && harvest ? harvest.bkpr  : Number(client?.bkprHours ?? 0)
  const qaUsed   = harvestConnected && harvest ? harvest.qa    : 0
  const yeUsed   = harvestConnected && harvest ? harvest.ye    : 0
  const mgmtUsed = harvestConnected && harvest ? harvest.mgmt  : 0
  const totalUsed = harvestConnected && harvest ? harvest.total : bkUsed

  const pct       = NET_BK > 0 ? Math.min((bkUsed / NET_BK) * 100, 150) : 0
  const remaining = Math.max(NET_BK - bkUsed, 0)
  const isOver    = bkUsed > NET_BK && NET_BK > 0

  // Cost rate
  const rate = Number(client?.costRate ?? 0)

  // Pool progress helpers
  function PoolCard({ label, sublabel, used, budget, color }: { label: string; sublabel: string; used: number; budget: number; color: string }) {
    const poolPct = budget > 0 ? Math.min((used / budget) * 100, 100) : 0
    const over    = used > budget && budget > 0
    return (
      <div className={`rounded-xl border p-4 space-y-2 ${over ? 'border-red-200 bg-red-50' : 'bg-white border-slate-100'}`}>
        <div>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
          <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold" style={{ color: over ? '#ef4444' : color }}>
            {fmtHrs(used)} <span className="text-sm font-normal text-slate-400">hrs used</span>
          </p>
          <span className={`text-xs font-medium ${over ? 'text-red-600' : 'text-slate-400'}`}>
            of {budget > 0 ? fmtHrs(budget) : '—'}
          </span>
        </div>
        {budget > 0 && (
          <div className="h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full transition-all" style={{ width: `${poolPct}%`, backgroundColor: over ? '#ef4444' : color }} />
          </div>
        )}
      </div>
    )
  }

  // Accumulated pool budgets
  const QA_ACCUM     = parseFloat((QA_BUDGET   * monthsInQtr).toFixed(2))
  const YE_ACCUM     = parseFloat((YE_BUDGET   * monthsInYear).toFixed(2))
  const MGMT_ACCUM   = parseFloat((MGMT_BUDGET * monthsInQtr).toFixed(2))
    e.preventDefault()
    if (!rawNotes.trim()) return
    setSubmit('loading')
    try {
      const res = await fetch('/api/clients/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectCode, rawNotes }),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmit('done'); setRawNotes('')
    } catch { setSubmit('error') }
  }

  return (
    <div className="space-y-6">

      {/* Monthly Bookkeeper Budget */}
      <div className="rounded-2xl overflow-hidden border border-purple-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-bba-primary text-white">
          <h2 className="text-base font-semibold">Monthly Bookkeeper Budget</h2>
          <span className="text-sm font-medium opacity-70">
            {rate > 0 ? `$${rate}/hr` : 'Rate not set'}
          </span>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-purple-100 bg-purple-50">
          {[
            { label: 'Total Hrs / Mo',   value: fmtHrs(target)    },
            { label: 'Pool Deductions',  value: fmtHrs(POOL_TOTAL) },
            { label: 'Net Bkkeeper Hrs', value: fmtHrs(NET_BK), highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="px-6 py-4 text-center">
              <p className={`text-2xl font-bold ${highlight ? 'text-purple-700' : 'text-slate-700'}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {/* Usage row */}
        <div className="px-6 py-3 bg-purple-50 border-t border-purple-100 flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {fmtHrs(bkUsed)} bookkeeper hrs used
            {harvestConnected
              ? <span className="ml-2 inline-flex items-center gap-1 text-green-600 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Live from Harvest</span>
              : harvestLoading
                ? <span className="ml-2 text-slate-400 text-xs">Loading Harvest…</span>
                : <span className="ml-2 text-amber-600 text-xs">⚠ {harvestError ?? 'Not connected'}</span>
            }
          </span>
          <span className="text-slate-500">{fmtHrs(remaining)} hrs remaining</span>
        </div>
        {/* Progress bar */}
        <div className="px-6 pb-4 bg-purple-50">
          <div className="h-2 rounded-full bg-purple-100">
            <div className={`h-2 rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-purple-500'}`}
              style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-slate-400">
            <span className={isOver ? 'text-red-500 font-medium' : ''}>
              {pct.toFixed(1)}% of net budget {isOver ? '— OVER BUDGET' : ''}
            </span>
            <span>{fmtHrs(NET_BK)} hrs available</span>
          </div>
        </div>
      </div>

      {/* Pool cards */}
      <div className="grid grid-cols-3 gap-4">
        <PoolCard
          label="Rolling QA Pool"
          sublabel={`Quarter to date · ${monthsInQtr} of 3 months`}
          used={harvestConnected && harvestAccum ? harvestAccum.qa : qaUsed * monthsInQtr}
          budget={QA_ACCUM}
          color="#8b5cf6"
        />
        <PoolCard
          label="Mgmt + CS Pool"
          sublabel={`Quarter to date · ${monthsInQtr} of 3 months`}
          used={harvestConnected && harvestAccum ? harvestAccum.mgmt : mgmtUsed * monthsInQtr}
          budget={MGMT_ACCUM}
          color="#ec4899"
        />
        <PoolCard
          label="Annual YE Pool"
          sublabel={`Year to date · ${monthsInYear} of 12 months`}
          used={harvestConnected && harvestAccum ? harvestAccum.ye : yeUsed * monthsInYear}
          budget={YE_ACCUM}
          color="#f59e0b"
        />
      </div>

      {/* Harvest breakdown (if connected) */}
      {harvestConnected && harvest && harvest.total > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Harvest Hours This Month</h3>
            <span className="text-xs text-slate-400">{from} – {today}</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Bookkeeping', value: harvest.bkpr,  color: 'text-purple-700' },
              { label: 'QA',          value: harvest.qa,    color: 'text-violet-600' },
              { label: 'Year-End',    value: harvest.ye,    color: 'text-amber-600'  },
              { label: 'Mgmt/CS',     value: harvest.mgmt,  color: 'text-pink-600'   },
              { label: 'Other',       value: harvest.other, color: 'text-slate-500'  },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`text-lg font-bold ${color}`}>{fmtHrs(value)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
            <span>Total logged: <strong>{fmtHrs(harvest.total)} hrs</strong></span>
            {rate > 0 && <span>Cost: <strong>${(harvest.total * rate).toFixed(2)}</strong></span>}
          </div>
        </div>
      )}

      {/* AI Call Log */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">AI Call Log</h3>
          <p className="text-xs text-slate-400 mt-0.5">Paste raw call notes — Claude will extract a structured summary and save it to the client record.</p>
        </div>
        <form onSubmit={handleSubmitNotes} className="space-y-3">
          <textarea
            value={rawNotes}
            onChange={e => setRawNotes(e.target.value)}
            placeholder="Paste raw meeting notes here…"
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitState === 'loading' || !rawNotes.trim()}
              className="rounded-lg bg-bba-primary px-4 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 disabled:opacity-50 transition-colors">
              {submitState === 'loading' ? 'Processing…' : 'Process Notes'}
            </button>
            {submitState === 'done'  && <span className="text-xs text-green-600">✓ Saved</span>}
            {submitState === 'error' && <span className="text-xs text-red-500">Failed — try again</span>}
          </div>
        </form>
      </div>

    </div>
  );
}
