'use client'

import { useState } from 'react'

const EMPTY = {
  name: '', email: '', title: '',
  rateType: 'hourly' as 'hourly' | 'salary',
  hourlyRate: '', salary: '',
  contractedHours: '',
  adminTimePercent: '20',
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const inp = 'w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent'

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

export default function AddEmployeePanel({ open, onClose, onCreated }: Props) {
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function handleClose() { setForm(EMPTY); setError(null); onClose() }

  // Compute preview effective hourly rate
  const previewRate = (() => {
    if (form.rateType === 'hourly') return parseFloat(form.hourlyRate) || null
    const s = parseFloat(form.salary)
    const h = parseFloat(form.contractedHours)
    if (!s || !h) return null
    return parseFloat((s / (h * 52)).toFixed(2))
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res  = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? `Error ${res.status}`); return }
      onCreated()
      handleClose()
    } catch { setError('Network error — please try again.') }
    finally { setSaving(false) }
  }

  return (
    <>
      <div onClick={handleClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0" style={{ backgroundColor: 'var(--bba-primary)' }}>
          <div>
            <h2 className="text-base font-semibold text-white">Add Employee</h2>
            <p className="text-xs text-white/60 mt-0.5">Fields marked <span className="text-red-300">*</span> are required</p>
          </div>
          <button onClick={handleClose} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form id="add-employee-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Identity */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--bba-secondary, #b20476)' }}>Identity</p>
            <div className="space-y-4">
              <Field label="Full Name" required>
                <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Jane Smith" className={inp} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                    placeholder="jane@bbabookkeeping.com" className={inp} />
                </Field>
                <Field label="Title">
                  <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                    placeholder="e.g. Senior Bookkeeper" className={inp} />
                </Field>
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--bba-secondary, #b20476)' }}>Compensation</p>
            <div className="space-y-4">
              {/* Rate type toggle */}
              <Field label="Rate Type">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {(['hourly', 'salary'] as const).map(v => (
                    <button key={v} type="button" onClick={() => set('rateType', v)}
                      className={`flex-1 py-2 text-xs font-medium transition-colors capitalize ${form.rateType === v ? 'bg-bba-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                      {v === 'hourly' ? '⏱ Hourly' : '📅 Salary'}
                    </button>
                  ))}
                </div>
              </Field>

              {form.rateType === 'hourly' ? (
                <Field label="Hourly Rate ($)" required hint="What BBA pays this employee per hour — used for profitability calculations">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" step="0.01" min={0} required value={form.hourlyRate}
                      onChange={e => set('hourlyRate', e.target.value)}
                      placeholder="0.00" className={`${inp} pl-6`} />
                  </div>
                </Field>
              ) : (
                <Field label="Annual Salary ($)" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" step="0.01" min={0} required value={form.salary}
                      onChange={e => set('salary', e.target.value)}
                      placeholder="0" className={`${inp} pl-6`} />
                  </div>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Contracted Hrs/Week" required>
                  <input type="number" step="0.5" min={0} max={40} required value={form.contractedHours}
                    onChange={e => set('contractedHours', e.target.value)}
                    placeholder="e.g. 40" className={inp} />
                </Field>
                <Field label="Admin Time %" hint="Non-billable overhead">
                  <div className="relative">
                    <input type="number" step="1" min={0} max={100} value={form.adminTimePercent}
                      onChange={e => set('adminTimePercent', e.target.value)}
                      placeholder="20" className={`${inp} pr-6`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  </div>
                </Field>
              </div>

              {/* Effective rate preview */}
              {previewRate != null && (
                <div className="rounded-lg bg-purple-50 border border-purple-100 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-purple-600">Effective hourly cost rate</span>
                  <span className="text-sm font-bold text-purple-700">${previewRate.toFixed(2)}/hr</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0 bg-slate-50">
          <button type="button" onClick={handleClose} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="add-employee-form" disabled={saving}
            className="rounded-lg bg-bba-primary px-5 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 transition-colors disabled:opacity-60 flex items-center gap-2">
            {saving && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            {saving ? 'Saving…' : 'Add Employee'}
          </button>
        </div>
      </aside>
    </>
  )
}
