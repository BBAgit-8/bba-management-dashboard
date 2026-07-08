"use client";

import { useState, useEffect } from "react";

type ProcessingCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY';
type EntityType = 'LLC' | 'S_CORP' | 'C_CORP' | 'SOLE_PROPRIETOR' | 'PARTNERSHIP' | 'NON_PROFIT' | 'OTHER';
type OfficeType = 'HOME_OFFICE' | 'PHYSICAL';
type ProjectType = 'ANNUAL' | 'CLEAN_UP' | 'MONTHLY_MAINTENANCE' | 'QBO_ONLY' | 'RECURRING';
type RevType = 'RECURRING_MONTHLY_ACH' | 'RECURRING_MONTHLY_INVOICED' | 'RECURRING_MONTHLY_HOURLY' | 'CLEANUP' | 'HOURLY_CLEANUP' | 'FREE' | 'QBO_ONLY_ANCHOR' | 'QBO_ONLY_QB';

interface AddClientPanelProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const CADENCE_OPTS = [
  { value: 'WEEKLY', label: 'Weekly' }, { value: 'BIWEEKLY', label: 'Bi-Weekly' },
  { value: 'MONTHLY', label: 'Monthly' }, { value: 'QUARTERLY', label: 'Quarterly' },
];
const ENTITY_OPTS = [
  { value: 'LLC', label: 'LLC' }, { value: 'S_CORP', label: 'S-Corp' },
  { value: 'C_CORP', label: 'C-Corp' }, { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership' }, { value: 'NON_PROFIT', label: 'Non-Profit' },
  { value: 'OTHER', label: 'Other' },
];
const PROJECT_TYPE_OPTS = [
  { value: 'RECURRING',           label: 'Recurring' },
  { value: 'CLEAN_UP',            label: 'Cleanup' },
  { value: 'ANNUAL',              label: 'Annual' },
  { value: 'QBO_ONLY',            label: 'QBO Only' },
  { value: 'MONTHLY_MAINTENANCE', label: 'Monthly Maintenance' },
];
const REV_TYPE_OPTS = [
  { value: 'RECURRING_MONTHLY_ACH',      label: 'Recurring Monthly - ACH' },
  { value: 'RECURRING_MONTHLY_INVOICED', label: 'Recurring Monthly - Invoiced' },
  { value: 'RECURRING_MONTHLY_HOURLY',   label: 'Recurring Monthly - Hourly' },
  { value: 'CLEANUP',                    label: 'Cleanup' },
  { value: 'HOURLY_CLEANUP',             label: 'Hourly Cleanup' },
  { value: 'FREE',                       label: 'Free' },
  { value: 'QBO_ONLY_ANCHOR',            label: 'QBO Only - Anchor' },
  { value: 'QBO_ONLY_QB',               label: 'QBO Only - QB' },
];

const EMPTY = {
  // Identity
  name: '', harvestProjectCode: '', clientGroupName: '',
  doubleId: '', qboId: '', clickUpId: '', clientContactName: '',
  entityType: 'LLC' as EntityType, einNumber: '',
  contractStartDate: '', contractedCloseDate: '',
  referredBy: '',
  // Staff
  bookkeeper: '', accountantName: '',
  processingCadence: 'MONTHLY' as ProcessingCadence,
  projectType: 'RECURRING' as ProjectType,
  revType: '' as RevType | '',
  officeType: 'HOME_OFFICE' as OfficeType,
  okToContactAccountant: false,
  // Billing
  bookkeepingRate: '', softwareRate: '', totalMonthlyAmount: '',
  autoPriceIncreasePercent: '', priceAdjustmentDate: '',
  guaranteedDeadlineDay: '',
  hasSignedAutoIncrease: false,
  // Hours
  totalHrsPerMonth: '', apArHrs: '', qaHours: '',
  custSuccessMgmtHrs: '', yeOrTaxHours: '', auditHours: '', bkprHours: '',
  // Transactions
  bankFeedTime: '', transactionsPerMonth: '', recTime: '',
  numBanksAndCCs: '', numLoans: '', numPmtPortals: '',
  pettyCash: false,
  // Manual overrides for auto-calculated fields
  bankFeedTimeOverride: false,
  recTimeOverride: false,
  qaHoursOverride: false,
  custSuccessOverride: false,
  yeOverride: false,
  // Payroll
  hasPayroll: false, payrollProvider: '',
  // Other
  qboOnly: false, qboMonthlyFee: '',
  hasContractedLoom: false, hasScheduledMeetings: false, meetingDuration: 0,
  selectedTags: [] as string[],
  // Software subscriptions
  qboTier: '' as '' | 'qbo_simple_start' | 'qbo_essentials' | 'qbo_plus' | 'qbo_advanced',
  hasDouble: false,
  otherSoftware: [] as { name: string; amount: string }[],
};

function nextAnnualDate(from: string | null): string {
  const base = from ? new Date(from) : new Date();
  const adj = new Date(base);
  adj.setFullYear(adj.getFullYear() + 1);
  const today = new Date();
  while (adj <= today) adj.setFullYear(adj.getFullYear() + 1);
  return adj.toISOString().split('T')[0];
}

export default function AddClientPanel({ open, onClose, onCreated }: AddClientPanelProps) {
  const [form, setForm] = useState(EMPTY);
  const [employees,   setEmployees]   = useState<{ id: string; name: string }[]>([]);
  const [accountants,  setAccountants]  = useState<{ id: string; name: string }[]>([]);
  const [showNewAcct,   setShowNewAcct]  = useState(false);
  const [addingAcct,    setAddingAcct]   = useState(false);
  const [referrerOptions, setReferrerOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.clients)) {
          const names = [...new Set(
            d.clients.map((c: any) => c.referredBy).filter(Boolean)
          )].sort() as string[]
          setReferrerOptions(names)
        }
      })
      .catch(() => {})
  }, [open])
  const [newAcct,       setNewAcct]       = useState({ name: '', businessName: '', email: '', phoneNumber: '' });
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string,number>>({});

  useEffect(() => {
    fetch('/api/tags').then(r => r.json())
      .then(d => { if (Array.isArray(d.tags)) setTags(d.tags) }).catch(() => {});
    fetch('/api/employees').then(r => r.json())
      .then(d => { if (Array.isArray(d)) setEmployees(d); else if (Array.isArray(d.employees)) setEmployees(d.employees) }).catch(() => {});
    fetch('/api/accountants').then(r => r.json())
      .then(d => { if (Array.isArray(d.accountants)) setAccountants(d.accountants) }).catch(() => {});
    fetch('/api/settings').then(r => r.json())
      .then(d => {
        if (d.map) {
          const p: Record<string,number> = {};
          for (const [k,v] of Object.entries(d.map)) p[k] = parseFloat(v as string) || 0;
          setPrices(p);
        }
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const pct = parseFloat(form.autoPriceIncreasePercent);
    if (pct > 0) {
      setForm(f => ({ ...f, priceAdjustmentDate: nextAnnualDate(f.contractStartDate || null) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.autoPriceIncreasePercent, form.contractStartDate]);

  // Auto-calculate software rate + monthly billing
  useEffect(() => {
    const qboPrice  = form.qboTier ? (prices[form.qboTier] ?? 0) : 0;
    const dextPrice  = form.hasDouble ? (prices['dext'] ?? 0) : 0;
    const otherAmt   = form.otherSoftware.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
    const softTotal = qboPrice + dextPrice + otherAmt;
    const bkRate    = parseFloat(form.bookkeepingRate) || 0;
    setForm(f => ({
      ...f,
      softwareRate:       softTotal > 0 ? String(softTotal) : f.softwareRate,
      totalMonthlyAmount: String(bkRate + softTotal),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.qboTier, form.hasDouble, form.otherSoftware, form.bookkeepingRate, prices]);

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleTag(id: string) {
    setForm(f => ({
      ...f,
      selectedTags: f.selectedTags.includes(id)
        ? f.selectedTags.filter(x => x !== id)
        : [...f.selectedTags, id],
    }));
  }

  async function handleAddAccountant() {
    const name = newAcct.name.trim();
    if (!name) return;
    setAddingAcct(true);
    try {
      const res = await fetch('/api/accountants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          businessName: newAcct.businessName.trim() || null,
          email:        newAcct.email.trim()        || null,
          phoneNumber:  newAcct.phoneNumber.trim()  || null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.accountant) {
        setAccountants(prev => [...prev, json.accountant].sort((a, b) => a.name.localeCompare(b.name)));
        set('accountantName', json.accountant.name);
        setNewAcct({ name: '', businessName: '', email: '', phoneNumber: '' });
        setShowNewAcct(false);
      } else {
        alert(`Failed to save accountant: ${json.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Network error: ${err}`);
    } finally {
      setAddingAcct(false);
    }
  }

  function handleClose() {
    setForm(EMPTY); setSaveError(null);
    setShowNewAcct(false); setNewAcct({ name: '', businessName: '', email: '', phoneNumber: '' });
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(null);
    try {
      const total = parseFloat(form.totalHrsPerMonth) || 0
      const tier  = total === 0 ? 0 : total <= 10 ? 0.25 : total <= 20 ? 0.50 : 0.75

      const qaHours          = form.qaHoursOverride    ? (parseFloat(form.qaHours)          || 0) : tier
      const custSuccessMgmtHrs = form.custSuccessOverride ? (parseFloat(form.custSuccessMgmtHrs) || 0) : tier
      const yeOrTaxHours     = form.yeOverride          ? (parseFloat(form.yeOrTaxHours)    || 0) : tier
      const auditHours       = parseFloat(form.auditHours) || 0
      const apArHrs          = parseFloat(form.apArHrs)    || 0
      const pool             = qaHours + custSuccessMgmtHrs + yeOrTaxHours + auditHours + apArHrs
      const bkprHours        = total === 0 ? '' : String(Math.max(parseFloat((total - pool).toFixed(2)), 0))

      const bankFeedTime = form.bankFeedTimeOverride || !calcBankFeedTime ? form.bankFeedTime : calcBankFeedTime
      const recTime      = form.recTimeOverride      || !calcRecTime      ? form.recTime      : calcRecTime
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, qaHours, custSuccessMgmtHrs, yeOrTaxHours, bkprHours, bankFeedTime, recTime }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveError(json.error ?? `Error ${res.status}`); return; }

      // Create software subscriptions if any were selected
      const newClientId = json.client?.id
      if (newClientId) {
        const subs = []
        if (form.qboTier && prices[form.qboTier]) {
          subs.push({ softwareName: 'QuickBooks Online', tier: form.qboTier.replace('qbo_','').replace(/_/g,' '), ourCost: String(prices[form.qboTier]), clientPrice: String(prices[form.qboTier]), billingCadence: 'MONTHLY' })
        }
        if (form.hasDouble && prices['dext']) {
          subs.push({ softwareName: 'Double Receipts', tier: '', ourCost: String(prices['dext']), clientPrice: String(prices['dext']), billingCadence: 'MONTHLY' })
        }
        for (const o of form.otherSoftware) {
          if (o.name.trim() && o.amount) {
            subs.push({ softwareName: o.name.trim(), tier: '', ourCost: o.amount, clientPrice: o.amount, billingCadence: 'MONTHLY' })
          }
        }
        if (subs.length > 0) {
          await fetch('/api/clients/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: newClientId, subscriptions: subs }),
          })
        }
      }

      onCreated?.();
      handleClose();
    } catch {
      setSaveError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Calc helpers ──────────────────────────────────────────────
  function txnTier(txn: string) {
    switch (txn) {
      case '0-100':   return { bft: 0.75,  rec: 0.25 }
      case '101-200': return { bft: 1.75,  rec: 0.50 }
      case '201-300': return { bft: 2.50,  rec: 0.75 }
      case '301-400': return { bft: 3.25,  rec: 1.00 }
      case '401-500': return { bft: 4.00,  rec: 1.25 }
      case '500+':    return { bft: 5.00,  rec: 1.50 }
      default:        return { bft: null,  rec: null  }
    }
  }

  const tier = txnTier(form.transactionsPerMonth)

  const calcBankFeedTime = tier.bft !== null ? String(tier.bft) : ''
  const calcRecTime = (() => {
    if (tier.rec === null) return ''
    const banks = parseInt(form.numBanksAndCCs) || 0
    const loans = parseInt(form.numLoans)       || 0
    const pmts  = parseInt(form.numPmtPortals)  || 0
    return String(parseFloat(((banks + loans + pmts) * 0.25 + tier.rec).toFixed(2)))
  })()

  // Auto-fill calculated fields when dependencies change (unless overridden)
  // We expose both the calculated value and the override state

  return (
    <>
      <div onClick={handleClose} className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0" style={{ backgroundColor: 'var(--bba-primary)' }}>
          <div>
            <h2 className="text-base font-semibold text-white">Add Client</h2>
            <p className="text-xs text-white/60 mt-0.5">Fields marked <span className="text-red-300">*</span> are required</p>
          </div>
          <button onClick={handleClose} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form id="add-client-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Identity ── */}
          <Section label="Identity">
            <Grid2>
              <Field label="Client Name" required>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Thornbury Accounting" className={inp} />
              </Field>
              <Field label="Project Code" required>
                <input required type="text" value={form.harvestProjectCode} onChange={e => set('harvestProjectCode', e.target.value.toUpperCase())} placeholder="e.g. THRN" className={`${inp} font-mono uppercase`} />
              </Field>
            </Grid2>
            <Grid2>
              <Field label="Client Group Name">
                <input type="text" value={form.clientGroupName} onChange={e => set('clientGroupName', e.target.value)} placeholder="e.g. BNMC Group" className={inp} />
              </Field>
              <Field label="Client Contact Name">
                <input type="text" value={form.clientContactName} onChange={e => set('clientContactName', e.target.value)} placeholder="e.g. Jane Smith" className={inp} />
              </Field>
            </Grid2>
            <Grid3>
              <Field label="Double ID">
                <input type="text" value={form.doubleId} onChange={e => set('doubleId', e.target.value)} placeholder="Double ID" className={inp} />
              </Field>
              <Field label="QBO ID">
                <input type="text" value={form.qboId} onChange={e => set('qboId', e.target.value)} placeholder="QBO ID" className={inp} />
              </Field>
              <Field label="ClickUp ID">
                <input type="text" value={form.clickUpId} onChange={e => set('clickUpId', e.target.value)} placeholder="ClickUp ID" className={inp} />
              </Field>
            </Grid3>
            <Grid2>
              <Field label="Entity Type">
                <select value={form.entityType} onChange={e => set('entityType', e.target.value as EntityType)} className={sel}>
                  {ENTITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="EIN Number">
                <input type="text" value={form.einNumber} onChange={e => set('einNumber', e.target.value)} placeholder="XX-XXXXXXX" className={inp} />
              </Field>
            </Grid2>
            <Grid2>
              <Field label="Contract Start Date">
                <input type="date" value={form.contractStartDate} onChange={e => set('contractStartDate', e.target.value)} className={`${inp} [color-scheme:light]`} />
              </Field>
              <Field label="Contracted Close Date">
                <input type="date" value={form.contractedCloseDate} onChange={e => set('contractedCloseDate', e.target.value)} className={`${inp} [color-scheme:light]`} />
              </Field>
            </Grid2>
            <Field label="Referred By">
              <input
                type="text"
                list="referred-by-list"
                value={form.referredBy}
                onChange={e => set('referredBy', e.target.value)}
                placeholder="e.g. Chamber of Commerce"
                className={inp}
              />
              <datalist id="referred-by-list">
                {referrerOptions.map(r => <option key={r} value={r} />)}
              </datalist>
            </Field>
          </Section>

          {/* ── Operations ── */}
          <Section label="Operations">
            <Grid2>
              <Field label="Bookkeeper">
                <select value={form.bookkeeper} onChange={e => set('bookkeeper', e.target.value)} className={sel}>
                  <option value="">— Select bookkeeper —</option>
                  {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </Field>
              <Field label="Accountant">
                {!showNewAcct ? (
                  <div className="space-y-1.5">
                    <select value={form.accountantName} onChange={e => set('accountantName', e.target.value)} className={sel}>
                      <option value="">— Select accountant —</option>
                      {accountants.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setShowNewAcct(true)}
                      className="text-[11px] text-bba-action hover:text-purple-800 hover:underline font-medium transition-colors">
                      + Add new accountant
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-bba-action">New Accountant</p>
                    <input type="text" value={newAcct.name} onChange={e => setNewAcct(a => ({ ...a, name: e.target.value }))}
                      placeholder="Full name *" className={inp} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddAccountant(); } }} />
                    <input type="text" value={newAcct.businessName} onChange={e => setNewAcct(a => ({ ...a, businessName: e.target.value }))}
                      placeholder="Business / firm name" className={inp} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="email" value={newAcct.email} onChange={e => setNewAcct(a => ({ ...a, email: e.target.value }))}
                        placeholder="Email" className={inp} />
                      <input type="tel" value={newAcct.phoneNumber} onChange={e => setNewAcct(a => ({ ...a, phoneNumber: e.target.value }))}
                        placeholder="Phone" className={inp} />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleAddAccountant} disabled={addingAcct || !newAcct.name.trim()}
                        className="flex-1 rounded-lg bg-bba-action px-3 py-2 text-xs font-semibold text-white hover:bg-bba-action/85 disabled:opacity-50">
                        {addingAcct ? 'Saving…' : 'Add Accountant'}
                      </button>
                      <button type="button" onClick={() => { setShowNewAcct(false); setNewAcct({ name: '', businessName: '', email: '', phoneNumber: '' }); }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 hover:text-slate-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Field>
            </Grid2>
            <Grid2>
              <Field label="Processing Cadence">
                <select value={form.processingCadence} onChange={e => set('processingCadence', e.target.value as ProcessingCadence)} className={sel}>
                  {CADENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Recurring or Cleanup?">
                <select value={form.projectType} onChange={e => set('projectType', e.target.value as ProjectType)} className={sel}>
                  {PROJECT_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Rev Type">
                <select value={form.revType} onChange={e => set('revType', e.target.value as RevType)} className={sel}>
                  <option value="">— Select —</option>
                  {REV_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </Grid2>
            <Grid2>
              <Field label="Contracted Close Date">
                <input type="date" min={1} max={31} value={form.contractedCloseDate} onChange={e => set('contractedCloseDate', e.target.value)} placeholder="1–31" className={`${inp} [color-scheme:light]`} />
              </Field>
              <Field label="Office Type">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {(['HOME_OFFICE', 'PHYSICAL'] as OfficeType[]).map(v => (
                    <button key={v} type="button" onClick={() => set('officeType', v)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${form.officeType === v ? 'bg-bba-action text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                      {v === 'HOME_OFFICE' ? '🏠 Home' : '🏢 Physical'}
                    </button>
                  ))}
                </div>
              </Field>
            </Grid2>
            <Toggle label="Okay to contact accountant directly?" sub="Client authorizes BBA to contact their accountant"
              value={form.okToContactAccountant} onChange={v => set('okToContactAccountant', v)} />
          </Section>

          {/* ── Billing ── */}
          <Section label="Billing">
            <Grid2>
              <Field label="Bookkeeping Rate ($)">
                <input type="number" step="0.01" min={0} value={form.bookkeepingRate} onChange={e => set('bookkeepingRate', e.target.value)} placeholder="0.00" className={inp} />
              </Field>
              <Field label="Monthly Billing ($)">
                <div className="relative">
                  <input type="number" step="0.01" min={0} value={form.totalMonthlyAmount} readOnly
                    className={`${inp} bg-slate-50 text-slate-500 cursor-default`} placeholder="Auto-calculated" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">auto</span>
                </div>
              </Field>
            </Grid2>

            {/* Software subscriptions */}
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600">Software Subscriptions</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Prices loaded from Settings — updates Software Rate and Monthly Billing automatically</p>
              </div>
              <div className="divide-y divide-slate-100">
                {/* QuickBooks tier */}
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-700 font-medium shrink-0">QuickBooks Online</span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {[
                      { key: 'qbo_simple_start', label: 'Simple Start' },
                      { key: 'qbo_essentials',   label: 'Essentials'   },
                      { key: 'qbo_plus',         label: 'Plus'         },
                      { key: 'qbo_advanced',     label: 'Advanced'     },
                    ].map(tier => (
                      <button key={tier.key} type="button"
                        onClick={() => set('qboTier', form.qboTier === tier.key ? '' : tier.key as typeof form.qboTier)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${form.qboTier === tier.key ? 'bg-bba-primary text-white border-bba-action' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-bba-action'}`}>
                        {tier.label}
                        {prices[tier.key] ? <span className="ml-1 opacity-70">${prices[tier.key]}</span> : null}
                      </button>
                    ))}
                    {form.qboTier && (
                      <button type="button" onClick={() => set('qboTier', '')}
                        className="text-xs text-slate-400 hover:text-slate-600">✕</button>
                    )}
                  </div>
                </div>
                {/* Dext */}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-700 font-medium">Double</span>
                    {prices['dext'] ? <span className="ml-2 text-xs text-slate-400">${prices['dext']}/mo</span> : null}
                  </div>
                  <button type="button" onClick={() => set('hasDouble', !form.hasDouble)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${form.hasDouble ? 'bg-bba-action' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.hasDouble ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {/* Other */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Other</p>
                    <button type="button"
                      onClick={() => set('otherSoftware', [...form.otherSoftware, { name: '', amount: '' }])}
                      className="inline-flex items-center gap-1 text-xs text-bba-action hover:text-purple-800 font-medium transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add
                    </button>
                  </div>
                  {form.otherSoftware.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No other software — click Add to include one.</p>
                  )}
                  {form.otherSoftware.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={item.name}
                        onChange={e => { const next = [...form.otherSoftware]; next[i] = { ...next[i], name: e.target.value }; set('otherSoftware', next); }}
                        placeholder="Software name" className={`${inp} flex-1`} />
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input type="number" step="0.01" min={0} value={item.amount}
                          onChange={e => { const next = [...form.otherSoftware]; next[i] = { ...next[i], amount: e.target.value }; set('otherSoftware', next); }}
                          placeholder="0.00" className={`${inp} pl-6`} />
                      </div>
                      <button type="button"
                        onClick={() => set('otherSoftware', form.otherSoftware.filter((_, j) => j !== i))}
                        className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              {/* Software rate summary */}
              {(form.qboTier || form.hasDouble || form.otherSoftware.some(o => parseFloat(o.amount) > 0)) && (
                <div className="px-4 py-2.5 bg-purple-50 border-t border-purple-100 flex justify-between items-center">
                  <span className="text-xs text-bba-action font-medium">Software Rate</span>
                  <span className="text-sm font-semibold text-bba-action">
                    ${(
                      (form.qboTier ? (prices[form.qboTier] ?? 0) : 0) +
                      (form.hasDouble ? (prices['dext'] ?? 0) : 0) +
                      form.otherSoftware.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
                    ).toFixed(2)}/mo
                  </span>
                </div>
              )}
            </div>

            <Grid2>
              <Field label="Auto Price Increase %">
                <input type="number" step="0.1" min={0} value={form.autoPriceIncreasePercent} onChange={e => set('autoPriceIncreasePercent', e.target.value)} placeholder="e.g. 3.5" className={inp} />
              </Field>
              <Field label="Price Adjustment Date">
                <input type="date" value={form.priceAdjustmentDate} onChange={e => set('priceAdjustmentDate', e.target.value)} className={`${inp} [color-scheme:light]`} />
                {parseFloat(form.autoPriceIncreasePercent) > 0 && (
                  <p className="mt-1 text-[10px] text-purple-500">Auto-set from contract start date</p>
                )}
              </Field>
            </Grid2>
            <Toggle label="Signed Auto Price Increase" value={form.hasSignedAutoIncrease} onChange={v => set('hasSignedAutoIncrease', v)} />
          </Section>

          {/* ── Hours ── */}
          <Section label="Hours / Mo">
            <Grid3>
              <Field label="Total Hrs/Mo">
                <input type="number" step="0.25" min={0} value={form.totalHrsPerMonth} onChange={e => set('totalHrsPerMonth', e.target.value)} placeholder="0" className={inp} />
              </Field>
              <Field label="AP/AR Hrs">
                <input type="number" step="0.25" min={0} value={form.apArHrs} onChange={e => set('apArHrs', e.target.value)} placeholder="0" className={inp} />
              </Field>

              {/* QA Hours — auto-calc from total with override */}
              {(() => {
                const total = parseFloat(form.totalHrsPerMonth) || 0
                const calcQa = total === 0 ? null : total <= 10 ? 0.25 : total <= 20 ? 0.50 : 0.75
                const showAuto = calcQa !== null && !form.qaHoursOverride
                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-xs font-medium text-slate-500">QA Hours</label>
                      <div className="group relative">
                        <svg className="h-3.5 w-3.5 text-slate-300 hover:text-purple-400 cursor-help transition-colors" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 rounded-lg bg-slate-800 px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          Based on Total Hrs/Mo:<br/>≤10 hrs = 0.25 · ≤20 = 0.50 · &gt;20 = 0.75
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                      </div>
                      {showAuto && <span className="text-[10px] text-purple-500 font-medium">auto</span>}
                      {calcQa !== null && (
                        <button type="button" onClick={() => set('qaHoursOverride', !form.qaHoursOverride as any)}
                          className="ml-auto text-[10px] text-slate-400 hover:text-bba-action underline underline-offset-2 transition-colors">
                          {form.qaHoursOverride ? 'use formula' : 'override'}
                        </button>
                      )}
                    </div>
                    {form.qaHoursOverride || calcQa === null ? (
                      <input type="number" step="0.25" min={0} value={form.qaHours} onChange={e => set('qaHours', e.target.value)} placeholder="0" className={inp} />
                    ) : (
                      <div className="flex items-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                        <span className="text-sm font-semibold text-bba-action tabular-nums">{calcQa}</span>
                        <span className="ml-1 text-xs text-slate-400">hrs</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Cust Success / Mgmt — auto-calc same tier */}
              {(() => {
                const total = parseFloat(form.totalHrsPerMonth) || 0
                const calcCs = total === 0 ? null : total <= 10 ? 0.25 : total <= 20 ? 0.50 : 0.75
                const showAuto = calcCs !== null && !form.custSuccessOverride
                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-xs font-medium text-slate-500">Cust Success / Mgmt Hrs</label>
                      <div className="group relative">
                        <svg className="h-3.5 w-3.5 text-slate-300 hover:text-purple-400 cursor-help transition-colors" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 rounded-lg bg-slate-800 px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          Based on Total Hrs/Mo:<br/>≤10 hrs = 0.25 · ≤20 = 0.50 · &gt;20 = 0.75
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                      </div>
                      {showAuto && <span className="text-[10px] text-purple-500 font-medium">auto</span>}
                      {calcCs !== null && (
                        <button type="button" onClick={() => set('custSuccessOverride', !form.custSuccessOverride as any)}
                          className="ml-auto text-[10px] text-slate-400 hover:text-bba-action underline underline-offset-2 transition-colors">
                          {form.custSuccessOverride ? 'use formula' : 'override'}
                        </button>
                      )}
                    </div>
                    {form.custSuccessOverride || calcCs === null ? (
                      <input type="number" step="0.25" min={0} value={form.custSuccessMgmtHrs} onChange={e => set('custSuccessMgmtHrs', e.target.value)} placeholder="0" className={inp} />
                    ) : (
                      <div className="flex items-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                        <span className="text-sm font-semibold text-bba-action tabular-nums">{calcCs}</span>
                        <span className="ml-1 text-xs text-slate-400">hrs</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* YE / 1099 — auto-calc same tier */}
              {(() => {
                const total = parseFloat(form.totalHrsPerMonth) || 0
                const calcYe = total === 0 ? null : total <= 10 ? 0.25 : total <= 20 ? 0.50 : 0.75
                const showAuto = calcYe !== null && !form.yeOverride
                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-xs font-medium text-slate-500">YE / 1099 Hours</label>
                      <div className="group relative">
                        <svg className="h-3.5 w-3.5 text-slate-300 hover:text-purple-400 cursor-help transition-colors" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 rounded-lg bg-slate-800 px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          Based on Total Hrs/Mo:<br/>≤10 hrs = 0.25 · ≤20 = 0.50 · &gt;20 = 0.75
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                      </div>
                      {showAuto && <span className="text-[10px] text-purple-500 font-medium">auto</span>}
                      {calcYe !== null && (
                        <button type="button" onClick={() => set('yeOverride', !form.yeOverride as any)}
                          className="ml-auto text-[10px] text-slate-400 hover:text-bba-action underline underline-offset-2 transition-colors">
                          {form.yeOverride ? 'use formula' : 'override'}
                        </button>
                      )}
                    </div>
                    {form.yeOverride || calcYe === null ? (
                      <input type="number" step="0.25" min={0} value={form.yeOrTaxHours} onChange={e => set('yeOrTaxHours', e.target.value)} placeholder="0" className={inp} />
                    ) : (
                      <div className="flex items-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                        <span className="text-sm font-semibold text-bba-action tabular-nums">{calcYe}</span>
                        <span className="ml-1 text-xs text-slate-400">hrs</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              <Field label="Audit Hours">
                <input type="number" step="0.25" min={0} value={form.auditHours} onChange={e => set('auditHours', e.target.value)} placeholder="0" className={inp} />
              </Field>

              {/* Bkpr Hours — always auto: total minus all pool fields */}
              {(() => {
                const total = parseFloat(form.totalHrsPerMonth) || 0
                const tier  = total === 0 ? null : total <= 10 ? 0.25 : total <= 20 ? 0.50 : 0.75

                const qa = form.qaHoursOverride   ? (parseFloat(form.qaHours)          || 0) : (tier ?? 0)
                const cs = form.custSuccessOverride ? (parseFloat(form.custSuccessMgmtHrs) || 0) : (tier ?? 0)
                const ye = form.yeOverride          ? (parseFloat(form.yeOrTaxHours)    || 0) : (tier ?? 0)
                const audit = parseFloat(form.auditHours) || 0
                const apAr  = parseFloat(form.apArHrs)    || 0

                const pool  = qa + cs + ye + audit + apAr
                const bkpr  = total === 0 ? null : Math.max(parseFloat((total - pool).toFixed(2)), 0)

                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-xs font-medium text-slate-500">Bkpr Hours</label>
                      <div className="group relative">
                        <svg className="h-3.5 w-3.5 text-slate-300 hover:text-purple-400 cursor-help transition-colors" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-lg bg-slate-800 px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          Total Hrs − (QA + Mgmt + YE + Audit + AP/AR)
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                      </div>
                      {bkpr !== null && <span className="text-[10px] text-purple-500 font-medium">auto</span>}
                    </div>
                    <div className={`flex items-center rounded-lg border px-3 py-2 ${bkpr !== null && bkpr < 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                      {bkpr === null ? (
                        <span className="text-sm text-slate-400">—</span>
                      ) : (
                        <>
                          <span className={`text-sm font-semibold tabular-nums ${bkpr < 0 ? 'text-red-600' : 'text-bba-action'}`}>{bkpr}</span>
                          <span className="ml-1 text-xs text-slate-400">hrs</span>
                          {pool > total && total > 0 && (
                            <span className="ml-2 text-[10px] text-red-500 font-medium">pool exceeds total</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}
            </Grid3>
          </Section>

          {/* ── Transactions ── */}
          <Section label="Transactions &amp; Accounts">
            <Grid3>
              <Field label="# Transactions / mo">
                <select value={form.transactionsPerMonth} onChange={e => set('transactionsPerMonth', e.target.value)} className={sel}>
                  <option value="">— Select range —</option>
                  <option value="0-100">0 – 100</option>
                  <option value="101-200">101 – 200</option>
                  <option value="201-300">201 – 300</option>
                  <option value="301-400">301 – 400</option>
                  <option value="401-500">401 – 500</option>
                  <option value="500+">500+</option>
                </select>
              </Field>
              <Field label="# Banks &amp; CCs">
                <input type="number" min={0} value={form.numBanksAndCCs} onChange={e => set('numBanksAndCCs', e.target.value)} placeholder="0" className={inp} />
              </Field>
              <Field label="# Loans">
                <input type="number" min={0} value={form.numLoans} onChange={e => set('numLoans', e.target.value)} placeholder="0" className={inp} />
              </Field>
              <Field label="# Pmt Portals">
                <input type="number" min={0} value={form.numPmtPortals} onChange={e => set('numPmtPortals', e.target.value)} placeholder="0" className={inp} />
              </Field>

              {/* Bank Feed Time — auto-calc with override */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-xs font-medium text-slate-500">Bank Feed Time</label>
                  <div className="group relative">
                    <svg className="h-3.5 w-3.5 text-slate-300 hover:text-purple-400 cursor-help transition-colors" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-lg bg-slate-800 px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      Based on transaction range:<br/>
                      0-100 = 0.75 · 101-200 = 1.75<br/>
                      201-300 = 2.50 · 301-400 = 3.25<br/>
                      401-500 = 4.00 · 500+ = 5.00
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                  </div>
                  {calcBankFeedTime && !form.bankFeedTimeOverride && (
                    <span className="text-[10px] text-purple-500 font-medium">auto</span>
                  )}
                  {calcBankFeedTime && (
                    <button type="button"
                      onClick={() => set('bankFeedTimeOverride', !form.bankFeedTimeOverride as any)}
                      className="ml-auto text-[10px] text-slate-400 hover:text-bba-action underline underline-offset-2 transition-colors">
                      {form.bankFeedTimeOverride ? 'use formula' : 'override'}
                    </button>
                  )}
                </div>
                {form.bankFeedTimeOverride || !calcBankFeedTime ? (
                  <input type="number" step="0.25" min={0}
                    value={form.bankFeedTime}
                    onChange={e => set('bankFeedTime', e.target.value)}
                    placeholder="0" className={inp} />
                ) : (
                  <div className="flex items-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <span className="text-sm font-semibold text-bba-action tabular-nums">{calcBankFeedTime}</span>
                    <span className="ml-1 text-xs text-slate-400">hrs</span>
                  </div>
                )}
              </div>

              {/* Rec Time — auto-calc with override */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-xs font-medium text-slate-500">Rec Time</label>
                  <div className="group relative">
                    <svg className="h-3.5 w-3.5 text-slate-300 hover:text-purple-400 cursor-help transition-colors" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg bg-slate-800 px-3 py-2 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      (Banks + Loans + Pmt Portals) × 0.25 + txn tier<br/>
                      Txn tier: 0-100=0.25 · 101-200=0.50<br/>
                      201-300=0.75 · 301-400=1.00<br/>
                      401-500=1.25 · 500+=1.50
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                  </div>
                  {calcRecTime && !form.recTimeOverride && (
                    <span className="text-[10px] text-purple-500 font-medium">auto</span>
                  )}
                  {calcRecTime && (
                    <button type="button"
                      onClick={() => set('recTimeOverride', !form.recTimeOverride as any)}
                      className="ml-auto text-[10px] text-slate-400 hover:text-bba-action underline underline-offset-2 transition-colors">
                      {form.recTimeOverride ? 'use formula' : 'override'}
                    </button>
                  )}
                </div>
                {form.recTimeOverride || !calcRecTime ? (
                  <input type="number" step="0.25" min={0}
                    value={form.recTime}
                    onChange={e => set('recTime', e.target.value)}
                    placeholder="0" className={inp} />
                ) : (
                  <div className="flex items-center rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <span className="text-sm font-semibold text-bba-action tabular-nums">{calcRecTime}</span>
                    <span className="ml-1 text-xs text-slate-400">hrs</span>
                  </div>
                )}
              </div>
            </Grid3>
            <Toggle label="Petty Cash" value={form.pettyCash} onChange={v => set('pettyCash', v)} />
          </Section>

          {/* ── Payroll ── */}
          <Section label="Payroll">
            <Toggle label="Has Payroll" value={form.hasPayroll} onChange={v => set('hasPayroll', v)} />
            {form.hasPayroll && (
              <Field label="Payroll Provider">
                <input type="text" value={form.payrollProvider} onChange={e => set('payrollProvider', e.target.value)} placeholder="e.g. Gusto, ADP, Rippling" className={inp} />
              </Field>
            )}
          </Section>

          {/* ── Add-ons ── */}
          <Section label="Add-ons">
            <Toggle label="Contracted Loom" value={form.hasContractedLoom} onChange={v => set('hasContractedLoom', v)} />
            <Toggle label="Scheduled Meetings" value={form.hasScheduledMeetings} onChange={v => { set('hasScheduledMeetings', v); if (!v) set('meetingDuration', 0); }} />
            {form.hasScheduledMeetings && (
              <div className="ml-4 flex items-center gap-3">
                <span className="text-xs text-slate-500 shrink-0">Meeting length</span>
                {[15, 30, 40].map(min => (
                  <button key={min} type="button"
                    onClick={() => set('meetingDuration', form.meetingDuration === min ? 0 : min)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-semibold border transition-all ${form.meetingDuration === min ? 'bg-bba-primary text-white border-bba-action' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-bba-action'}`}>
                    {min} min
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* ── QBO Only ── */}
          <Section label="QBO Only">
            <Toggle label="QBO Only Client" sub="Only needs QuickBooks Online subscription tracking"
              value={form.qboOnly} onChange={v => set('qboOnly', v)} />
            {form.qboOnly && (
              <Field label="Monthly QBO Fee ($)">
                <input type="number" step="0.01" min={0} value={form.qboMonthlyFee as string}
                  onChange={e => set('qboMonthlyFee' as any, e.target.value)} placeholder="e.g. 35.00" className={inp} />
              </Field>
            )}
          </Section>

          {/* ── Tags ── */}
          <Section label="Tags">
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const selected = form.selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all"
                    style={{ borderColor: tag.color, backgroundColor: selected ? `${tag.color}25` : 'transparent', color: selected ? tag.color : `${tag.color}99` }}>
                    {selected && <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    {tag.name}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-xs text-slate-400">No tags configured yet.</p>}
            </div>
          </Section>

          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-600">{saveError}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0 bg-slate-50">
          <button type="button" onClick={handleClose} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="add-client-form" disabled={saving}
            className="rounded-lg bg-bba-action px-5 py-2 text-sm font-semibold text-white hover:bg-bba-action/85 transition-colors disabled:opacity-60 flex items-center gap-2">
            {saving && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Style constants ───────────────────────────────────────────────────────────
const inp = 'w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent';
const sel = 'w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent';

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--bba-secondary, #b20476)' }}>{label}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function Grid3({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-4">{children}</div>;
}

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${value ? 'bg-bba-action' : 'bg-slate-300'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
