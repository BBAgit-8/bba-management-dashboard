"use client";

import { useState, useEffect } from "react";
import { type BillingCadence, type Accountant } from "@/lib/mock-data";
import { useRouter } from "next/navigation";

type ProcessingCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY';

interface Props {
  clientId: string
  projectCode: string
  client: any
}

const CADENCE_OPTS: { value: ProcessingCadence; label: string }[] = [
  { value: 'WEEKLY',    label: 'Weekly' },
  { value: 'BIWEEKLY',  label: 'Bi-Weekly' },
  { value: 'MONTHLY',   label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
];

const BILLING_OPTS: { value: BillingCadence; label: string }[] = [
  { value: 'MONTHLY',   label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL',    label: 'Annual' },
];

interface SubRow {
  id: string
  softwareName: string
  tier: string
  ourCost: string
  clientPrice: string
  billingCadence: BillingCadence
}

const inp = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';
const sel = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';

export default function SettingsTab({ clientId, projectCode, client }: Props) {
  const [ops, setOps] = useState({
    bookkeepingRate:          String(client?.bookkeepingRate ?? ''),
    softwareRate:             String(client?.softwareRate ?? ''),
    autoPriceIncreasePercent: String(client?.autoPriceIncreasePercent ?? ''),
    priceAdjustmentDate:      client?.priceAdjustmentDate ?? '',
    accountantName:           client?.accountantName ?? '',
    guaranteedDeadlineDay:    String(client?.guaranteedDeadlineDay ?? ''),
    processingCadence:        (client?.processingCadence ?? 'MONTHLY') as ProcessingCadence,
    okToContactAccountant:    client?.okToContactAccountant ?? false,
  });
  const [opsSaved,        setOpsSaved]       = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [saveError,       setSaveError]      = useState('');
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [confirmText,     setConfirmText]    = useState('');
  const [archiveStatus,   setArchiveStatus]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [accountants,     setAccountants]    = useState<Accountant[]>([]);
  const [showAddAcct,     setShowAddAcct]    = useState(false);
  const [newAcct,         setNewAcct]        = useState({ name: '', businessName: '', email: '' });
  const [addingAcct,      setAddingAcct]     = useState(false);
  const router = useRouter();

  // Load accountants
  useEffect(() => {
    fetch('/api/accountants')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.accountants)) setAccountants(d.accountants) })
      .catch(() => {})
  }, []);

  async function handleAddAccountant() {
    if (!newAcct.name.trim()) return;
    setAddingAcct(true);
    try {
      const res = await fetch('/api/accountants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAcct.name.trim(), businessName: newAcct.businessName.trim() || null, email: newAcct.email.trim() || null }),
      });
      const d = await res.json();
      if (d.accountant) {
        setAccountants(prev => [...prev, d.accountant]);
        setOps(o => ({ ...o, accountantName: d.accountant.name }));
        setNewAcct({ name: '', businessName: '', email: '' });
        setShowAddAcct(false);
      }
    } catch {} finally { setAddingAcct(false); }
  }

  // Re-populate form if parent client data changes
  useEffect(() => {
    if (!client) return;
    setOps({
      bookkeepingRate:          String(client.bookkeepingRate ?? ''),
      softwareRate:             String(client.softwareRate ?? ''),
      autoPriceIncreasePercent: String(client.autoPriceIncreasePercent ?? ''),
      priceAdjustmentDate:      client.priceAdjustmentDate ?? '',
      accountantName:           client.accountantName ?? '',
      guaranteedDeadlineDay:    String(client.guaranteedDeadlineDay ?? ''),
      processingCadence:        (client.processingCadence ?? 'MONTHLY') as ProcessingCadence,
      okToContactAccountant:    client.okToContactAccountant ?? false,
    });
  }, [client]);

  const [subs, setSubs] = useState<SubRow[]>([]);

  // Load subscriptions from DB
  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/clients/subscriptions?clientId=${clientId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.subscriptions)) {
          setSubs(d.subscriptions.map((s: any) => ({
            id:            s.id,
            softwareName:  s.softwareName ?? '',
            tier:          s.tier ?? '',
            ourCost:       s.ourCost != null ? String(s.ourCost) : '',
            clientPrice:   s.clientPrice != null ? String(s.clientPrice) : '',
            billingCadence: s.billingCadence ?? 'MONTHLY',
          })))
        }
      })
      .catch(() => {})
  }, [clientId]);

  async function saveOps(e: React.FormEvent) {
    e.preventDefault();
    setOpsSaved('saving');
    setSaveError('');
    try {
      // Save ops fields
      const res = await fetch(`/api/clients/${projectCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookkeepingRate:          ops.bookkeepingRate ? parseFloat(ops.bookkeepingRate) : null,
          softwareRate:             ops.softwareRate ? parseFloat(ops.softwareRate) : null,
          accountantName:           ops.accountantName           || null,
          processingCadence:        ops.processingCadence,
          okToContactAccountant:    ops.okToContactAccountant,
          guaranteedDeadlineDay:    ops.guaranteedDeadlineDay ? parseInt(ops.guaranteedDeadlineDay) : null,
          autoPriceIncreasePercent: ops.autoPriceIncreasePercent ? parseFloat(ops.autoPriceIncreasePercent) : null,
          priceAdjustmentDate:      ops.priceAdjustmentDate      || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');

      // Save subscriptions
      await fetch('/api/clients/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, subscriptions: subs }),
      });

      setOpsSaved('done');
      setTimeout(() => setOpsSaved('idle'), 2500);
    } catch (err: any) {
      setSaveError(err.message);
      setOpsSaved('error');
      setTimeout(() => setOpsSaved('idle'), 4000);
    }
  }

  function updateSub(id: string, field: keyof SubRow, val: string) {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  }

  function addRow() {
    setSubs(prev => [...prev, { id: `new-${Date.now()}`, softwareName: '', tier: '', ourCost: '', clientPrice: '', billingCadence: 'MONTHLY' }]);
  }

  function removeRow(id: string) { setSubs(prev => prev.filter(s => s.id !== id)); }

  const monthlySubs  = subs.filter(s => s.billingCadence === 'MONTHLY');
  const totalOurCost = monthlySubs.reduce((s, r) => s + (parseFloat(r.ourCost) || 0), 0);
  const totalClPrice = monthlySubs.reduce((s, r) => s + (parseFloat(r.clientPrice) || 0), 0);
  const totalMargin  = totalClPrice - totalOurCost;

  return (
    <div className="space-y-8">

      {/* ── Operational Settings ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Operational Settings</h3>
        <form onSubmit={saveOps} className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            {/* Rates */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Bookkeeping Rate</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input type="number" step="0.01" min={0}
                  value={ops.bookkeepingRate}
                  onChange={e => setOps(o => ({ ...o, bookkeepingRate: e.target.value }))}
                  placeholder="0.00"
                  className={`${inp} pl-7`} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Software Rate</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input type="number" step="0.01" min={0}
                  value={ops.softwareRate}
                  onChange={e => setOps(o => ({ ...o, softwareRate: e.target.value }))}
                  placeholder="0.00"
                  className={`${inp} pl-7`} />
              </div>
              {ops.bookkeepingRate && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Total monthly: ${(parseFloat(ops.bookkeepingRate || '0') + parseFloat(ops.softwareRate || '0')).toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Auto Price Increase %</label>
              <div className="relative">
                <input
                  type="number" step="0.1" min={0}
                  value={ops.autoPriceIncreasePercent}
                  onChange={e => setOps(o => ({ ...o, autoPriceIncreasePercent: e.target.value }))}
                  placeholder="e.g. 3.5"
                  className={inp}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Price Adjustment Date</label>
              <input
                type="date"
                value={ops.priceAdjustmentDate}
                onChange={e => setOps(o => ({ ...o, priceAdjustmentDate: e.target.value }))}
                className={inp}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Accountant</label>
              <select
                value={ops.accountantName}
                onChange={e => {
                  if (e.target.value === '__add_new__') { setShowAddAcct(true); return; }
                  setOps(o => ({ ...o, accountantName: e.target.value }))
                }}
                className={sel}
              >
                <option value="">— Select accountant —</option>
                {accountants.map(a => (
                  <option key={a.id} value={a.name}>{a.name}{a.businessName ? ` — ${a.businessName}` : ''}</option>
                ))}
                <option value="__add_new__">+ Add new accountant…</option>
              </select>

              {/* Inline add accountant form */}
              {showAddAcct && (
                <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-purple-700">New Accountant</p>
                  <input type="text" placeholder="Full name *" value={newAcct.name}
                    onChange={e => setNewAcct(n => ({ ...n, name: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  <input type="text" placeholder="Business / firm name" value={newAcct.businessName}
                    onChange={e => setNewAcct(n => ({ ...n, businessName: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  <input type="email" placeholder="Email" value={newAcct.email}
                    onChange={e => setNewAcct(n => ({ ...n, email: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={handleAddAccountant} disabled={addingAcct || !newAcct.name.trim()}
                      className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                      {addingAcct ? 'Adding…' : 'Add Accountant'}
                    </button>
                    <button type="button" onClick={() => { setShowAddAcct(false); setNewAcct({ name: '', businessName: '', email: '' }); }}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <div>
                  <span className="text-sm text-slate-700">Okay to contact accountant directly?</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Client authorises BBA to contact their accountant</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOps(o => ({ ...o, okToContactAccountant: !o.okToContactAccountant }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${ops.okToContactAccountant ? 'bg-purple-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${ops.okToContactAccountant ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Guaranteed Deadline Day</label>
              <input
                type="number" min={1} max={31}
                value={ops.guaranteedDeadlineDay}
                onChange={e => setOps(o => ({ ...o, guaranteedDeadlineDay: e.target.value }))}
                placeholder="Day 1 – 31"
                className={inp}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-2">Processing Cadence</label>
              <div className="grid grid-cols-4 gap-2">
                {CADENCE_OPTS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOps(prev => ({ ...prev, processingCadence: o.value }))}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                      ops.processingCadence === o.value
                        ? 'bg-purple-50 border-purple-300 text-purple-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 bg-white'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            {opsSaved === 'error' && (
              <p className="text-xs text-red-600">{saveError || 'Save failed — try again'}</p>
            )}
            <button
              type="submit"
              disabled={opsSaved === 'saving'}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                opsSaved === 'done'   ? 'bg-green-600 text-white' :
                opsSaved === 'error'  ? 'bg-red-600 text-white' :
                opsSaved === 'saving' ? 'bg-bba-primary/70 text-white cursor-wait' :
                'bg-bba-primary text-white hover:bg-bba-primary/85'
              }`}
            >
              {opsSaved === 'saving' ? 'Saving…' : opsSaved === 'done' ? '✓ Saved' : opsSaved === 'error' ? '✗ Error' : 'Save Settings'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Software Subscriptions ── */}
      <section>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100"
            style={{ backgroundColor: 'var(--bba-primary)' }}>
            <h3 className="text-sm font-semibold text-white">Software Subscriptions</h3>
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
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Software', 'Tier', 'Our Cost', 'Client Price', 'Margin', 'Cadence', ''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      No subscriptions yet. Click "Add Row" to start tracking.
                    </td>
                  </tr>
                )}
                {subs.map(sub => {
                  const margin    = (parseFloat(sub.clientPrice) || 0) - (parseFloat(sub.ourCost) || 0);
                  const hasValues = sub.ourCost && sub.clientPrice;
                  const mColor    = !hasValues ? 'text-slate-400' : margin > 0 ? 'text-green-600' : margin < 0 ? 'text-red-600' : 'text-slate-500';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 min-w-[160px]">
                        <input
                          type="text" value={sub.softwareName}
                          onChange={e => updateSub(sub.id, 'softwareName', e.target.value)}
                          placeholder="Software name"
                          className="w-full bg-transparent rounded px-2 py-1 text-sm text-slate-700 placeholder-slate-300 border border-transparent hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text" value={sub.tier}
                          onChange={e => updateSub(sub.id, 'tier', e.target.value)}
                          placeholder="Tier"
                          className="w-20 bg-transparent rounded px-2 py-1 text-xs text-slate-600 placeholder-slate-300 border border-transparent hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-24">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input
                            type="number" step="0.01" value={sub.ourCost}
                            onChange={e => updateSub(sub.id, 'ourCost', e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-transparent rounded pl-5 pr-2 py-1 text-sm text-slate-700 placeholder-slate-300 border border-transparent hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 tabular-nums"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-24">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input
                            type="number" step="0.01" value={sub.clientPrice}
                            onChange={e => updateSub(sub.id, 'clientPrice', e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-transparent rounded pl-5 pr-2 py-1 text-sm text-slate-700 placeholder-slate-300 border border-transparent hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 tabular-nums"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-sm font-semibold tabular-nums ${mColor}`}>
                          {hasValues ? `${margin >= 0 ? '+' : ''}$${margin.toFixed(2)}` : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={sub.billingCadence}
                          onChange={e => updateSub(sub.id, 'billingCadence', e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          {BILLING_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeRow(sub.id)}
                          className="rounded p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={2} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Monthly Totals</td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-700">${totalOurCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-700">${totalClPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums text-green-600">+${totalMargin.toFixed(2)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>

      {/* ── End Contract / Archive ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Archive Client
        </h3>
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-red-700">This action archives the client — it cannot be undone from the UI</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                The client record is marked ARCHIVED and hidden from active views, but all data is preserved.
                Management retains full access to archived clients. External systems (Anchor, Harvest, ClickUp) 
                must be updated manually.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            {[
              '📁 Client marked ARCHIVED in database',
              '🔒 Hidden from active client views',
              '✅ All records & history preserved',
              '👀 Management retains full access',
              '⚠️ Anchor billing — update manually',
              '⚠️ Harvest & ClickUp — update manually',
            ].map(s => (
              <div key={s} className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-slate-300" />{s}</div>
            ))}
          </div>

          {!archiveExpanded ? (
            <button
              onClick={() => setArchiveExpanded(true)}
              className="w-full rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 active:scale-95 transition-all"
            >
              Archive This Client →
            </button>
          ) : (
            <div className="space-y-3 border-t border-red-200 pt-4">
              <p className="text-xs text-red-700 font-semibold">
                Type <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-800">CONFIRM</span> exactly to authorise this action:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="Type CONFIRM to proceed"
                className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent font-mono tracking-widest"
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
                        body: JSON.stringify({ confirmation: 'CONFIRM', projectCode }),
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
                    archiveStatus === 'done'    ? 'bg-green-600 text-white cursor-default' :
                    archiveStatus === 'error'   ? 'bg-orange-600 text-white' :
                    archiveStatus === 'loading' ? 'bg-red-700 text-white cursor-wait' :
                    confirmText === 'CONFIRM'   ? 'bg-red-600 text-white hover:bg-red-700' :
                    'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  {archiveStatus === 'loading' ? 'Running Pipeline…' :
                   archiveStatus === 'done'    ? '✓ Archived — redirecting…' :
                   archiveStatus === 'error'   ? '✗ Error — check logs' :
                   'Confirm Archive'}
                </button>
                <button
                  onClick={() => { setArchiveExpanded(false); setConfirmText(''); setArchiveStatus('idle'); }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors bg-white"
                >
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
