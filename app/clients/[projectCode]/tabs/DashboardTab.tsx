"use client";

import { useState, useEffect } from "react";
import { SOWS, TIME_LOGS, CALL_LOGS, CLIENTS } from "@/lib/mock-data";
import type { CallLog } from "@/lib/mock-data";

// Pool hours per category: IF(target<=10, 0.25, IF(target<=20, 0.5, 0.75))
// Applies to QA, Management (includes CS), and Year-End — 3 categories total.
function poolHrsPerCategory(targetHours: number): number {
  if (targetHours <= 10) return 0.25;
  if (targetHours <= 20) return 0.50;
  return 0.75;
}

interface Props { clientId: string }

export default function DashboardTab({ clientId }: Props) {
  const [rawNotes,   setRawNotes]  = useState('');
  const [submitState, setSubmit]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [logs, setLogs]            = useState<CallLog[]>(() =>
    CALL_LOGS.filter(l => l.clientId === clientId).sort((a, b) => b.callDate.localeCompare(a.callDate))
  );

  const client = CLIENTS.find(c => c.id === clientId);
  const sow    = SOWS.find(s => s.clientId === clientId);

  const allLogs          = TIME_LOGS.filter(l => l.clientId === clientId);
  // Only bookkeeper-typed logs count against the core budget threshold
  const bookkeeperLogged = allLogs
    .filter(l => !l.logType || l.logType === 'BOOKKEEPER')
    .reduce((s, l) => s + l.hoursLogged, 0);
  const totalLogged      = allLogs.reduce((s, l) => s + l.hoursLogged, 0);

  const target       = sow?.targetHours ?? 0;
  const PER_CAT_HRS  = poolHrsPerCategory(target);
  const QA_HRS       = PER_CAT_HRS;
  const MGMT_HRS     = PER_CAT_HRS;   // covers Management + Customer Success
  const YE_HRS       = PER_CAT_HRS;
  const TOTAL_POOL_HRS = QA_HRS + MGMT_HRS + YE_HRS;
  const netBkHours   = Math.max(target - TOTAL_POOL_HRS, 0);   // bookkeeper net
  const pct          = netBkHours > 0 ? Math.min((bookkeeperLogged / netBkHours) * 100, 150) : 0;
  const remaining    = Math.max(netBkHours - bookkeeperLogged, 0);

  // Billing rate display
  const billingRateDisplay = sow?.billingType === 'FLAT'
    ? (target > 0 ? `$${((sow.fixedMonthlyRate ?? 0) / target).toFixed(2)}/hr equiv.` : `$${sow.fixedMonthlyRate}/mo`)
    : `$${sow?.billingRate ?? 0}/hr`;

  // Bar + text color: red ONLY when bookkeeper logs exceed net bookkeeper hours
  const isOverBudget = bookkeeperLogged > netBkHours && netBkHours > 0;
  const barColor = isOverBudget ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-bba-primary';
  const pctColor = isOverBudget ? 'text-red-400 font-semibold' : pct >= 80 ? 'text-amber-400' : 'text-bba-secondary';

  // Reload logs when a new one is added
  function refreshLogs(newLog: CallLog) {
    setLogs(prev => [newLog, ...prev]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawNotes.trim() || !client) return;
    setSubmit('loading');
    try {
      const res = await fetch('/api/clients/logs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ projectCode: client.harvestProjectCode, rawNotes }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { log } = await res.json() as { log: CallLog };
      refreshLogs(log);
      setRawNotes('');
      setSubmit('done');
      setTimeout(() => setSubmit('idle'), 2500);
    } catch {
      setSubmit('error');
      setTimeout(() => setSubmit('idle'), 3000);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Monthly Bookkeeper Budget ── */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        {/* Pink card header bar */}
        <div className="border-b border-slate-700/60 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Monthly Bookkeeper Budget</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {sow && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sow.billingType === 'FLAT' ? 'bg-white/20 text-white' : 'bg-white/20 text-white'}`}>
                {sow.billingType === 'FLAT' ? `Flat — $${sow.fixedMonthlyRate?.toLocaleString()}/mo` : `Hourly — $${sow.billingRate}/hr`}
              </span>
            )}
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white/80">
              {billingRateDisplay}
            </span>
          </div>
        </div>

        {/* Card body */}
        <div className="bg-slate-800/50 p-5 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-900/50 p-2.5">
              <p className="text-lg font-bold tabular-nums text-slate-100">{target.toFixed(1)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Total Hrs / Mo</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2.5">
              <p className="text-lg font-bold tabular-nums text-slate-100">{TOTAL_POOL_HRS.toFixed(2)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Pool Deductions</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2.5">
              <p className={`text-lg font-bold tabular-nums ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>{netBkHours.toFixed(1)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Net Bkkeeper Hrs</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{bookkeeperLogged.toFixed(1)} bookkeeper hrs used</span>
              <span>{netBkHours.toFixed(1)} hrs available</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-700/80">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className={pctColor}>{pct.toFixed(1)}% of net budget{isOverBudget ? ' — OVER BUDGET' : ''}</span>
              <span className="text-slate-400">{remaining.toFixed(1)} hrs remaining</span>
            </div>
          </div>

          {totalLogged > bookkeeperLogged && (
            <p className="text-[11px] text-slate-500">
              {(totalLogged - bookkeeperLogged).toFixed(2)} pool hrs (QA / Mgmt / Year-End) logged separately — excluded from budget threshold
            </p>
          )}
        </div>

        {/* Pool chips */}
        <div className="border-t border-slate-700/60 px-5 py-4 grid grid-cols-3 gap-2">
          {[
            { label: 'QA',         hrs: QA_HRS,   color: 'text-sky-400',    bg: 'bg-sky-400/5',    ring: 'ring-sky-400/20' },
            { label: 'Mgmt + CS',  hrs: MGMT_HRS, color: 'text-violet-400', bg: 'bg-violet-400/5', ring: 'ring-violet-400/20' },
            { label: 'Year-End',   hrs: YE_HRS,   color: 'text-amber-400',  bg: 'bg-amber-400/5',  ring: 'ring-amber-400/20' },
          ].map(p => (
            <div key={p.label} className={`rounded-lg ${p.bg} ring-1 ${p.ring} p-2.5 text-center`}>
              <p className={`text-base font-bold tabular-nums ${p.color}`}>{p.hrs.toFixed(2)}</p>
              <p className="text-[9px] font-medium text-slate-500 mt-0.5">{p.label}</p>
              <p className="text-[9px] text-slate-600">{p.hrs.toFixed(2)} h/mo</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rolling pool cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-sky-400 ring-2 ring-sky-400/20" />
            <h3 className="text-sm font-semibold text-sky-300">Rolling Quarterly QA Pool</h3>
          </div>
          <p className="text-3xl font-bold text-slate-100 tabular-nums">{(QA_HRS * 3).toFixed(2)} <span className="text-sm font-normal text-slate-400">hrs</span></p>
          <p className="mt-0.5 text-xs text-slate-500">Accumulated this quarter · {QA_HRS.toFixed(2)}h/mo</p>
          <div className="mt-3 overflow-hidden rounded-full bg-sky-900/50 h-1.5"><div className="h-full w-2/3 rounded-full bg-sky-500" /></div>
          <p className="mt-1 text-[10px] text-slate-500">2 of 3 months elapsed</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
            <h3 className="text-sm font-semibold text-amber-300">Annual Year-End Pool</h3>
          </div>
          <p className="text-3xl font-bold text-slate-100 tabular-nums">{(YE_HRS * 12).toFixed(2)} <span className="text-sm font-normal text-slate-400">hrs</span></p>
          <p className="mt-0.5 text-xs text-slate-500">Projected annual reserve (12 months)</p>
          <div className="mt-3 overflow-hidden rounded-full bg-amber-900/50 h-1.5"><div className="h-full w-5/12 rounded-full bg-amber-500" /></div>
          <p className="mt-1 text-[10px] text-slate-500">5 of 12 months elapsed</p>
        </div>
      </div>

      {/* ── AI Call Log submission ── */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-0.5">AI Call Log</h3>
        <p className="text-xs text-slate-500 mb-3">
          Paste raw call notes — Claude will extract a structured summary and save it to the client record.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={rawNotes} onChange={e => setRawNotes(e.target.value)} rows={5}
            placeholder="Paste raw meeting notes here…"
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100 placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-bba-primary"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 tabular-nums">{rawNotes.length} chars</span>
            <button type="submit" disabled={!rawNotes.trim() || submitState === 'loading'}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                submitState === 'done'    ? 'bg-emerald-600 text-white' :
                submitState === 'error'   ? 'bg-red-600 text-white' :
                submitState === 'loading' ? 'bg-bba-primary/90 text-white cursor-wait' :
                'bg-bba-primary text-white hover:bg-bba-primary/85 disabled:cursor-not-allowed disabled:opacity-40'
              }`}>
              {submitState === 'loading' ? 'Processing…' : submitState === 'done' ? '✓ Saved' : submitState === 'error' ? '✗ Error — retry' : 'Submit Log'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Past Log History ── */}
      {logs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Past Log History</h3>
          {logs.map((log, i) => (
            <div key={log.id ?? i} className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">
                  {new Date(log.callDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-[10px] text-slate-600">AI Summary</span>
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                {log.summary}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
