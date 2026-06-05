"use client";

import { useState, useEffect } from "react";
import { CLIENTS, SUBSCRIPTIONS, ACCOUNTANTS, type ProcessingCadence, type BillingCadence, type Accountant } from "@/lib/mock-data";
import { useRouter } from "next/navigation";

interface Props { clientId: string }

const CADENCE_OPTS: { value: ProcessingCadence; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
];

const BILLING_OPTS: { value: BillingCadence; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];

interface SubRow {
  id: string
  softwareName: string
  tier: string
  ourCost: string
  clientPrice: string
  billingCadence: BillingCadence
}

const inputCls = 'w-full rounded-lg bg-[#4e008e] border border-bba-secondary/30 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-bba-highlight focus:border-transparent';
const selCls   = 'w-full rounded-lg bg-[#4e008e] border border-bba-secondary/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-bba-highlight focus:border-transparent [color-scheme:dark]';

export default function SettingsTab({ clientId }: Props) {
  const client = CLIENTS.find(c => c.id === clientId)!;

  const [ops, setOps] = useState({
    autoPriceIncreasePercent: String(client?.autoPriceIncreasePercent ?? ''),
    priceAdjustmentDate:      client?.priceAdjustmentDate ?? '',
    accountantName:           client?.accountantName ?? '',
    guaranteedDeadlineDay:    String(client?.guaranteedDeadlineDay ?? ''),
    processingCadence:        (client?.processingCadence ?? 'MONTHLY') as ProcessingCadence,
    okToContactAccountant:    client?.okToContactAccountant ?? false,
  });
  const [opsSaved,        setOpsSaved]      = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [confirmText,     setConfirmText]   = useState('');
  const [archiveStatus,   setArchiveStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [accountants,     setAccountants]   = useState<Accountant[]>(ACCOUNTANTS.filter(a => a.status === 'ACTIVE'));
  const router = useRouter();

  useEffect(() => {
    fetch('/api/accountants')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.accountants)) setAccountants(d.accountants.filter((a: Accountant) => a.status === 'ACTIVE')) })
      .catch(() => {})
  }, []);

  const initSubs: SubRow[] = SUBSCRIPTIONS
    .filter(s => s.clientId === clientId)
    .map(s => ({ id: s.id, softwareName: s.softwareName, tier: s.tier ?? '', ourCost: String(s.ourCost), clientPrice: String(s.clientPrice), billingCadence: s.billingCadence }));
  const [subs, setSubs] = useState<SubRow[]>(initSubs);

  function saveOps(e: React.FormEvent) {
    e.preventDefault();
    console.log('[Settings] ops saved:', ops);
    setOpsSaved(true);
    setTimeout(() => setOpsSaved(false), 2000);
  }

  function updateSub(id: string, field: keyof SubRow, val: string) {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  }

  function addRow() {
    setSubs(prev => [...prev, { id: `new-${Date.now()}`, softwareName: '', tier: '', ourCost: '', clientPrice: '', billingCadence: 'MONTHLY' }]);
  }

  function removeRow(id: string) { setSubs(prev => prev.filter(s => s.id !== id)); }

  function marginColor(cost: string, price: string) {
    const m = parseFloat(price) - parseFloat(cost);
    if (isNaN(m)) return 'text-slate-500';
    return m > 0 ? 'text-emerald-400' : m < 0 ? 'text-red-400' : 'text-slate-400';
  }

  const monthlySubs  = subs.filter(s => s.billingCadence === 'MONTHLY');
  const totalOurCost = monthlySubs.reduce((s, r) => s + (parseFloat(r.ourCost) || 0), 0);
  const totalClPrice = monthlySubs.reduce((s, r) => s + (parseFloat(r.clientPrice) || 0), 0);
  const totalMargin  = totalClPrice - totalOurCost;

  return (
    <div className="space-y-10">
      {/* ── Operational Settings ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Operational Settings</h3>
        <form onSubmit={saveOps} className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Auto Price Increase %</label>
              <div className="relative">
                <input
                  type="number" step="0.1" min={0}
                  value={ops.autoPriceIncreasePercent}
                  onChange={e => setOps(o => ({ ...o, autoPriceIncreasePercent: e.target.value }))}
                  placeholder="e.g. 3.5"
                  className={inputCls}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Price Adjustment Date</label>
              <input
                type="date"
                value={ops.priceAdjustmentDate}
                onChange={e => setOps(o => ({ ...o, priceAdjustmentDate: e.target.value }))}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Accountant</label>
              <select
                value={ops.accountantName}
                onChange={e => setOps(o => ({ ...o, accountantName: e.target.value }))}
                className={selCls}
              >
                <option value="">— Select accountant —</option>
                {accountants.map(a => (
                  <option key={a.id} value={a.name}>{a.name}{a.businessName ? ` — ${a.businessName}` : ''}</option>
                ))}
              </select>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700/60 px-4 py-3">
                <div>
                  <span className="text-sm text-slate-300">Okay to contact accountant directly?</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Client authorises BBA to contact their accountant</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOps(o => ({ ...o, okToContactAccountant: !o.okToContactAccountant }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${ops.okToContactAccountant ? 'bg-bba-primary' : 'bg-slate-600'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${ops.okToContactAccountant ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Guaranteed Deadline Day</label>
              <input
                type="number" min={1} max={31}
                value={ops.guaranteedDeadlineDay}
                onChange={e => setOps(o => ({ ...o, guaranteedDeadlineDay: e.target.value }))}
                placeholder="Day 1 – 31"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-2">Processing Cadence</label>
              <div className="grid grid-cols-4 gap-2">
                {CADENCE_OPTS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOps(prev => ({ ...prev, processingCadence: o.value }))}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${ops.processingCadence === o.value ? 'bg-bba-primary/20 border-bba-primary/50 text-bba-highlight' : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${opsSaved ? 'bg-emerald-600 text-white' : 'bg-bba-primary text-white hover:bg-bba-primary/85'}`}
            >
              {opsSaved ? '✓ Saved' : 'Save Settings'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Software Subscriptions ── */}
      <section>
        <div className="rounded-xl border border-slate-700/60 overflow-hidden">
          <div className="border-b border-slate-700/60 px-5 py-3.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Software Subscriptions</h3>
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#3d0070', borderBottom: '1px solid rgba(212,190,190,0.13)' }}>
                {['Software', 'Tier', 'Our Cost', 'Client Price', 'Margin', 'Cadence', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {subs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No subscriptions yet. Click "Add Row" to start tracking.
                  </td>
                </tr>
              )}
              {subs.map(sub => {
                const margin = (parseFloat(sub.clientPrice) || 0) - (parseFloat(sub.ourCost) || 0);
                const hasValues = sub.ourCost && sub.clientPrice;
                return (
                  <tr key={sub.id} className="bg-slate-900/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2 min-w-[160px]">
                      <input
                        type="text" value={sub.softwareName}
                        onChange={e => updateSub(sub.id, 'softwareName', e.target.value)}
                        placeholder="Software name"
                        className="w-full bg-transparent rounded px-2 py-1 text-sm text-slate-200 placeholder-slate-600 border border-transparent hover:border-slate-700 focus:border-bba-highlight focus:outline-none focus:ring-1 focus:ring-bba-highlight"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text" value={sub.tier}
                        onChange={e => updateSub(sub.id, 'tier', e.target.value)}
                        placeholder="Tier"
                        className="w-20 bg-transparent rounded px-2 py-1 text-xs text-slate-400 placeholder-slate-600 border border-transparent hover:border-slate-700 focus:border-bba-highlight focus:outline-none focus:ring-1 focus:ring-bba-highlight"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative w-24">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                        <input
                          type="number" step="0.01" value={sub.ourCost}
                          onChange={e => updateSub(sub.id, 'ourCost', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-transparent rounded pl-5 pr-2 py-1 text-sm text-slate-300 placeholder-slate-600 border border-transparent hover:border-slate-700 focus:border-bba-highlight focus:outline-none focus:ring-1 focus:ring-bba-highlight tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative w-24">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                        <input
                          type="number" step="0.01" value={sub.clientPrice}
                          onChange={e => updateSub(sub.id, 'clientPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-transparent rounded pl-5 pr-2 py-1 text-sm text-slate-300 placeholder-slate-600 border border-transparent hover:border-slate-700 focus:border-bba-highlight focus:outline-none focus:ring-1 focus:ring-bba-highlight tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-sm font-semibold tabular-nums ${hasValues ? marginColor(sub.ourCost, sub.clientPrice) : 'text-slate-600'}`}>
                        {hasValues ? `+$${margin.toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={sub.billingCadence}
                        onChange={e => updateSub(sub.id, 'billingCadence', e.target.value)}
                        className="rounded-md border border-bba-secondary/30 bg-[#4e008e] px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-bba-primary [color-scheme:dark]"
                      >
                        {BILLING_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeRow(sub.id)}
                        className="rounded p-1 text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {subs.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-700/60 bg-slate-800/40">
                  <td colSpan={2} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Monthly Totals</td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-300">${totalOurCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-300">${totalClPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums text-emerald-400">+${totalMargin.toFixed(2)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </div>
      </section>

      {/* ── End Contract / Archive Account ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          End Contract &amp; Archive Account
        </h3>

        <div className="rounded-xl border-2 border-red-900/60 bg-red-950/20 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
              <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-red-400">Permanent Action — Cannot Be Undone</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                This pipeline will: export all client data to Google Drive, terminate the Anchor billing agreement,
                archive the Harvest project and ClickUp workspace, then permanently delete all client records
                from the database.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            {['📁 Google Drive export', '💳 Anchor billing terminated', '⏱ Harvest project archived', '✅ ClickUp folder archived', '🗑 Database records deleted', '🔒 Access permanently revoked'].map(s => (
              <div key={s} className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-slate-600" />{s}</div>
            ))}
          </div>

          {!archiveExpanded ? (
            <button
              onClick={() => setArchiveExpanded(true)}
              className="w-full rounded-lg border border-red-700 bg-red-900/30 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-900/50 active:scale-95 transition-all"
            >
              End Contract &amp; Run Archive Pipeline →
            </button>
          ) : (
            <div className="space-y-3 border-t border-red-900/40 pt-4">
              <p className="text-xs text-red-300 font-semibold">
                Type <span className="font-mono bg-red-900/40 px-1.5 py-0.5 rounded text-red-200">CONFIRM</span> exactly to authorise this action:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="Type CONFIRM to proceed"
                className="w-full rounded-lg border border-red-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
              />
              <div className="flex items-center gap-3">
                <button
                  disabled={confirmText !== 'CONFIRM' || archiveStatus === 'loading'}
                  onClick={async () => {
                    if (confirmText !== 'CONFIRM') return;
                    setArchiveStatus('loading');
                    try {
                      const res = await fetch('/api/clients/archive', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ confirmation: 'CONFIRM', projectCode: client?.harvestProjectCode }),
                      });
                      if (!res.ok) throw new Error(await res.text());
                      setArchiveStatus('done');
                      setTimeout(() => router.push('/'), 2000);
                    } catch {
                      setArchiveStatus('error');
                      setTimeout(() => setArchiveStatus('idle'), 4000);
                    }
                  }}
                  className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-all active:scale-95 ${
                    archiveStatus === 'done'    ? 'bg-emerald-600 text-white cursor-default' :
                    archiveStatus === 'error'   ? 'bg-orange-600 text-white' :
                    archiveStatus === 'loading' ? 'bg-red-800 text-white cursor-wait' :
                    confirmText === 'CONFIRM'   ? 'bg-red-600 text-white hover:bg-red-500' :
                    'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  {archiveStatus === 'loading' ? 'Running Pipeline…' :
                   archiveStatus === 'done'    ? '✓ Archived — redirecting…' :
                   archiveStatus === 'error'   ? '✗ Error — check logs' :
                   'Confirm Archive'}
                </button>
                <button onClick={() => { setArchiveExpanded(false); setConfirmText(''); setArchiveStatus('idle'); }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
