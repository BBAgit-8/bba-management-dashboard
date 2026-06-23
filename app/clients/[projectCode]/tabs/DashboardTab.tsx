"use client";

import { useState, useEffect } from "react";
import { SOWS, TIME_LOGS, CALL_LOGS, CLIENTS } from "@/lib/mock-data";
import type { CallLog } from "@/lib/mock-data";

function poolHrsPerCategory(targetHours: number): number {
  if (targetHours <= 10) return 0.25;
  if (targetHours <= 20) return 0.50;
  return 0.75;
}

interface Props { clientId: string }

export default function DashboardTab({ clientId }: Props) {
  const [rawNotes,    setRawNotes]   = useState('');
  const [submitState, setSubmit]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [logs, setLogs]              = useState<CallLog[]>(() =>
    CALL_LOGS.filter(l => l.clientId === clientId).sort((a, b) => b.callDate.localeCompare(a.callDate))
  );

  const client = CLIENTS.find(c => c.id === clientId);
  const sow    = SOWS.find(s => s.clientId === clientId);

  const allLogs          = TIME_LOGS.filter(l => l.clientId === clientId);
  const bookkeeperLogged = allLogs
    .filter(l => !l.logType || l.logType === 'BOOKKEEPER')
    .reduce((s, l) => s + l.hoursLogged, 0);
  const totalLogged      = allLogs.reduce((s, l) => s + l.hoursLogged, 0);

  const target         = sow?.targetHours ?? 0;
  const PER_CAT_HRS    = poolHrsPerCategory(target);
  const QA_HRS         = PER_CAT_HRS;
  const MGMT_HRS       = PER_CAT_HRS;
  const YE_HRS         = PER_CAT_HRS;
  const TOTAL_POOL_HRS = QA_HRS + MGMT_HRS + YE_HRS;
  const netBkHours     = Math.max(target - TOTAL_POOL_HRS, 0);
  const pct            = netBkHours > 0 ? Math.min((bookkeeperLogged / netBkHours) * 100, 150) : 0;
  const remaining      = Math.max(netBkHours - bookkeeperLogged, 0);
  const isOverBudget   = bookkeeperLogged > netBkHours && netBkHours > 0;

  const billingRateDisplay = sow?.billingType === 'FLAT'
    ? (target > 0 ? `$${((sow.fixedMonthlyRate ?? 0) / target).toFixed(2)}/hr equiv.` : `$${sow.fixedMonthlyRate}/mo`)
    : `$${sow?.billingRate ?? 0}/hr`;

  const barColor = isOverBudget ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-bba-primary';
  const pctColor = isOverBudget ? 'text-red-600 font-semibold' : pct >= 80 ? 'text-amber-600' : 'text-purple-700';

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
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100"
          style={{ backgroundColor: 'var(--bba-primary)' }}>
          <h3 className="text-sm font-semibold text-white">Monthly Bookkeeper Budget</h3>
          <div className="flex items-center gap-2">
            {sow && (
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white/90">
                {sow.billingType === 'FLAT' ? `Flat — $${sow.fixedMonthlyRate?.toLocaleString()}/mo` : `Hourly — $${sow.billingRate}/hr`}
              </span>
            )}
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white/80">{billingRateDisplay}</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Total Hrs / Mo',   value: target.toFixed(1),         color: 'text-slate-800' },
              { label: 'Pool Deductions',  value: TOTAL_POOL_HRS.toFixed(2), color: 'text-slate-800' },
              { label: 'Net Bkkeeper Hrs', value: netBkHours.toFixed(1),     color: isOverBudget ? 'text-red-600' : 'text-green-700' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-slate-500">
              <span>{bookkeeperLogged.toFixed(1)} bookkeeper hrs used</span>
              <span>{netBkHours.toFixed(1)} hrs available</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className={pctColor}>{pct.toFixed(1)}% of net budget{isOverBudget ? ' — OVER BUDGET' : ''}</span>
              <span className="text-slate-400">{remaining.toFixed(1)} hrs remaining</span>
            </div>
          </div>

          {totalLogged > bookkeeperLogged && (
            <p className="text-[11px] text-slate-400">
              {(totalLogged - bookkeeperLogged).toFixed(2)} pool hrs (QA / Mgmt / Year-End) logged separately
            </p>
          )}
        </div>

        {/* Pool chips */}
        <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-3 gap-3">
          {[
            { label: 'QA',        hrs: QA_HRS,   bg: 'bg-sky-50',    text: 'text-sky-700',    ring: 'ring-sky-200'    },
            { label: 'Mgmt + CS', hrs: MGMT_HRS, bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
            { label: 'Year-End',  hrs: YE_HRS,   bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200'  },
          ].map(p => (
            <div key={p.label} className={`rounded-lg ${p.bg} ring-1 ${p.ring} p-3 text-center`}>
              <p className={`text-lg font-bold tabular-nums ${p.text}`}>{p.hrs.toFixed(2)}</p>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">{p.label}</p>
              <p className="text-[10px] text-slate-400">{p.hrs.toFixed(2)} h/mo</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rolling pool cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-sky-500 ring-2 ring-sky-200" />
            <h3 className="text-sm font-semibold text-sky-700">Rolling Quarterly QA Pool</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">
            {(QA_HRS * 3).toFixed(2)} <span className="text-sm font-normal text-slate-400">hrs</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Accumulated this quarter · {QA_HRS.toFixed(2)}h/mo</p>
          <div className="mt-3 overflow-hidden rounded-full bg-sky-100 h-1.5">
            <div className="h-full w-2/3 rounded-full bg-sky-500" />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">2 of 3 months elapsed</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-200" />
            <h3 className="text-sm font-semibold text-amber-700">Annual Year-End Pool</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">
            {(YE_HRS * 12).toFixed(2)} <span className="text-sm font-normal text-slate-400">hrs</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Projected annual reserve (12 months)</p>
          <div className="mt-3 overflow-hidden rounded-full bg-amber-100 h-1.5">
            <div className="h-full w-5/12 rounded-full bg-amber-500" />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">5 of 12 months elapsed</p>
        </div>
      </div>

      {/* ── AI Call Log ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-0.5">AI Call Log</h3>
        <p className="text-xs text-slate-400 mb-3">
          Paste raw call notes — Claude will extract a structured summary and save it to the client record.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={rawNotes} onChange={e => setRawNotes(e.target.value)} rows={5}
            placeholder="Paste raw meeting notes here…"
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 tabular-nums">{rawNotes.length} chars</span>
            <button type="submit" disabled={!rawNotes.trim() || submitState === 'loading'}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                submitState === 'done'    ? 'bg-green-600 text-white' :
                submitState === 'error'   ? 'bg-red-600 text-white' :
                submitState === 'loading' ? 'bg-bba-primary/80 text-white cursor-wait' :
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
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Past Log History</h3>
          {logs.map((log, i) => (
            <div key={log.id ?? i} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">
                  {new Date(log.callDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">AI Summary</span>
              </div>
              <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                {log.summary}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
