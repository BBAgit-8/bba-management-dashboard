"use client";

import { useState, useEffect } from "react";
import { TAGS, ACCOUNTANTS, type ProcessingCadence, type EntityType, type OfficeType, type ProjectType, type Accountant, type Tag } from "@/lib/mock-data";

interface AddClientPanelProps {
  open: boolean;
  onClose: () => void;
}

const CADENCE_OPTS: { value: ProcessingCadence; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' }, { value: 'BIWEEKLY', label: 'Bi-Weekly' },
  { value: 'MONTHLY', label: 'Monthly' }, { value: 'QUARTERLY', label: 'Quarterly' },
];
const ENTITY_OPTS: { value: EntityType; label: string }[] = [
  { value: 'LLC', label: 'LLC' }, { value: 'S_CORP', label: 'S-Corp' },
  { value: 'C_CORP', label: 'C-Corp' }, { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'PARTNERSHIP', label: 'Partnership' }, { value: 'NON_PROFIT', label: 'Non-Profit' },
  { value: 'OTHER', label: 'Other' },
];
const PROJECT_TYPE_OPTS: { value: ProjectType; label: string }[] = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'CLEAN_UP', label: 'Clean Up' },
  { value: 'MONTHLY_MAINTENANCE', label: 'Monthly Maintenance' },
  { value: 'QBO_ONLY', label: 'QBO Only' },
  { value: 'RECURRING', label: 'Recurring' },
];

const EMPTY = {
  name: '', harvestProjectCode: '', accountantName: '',
  processingCadence: 'MONTHLY' as ProcessingCadence,
  guaranteedDeadlineDay: '', autoPriceIncreasePercent: '', priceAdjustmentDate: '',
  contractStartDate: '', entityType: 'LLC' as EntityType,
  einNumber: '', officeType: 'HOME_OFFICE' as OfficeType,
  hasPayroll: false, payrollProvider: '', referredBy: '',
  projectType: 'MONTHLY_MAINTENANCE' as ProjectType,
  selectedTags: [] as string[],
  okToContactAccountant: false,
  qboOnly: false,
  qboMonthlyFee: '',
};

function nextAnnualDate(from: string | null): string {
  const base = from ? new Date(from) : new Date();
  const adj  = new Date(base);
  adj.setFullYear(adj.getFullYear() + 1);
  // Roll forward until future
  const today = new Date();
  while (adj <= today) adj.setFullYear(adj.getFullYear() + 1);
  return adj.toISOString().split('T')[0];
}

export default function AddClientPanel({ open, onClose }: AddClientPanelProps) {
  const [form, setForm] = useState(EMPTY);
  const [accountants, setAccountants] = useState<Accountant[]>(ACCOUNTANTS.filter(a => a.status === 'ACTIVE'));
  const [tags, setTags] = useState<Tag[]>(TAGS);
  const [newAcctName, setNewAcctName] = useState('');
  const [showNewAcct, setShowNewAcct] = useState(false);

  // Fetch tags + accountants from API on mount
  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.tags) && d.tags.length > 0) setTags(d.tags) })
      .catch(() => {})
    fetch('/api/accountants')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.accountants)) setAccountants(d.accountants.filter((a: Accountant) => a.status === 'ACTIVE')) })
      .catch(() => {})
  }, []);

  // Auto-calculate price anniversary when % > 0 or start date changes
  useEffect(() => {
    const pct = parseFloat(form.autoPriceIncreasePercent);
    if (pct > 0) {
      setForm(f => ({ ...f, priceAdjustmentDate: nextAnnualDate(f.contractStartDate || null) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.autoPriceIncreasePercent, form.contractStartDate]);

  function handleAddAccountant() {
    const name = newAcctName.trim();
    if (!name) return;
    const newAcct: Accountant = { id: `ac-${Date.now()}`, name, status: 'ACTIVE' };
    setAccountants(prev => [...prev, newAcct]);
    setForm(f => ({ ...f, accountantName: name }));
    setNewAcctName('');
    setShowNewAcct(false);
  }

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleTag(id: string) {
    setForm(f => ({
      ...f,
      selectedTags: f.selectedTags.includes(id) ? f.selectedTags.filter(x => x !== id) : [...f.selectedTags, id],
    }));
  }

  function handleClose() { setForm(EMPTY); setShowNewAcct(false); setNewAcctName(''); onClose(); }
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); console.log('New client:', form); handleClose(); }

  return (
    <>
      <div onClick={handleClose} className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-slate-900 border-l border-slate-700/60 shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Add New Client</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fields marked <span className="text-red-400">*</span> are required</p>
          </div>
          <button onClick={handleClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form id="add-client-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Identity ── */}
          <Section label="Identity">
            <Field label="Client Name" required>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Thornbury Accounting" className={inp} />
            </Field>
            <Field label="Harvest Project Code" required>
              <input required type="text" value={form.harvestProjectCode} onChange={e => set('harvestProjectCode', e.target.value.toUpperCase())} placeholder="e.g. THRN-001" className={`${inp} font-mono`} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Entity Type">
                <select value={form.entityType} onChange={e => set('entityType', e.target.value as EntityType)} className={sel}>
                  {ENTITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="EIN Number">
                <input type="text" value={form.einNumber} onChange={e => set('einNumber', e.target.value)} placeholder="XX-XXXXXXX" className={inp} />
              </Field>
            </div>
            <Field label="Contract Start Date">
              <input type="date" value={form.contractStartDate} onChange={e => set('contractStartDate', e.target.value)} className={`${inp} [color-scheme:dark]`} />
            </Field>
          </Section>

          {/* ── Operations ── */}
          <Section label="Operations">
            <Field label="Accountant">
              <select value={form.accountantName} onChange={e => set('accountantName', e.target.value)} className={sel}>
                <option value="">— Select accountant —</option>
                {accountants.filter(a => a.status === 'ACTIVE').map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
              {!showNewAcct ? (
                <button type="button" onClick={() => setShowNewAcct(true)}
                  className="mt-1.5 text-[11px] text-bba-primary hover:underline">
                  + Add new accountant
                </button>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input type="text" value={newAcctName} onChange={e => setNewAcctName(e.target.value)}
                    placeholder="Full name" className={`${inp} flex-1`}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAccountant())} />
                  <button type="button" onClick={handleAddAccountant}
                    className="rounded-lg bg-bba-primary px-3 py-2 text-xs font-semibold text-white hover:bg-bba-primary/85">
                    Add
                  </button>
                  <button type="button" onClick={() => { setShowNewAcct(false); setNewAcctName('') }}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
                    ✕
                  </button>
                </div>
              )}
            </Field>
            <div className="flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3">
              <div>
                <span className="text-sm text-slate-300">Okay to contact accountant directly?</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Client authorises BBA to contact their accountant</p>
              </div>
              <button type="button" onClick={() => set('okToContactAccountant', !form.okToContactAccountant)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${form.okToContactAccountant ? 'bg-bba-primary' : 'bg-slate-600'}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.okToContactAccountant ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <Field label="Processing Cadence">
              <select value={form.processingCadence} onChange={e => set('processingCadence', e.target.value as ProcessingCadence)} className={sel}>
                {CADENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Project Type">
              <select value={form.projectType} onChange={e => set('projectType', e.target.value as ProjectType)} className={sel}>
                {PROJECT_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Guaranteed Deadline Day">
                <input type="number" min={1} max={31} value={form.guaranteedDeadlineDay} onChange={e => set('guaranteedDeadlineDay', e.target.value)} placeholder="1–31" className={inp} />
              </Field>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Office Type</label>
                <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                  {(['HOME_OFFICE', 'PHYSICAL'] as OfficeType[]).map(v => (
                    <button key={v} type="button" onClick={() => set('officeType', v)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${form.officeType === v ? 'bg-bba-primary text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                      {v === 'HOME_OFFICE' ? '🏠 Home' : '🏢 Physical'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Billing ── */}
          <Section label="Billing">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Auto Price Increase %">
                <input type="number" step="0.1" min={0} value={form.autoPriceIncreasePercent} onChange={e => set('autoPriceIncreasePercent', e.target.value)} placeholder="e.g. 3.5" className={inp} />
              </Field>
              <Field label="Price Adjustment Date">
                <input type="date" value={form.priceAdjustmentDate} onChange={e => set('priceAdjustmentDate', e.target.value)} className={`${inp} [color-scheme:dark]`} />
                {parseFloat(form.autoPriceIncreasePercent) > 0 && (
                  <p className="mt-1 text-[10px] text-bba-secondary">Auto-set from contract start date</p>
                )}
              </Field>
            </div>
          </Section>

          {/* ── Payroll ── */}
          <Section label="Payroll">
            <div className="flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3">
              <span className="text-sm text-slate-300">Has Payroll</span>
              <button type="button" onClick={() => set('hasPayroll', !form.hasPayroll)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${form.hasPayroll ? 'bg-bba-primary' : 'bg-slate-600'}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.hasPayroll ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {form.hasPayroll && (
              <Field label="Payroll Provider">
                <input type="text" value={form.payrollProvider} onChange={e => set('payrollProvider', e.target.value)} placeholder="e.g. Gusto, ADP, Rippling" className={inp} />
              </Field>
            )}
          </Section>

          {/* ── Other ── */}
          <Section label="Other">
            <Field label="Referred By">
              <input type="text" value={form.referredBy} onChange={e => set('referredBy', e.target.value)} placeholder="e.g. Chamber of Commerce" className={inp} />
            </Field>
          </Section>

          {/* ── QBO Only ── */}
          <Section label="QBO Only">
            <div className="flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700 px-4 py-3">
              <div>
                <span className="text-sm text-slate-300">QBO Only Client</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Only needs QuickBooks Online subscription tracking</p>
              </div>
              <button type="button" onClick={() => set('qboOnly', !form.qboOnly)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${form.qboOnly ? 'bg-bba-primary' : 'bg-slate-600'}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.qboOnly ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {form.qboOnly && (
              <Field label="Monthly QBO Fee ($)">
                <input type="number" step="0.01" min={0} value={form.qboMonthlyFee}
                  onChange={e => set('qboMonthlyFee', e.target.value)}
                  placeholder="e.g. 35.00" className={inp} />
              </Field>
            )}
          </Section>

          {/* ── Tags ── */}
          <Section label="Tags">
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const sel = form.selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all"
                    style={{ borderColor: tag.color, backgroundColor: sel ? `${tag.color}25` : 'transparent', color: sel ? tag.color : `${tag.color}99`, opacity: sel ? 1 : 0.6 }}>
                    {sel && <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </Section>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/60 shrink-0">
          <button type="button" onClick={handleClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">Cancel</button>
          <button type="submit" form="add-client-form" className="rounded-lg bg-bba-primary px-5 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 transition-colors">Create Client</button>
        </div>
      </aside>
    </>
  );
}

const inp = 'w-full rounded-lg bg-[#4e008e] border border-bba-secondary/30 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-bba-highlight focus:border-transparent';

// Dark plum background for <select> elements — ensures option list text is readable
// on all OS native dropdowns regardless of system color scheme.
const sel = 'w-full rounded-lg bg-[#4e008e] border border-bba-secondary/30 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent [color-scheme:dark]';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">{label}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
