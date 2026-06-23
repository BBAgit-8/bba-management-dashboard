'use client'

import { useState, useEffect } from 'react'

type Employee = {
  id: string; name: string; email: string | null; title: string | null
  rateType: string; salary: number | null; effectiveHourlyRate: number
  contractedHours: number; adminTimePercent: number
  hubAccess: boolean; invitedAt: string | null
}

type RateHistory = {
  id: string; rateType: string; rate: number
  effectiveDate: string; notes: string | null; createdAt: string
}

interface Props {
  employee: Employee | null
  onClose: () => void
  onUpdated: () => void
}

const inp = 'w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-700">{value}</span>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

export default function EmployeeDrawer({ employee, onClose, onUpdated }: Props) {
  const open = employee != null
  const [tab,            setTab]           = useState<'profile' | 'edit' | 'rate-history'>('profile')
  const [history,        setHistory]       = useState<RateHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [lastChange,     setLastChange]     = useState<{ date: string; pct: number | null } | null>(null)
  const [inviting,       setInviting]      = useState(false)
  const [revoking,       setRevoking]      = useState(false)
  const [inviteMsg,      setInviteMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saving,         setSaving]        = useState(false)
  const [pastEntry,      setPastEntry]     = useState({ rate: '', date: '', notes: '', rateType: 'hourly' as 'hourly' | 'salary' })
  const [savingPast,     setSavingPast]    = useState(false)
  const [pastMsg,        setPastMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deletingId,     setDeletingId]    = useState<string | null>(null)
  const [saveError,      setSaveError]     = useState<string | null>(null)
  const [saveSuccess,    setSaveSuccess]   = useState(false)

  // Edit form state — seeded from employee when drawer opens
  const [editForm, setEditForm] = useState({
    name: '', email: '', title: '',
    rateType: 'hourly' as 'hourly' | 'salary',
    hourlyRate: '', salary: '', contractedHours: '',
    adminTimePercent: '', rateChangeNote: '',
  })

  useEffect(() => {
    if (!employee) return
    setTab('profile')
    setInviteMsg(null)
    setSaveError(null)
    setSaveSuccess(false)
    setLastChange(null)
    fetchLastChange(employee.id)
    setEditForm({
      name:             employee.name,
      email:            employee.email ?? '',
      title:            employee.title ?? '',
      rateType:         (employee.rateType as 'hourly' | 'salary') ?? 'hourly',
      hourlyRate:       employee.rateType === 'hourly' ? String(employee.effectiveHourlyRate) : '',
      salary:           employee.salary ? String(employee.salary) : '',
      contractedHours:  String(employee.contractedHours),
      adminTimePercent: String(employee.adminTimePercent),
      rateChangeNote:   '',
    })
  }, [employee?.id])

  function setEdit<K extends keyof typeof editForm>(k: K, v: (typeof editForm)[K]) {
    setEditForm(f => ({ ...f, [k]: v }))
  }

  // Preview effective hourly rate in edit form
  const previewRate = (() => {
    if (editForm.rateType === 'hourly') return parseFloat(editForm.hourlyRate) || null
    const s = parseFloat(editForm.salary)
    const h = parseFloat(editForm.contractedHours)
    if (!s || !h) return null
    return parseFloat((s / (h * 52)).toFixed(2))
  })()

  async function handleDeleteEntry(entryId: string) {
    if (!employee) return
    setDeletingId(entryId)
    const res = await fetch(`/api/employees/rate-history?id=${entryId}`, { method: 'DELETE' })
    if (res.ok) {
      setHistory(h => h.filter(e => e.id !== entryId))
      fetchLastChange(employee.id)
    }
    setDeletingId(null)
  }

  function fetchLastChange(empId: string) {
    fetch(`/api/employees/rate-history?employeeId=${empId}`)
      .then(r => r.json())
      .then(d => {
        const h = d.history ?? []
        if (h.length === 0) { setLastChange(null); return }
        const latest = h[0]
        // Find previous entry with same rateType for apples-to-apples comparison
        const prev = h.slice(1).find((e: any) => e.rateType === latest.rateType) ?? h[1]
        const pct = prev
          ? parseFloat((((Number(latest.rate) - Number(prev.rate)) / Number(prev.rate)) * 100).toFixed(1))
          : null
        setLastChange({ date: latest.effectiveDate, pct })
      })
      .catch(() => {})
  }

  async function handleLogPastRate() {
    if (!employee || !pastEntry.rate || !pastEntry.date) return
    setSavingPast(true); setPastMsg(null)
    const res = await fetch('/api/employees/rate-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId:    employee.id,
        rateType:      pastEntry.rateType,
        rate:          parseFloat(pastEntry.rate),
        effectiveDate: pastEntry.date,
        notes:         pastEntry.notes || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setPastMsg({ type: 'error', text: json.error ?? 'Failed to save.' })
    } else {
      setPastMsg({ type: 'success', text: 'Past rate entry logged.' })
      setPastEntry({ rate: '', date: '', notes: '', rateType: 'hourly' })
      fetchLastChange(employee.id)
    }
    setSavingPast(false)
  }

  async function handleSave() {
    if (!employee) return
    setSaving(true); setSaveError(null); setSaveSuccess(false)
    const res  = await fetch(`/api/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const json = await res.json()
    if (!res.ok) {
      setSaveError(json.error ?? 'Save failed.')
    } else {
      setSaveSuccess(true)
      onUpdated()
      setTimeout(() => setSaveSuccess(false), 3000)
    }
    setSaving(false)
  }

  async function loadHistory() {
    if (!employee) return
    setLoadingHistory(true)
    const res  = await fetch(`/api/employees/rate-history?employeeId=${employee.id}`)
    const json = await res.json()
    if (json.history) setHistory(json.history)
    setLoadingHistory(false)
  }

  useEffect(() => {
    if (tab === 'rate-history' && employee) loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, employee?.id])

  async function handleInvite() {
    if (!employee?.email) { setInviteMsg({ type: 'error', text: 'No email address on file.' }); return }
    setInviting(true); setInviteMsg(null)
    const res  = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employee.id, email: employee.email, name: employee.name }),
    })
    const json = await res.json()
    if (!res.ok) {
      setInviteMsg({ type: 'error', text: json.error ?? 'Invite failed.' })
    } else {
      setInviteMsg({ type: 'success', text: `Invite sent to ${employee.email}` })
      onUpdated()
    }
    setInviting(false)
  }

  async function handleRevoke() {
    if (!employee) return
    setRevoking(true); setInviteMsg(null)
    const res  = await fetch('/api/team/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: employee.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setInviteMsg({ type: 'error', text: json.error ?? 'Revoke failed.' })
    } else {
      setInviteMsg({ type: 'success', text: 'Hub access revoked.' })
      onUpdated()
    }
    setRevoking(false)
  }

  return (
    <>
      <div onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {!employee ? null : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0" style={{ backgroundColor: 'var(--bba-primary)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                  {employee.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{employee.name}</h2>
                  <p className="text-xs text-white/60">{employee.title ?? 'No title set'}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 shrink-0">
              {(['profile', 'edit', 'rate-history'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                    tab === t ? 'border-b-2 border-purple-600 text-purple-700' : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {t === 'rate-history' ? 'Rate History' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── Profile tab ── */}
              {tab === 'profile' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100" style={{ backgroundColor: 'rgba(109,40,217,0.05)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700">Details</p>
                    </div>
                    <div className="px-4 py-1">
                      <InfoRow label="Email"          value={employee.email} />
                      <InfoRow label="Title"          value={employee.title} />
                      <InfoRow label="Contracted Hrs" value={employee.contractedHours ? `${employee.contractedHours} hrs/week` : null} />
                      <InfoRow label="Admin Time"     value={employee.adminTimePercent ? `${employee.adminTimePercent}%` : null} />
                      <InfoRow label="Capacity/Mo"    value={employee.contractedHours ? `${(Number(employee.contractedHours) * 4.33).toFixed(1)} hrs` : null} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100" style={{ backgroundColor: 'rgba(109,40,217,0.05)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700">Compensation</p>
                    </div>
                    <div className="px-4 py-1">
                      <InfoRow label="Rate Type"  value={employee.rateType === 'salary' ? 'Salary' : 'Hourly'} />
                      {employee.rateType === 'salary' && employee.salary && (
                        <InfoRow label="Annual Salary" value={`$${Number(employee.salary).toLocaleString()}`} />
                      )}
                      <InfoRow label="Effective Hourly Rate" value={
                        <span className="font-bold text-purple-700">${Number(employee.effectiveHourlyRate).toFixed(2)}/hr</span>
                      } />
                      {lastChange && (
                        <InfoRow label="Last Rate Change" value={
                          <span className="flex items-center gap-1.5">
                            <span>{new Date(lastChange.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            {lastChange.pct !== null && (
                              <span className={`text-[11px] font-semibold rounded-full px-1.5 py-0.5 ${lastChange.pct >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {lastChange.pct >= 0 ? '+' : ''}{lastChange.pct}%
                              </span>
                            )}
                          </span>
                        } />
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100" style={{ backgroundColor: 'rgba(109,40,217,0.05)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700">Client Hub Access</p>
                    </div>
                    <div className="px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-700">
                            {employee.hubAccess
                              ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /><span className="font-medium text-green-700">Active access</span></span>
                              : <span className="text-slate-400">No access yet</span>}
                          </p>
                          {employee.invitedAt && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Invited {new Date(employee.invitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                          {!employee.email && <p className="text-[10px] text-amber-500 mt-0.5">⚠ Add email to send invite</p>}
                        </div>
                        {employee.hubAccess ? (
                          <button onClick={handleRevoke} disabled={revoking}
                            className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
                            {revoking ? 'Revoking…' : 'Revoke'}
                          </button>
                        ) : (
                          <button onClick={handleInvite} disabled={inviting || !employee.email}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-bba-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-bba-primary/85 disabled:opacity-50">
                            {inviting
                              ? <><svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
                              : <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Send Invite</>}
                          </button>
                        )}
                      </div>
                      {inviteMsg && (
                        <div className={`rounded-lg px-3 py-2 text-xs ${inviteMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                          {inviteMsg.text}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Edit tab ── */}
              {tab === 'edit' && (
                <div className="space-y-5">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--bba-secondary, #b20476)' }}>Identity</p>
                    <Field label="Full Name">
                      <input type="text" value={editForm.name} onChange={e => setEdit('name', e.target.value)} className={inp} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Email">
                        <input type="email" value={editForm.email} onChange={e => setEdit('email', e.target.value)} placeholder="email@bbabookkeeping.com" className={inp} />
                      </Field>
                      <Field label="Title">
                        <input type="text" value={editForm.title} onChange={e => setEdit('title', e.target.value)} placeholder="e.g. Senior Bookkeeper" className={inp} />
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--bba-secondary, #b20476)' }}>Compensation</p>
                    <Field label="Rate Type">
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                        {(['hourly', 'salary'] as const).map(v => (
                          <button key={v} type="button" onClick={() => setEdit('rateType', v)}
                            className={`flex-1 py-2 text-xs font-medium transition-colors ${editForm.rateType === v ? 'bg-bba-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {v === 'hourly' ? '⏱ Hourly' : '📅 Salary'}
                          </button>
                        ))}
                      </div>
                    </Field>
                    {editForm.rateType === 'hourly' ? (
                      <Field label="Hourly Rate ($)">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input type="number" step="0.01" min={0} value={editForm.hourlyRate}
                            onChange={e => setEdit('hourlyRate', e.target.value)} placeholder="0.00" className={`${inp} pl-6`} />
                        </div>
                      </Field>
                    ) : (
                      <Field label="Annual Salary ($)" hint="Hourly rate = salary ÷ contracted hrs ÷ 52 weeks">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input type="number" step="0.01" min={0} value={editForm.salary}
                            onChange={e => setEdit('salary', e.target.value)} placeholder="0" className={`${inp} pl-6`} />
                        </div>
                      </Field>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Contracted Hrs/Week">
                        <input type="number" step="0.5" min={0} max={40} value={editForm.contractedHours}
                          onChange={e => setEdit('contractedHours', e.target.value)} placeholder="40" className={inp} />
                      </Field>
                      <Field label="Admin Time %">
                        <div className="relative">
                          <input type="number" step="1" min={0} max={100} value={editForm.adminTimePercent}
                            onChange={e => setEdit('adminTimePercent', e.target.value)} placeholder="20" className={`${inp} pr-6`} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                        </div>
                      </Field>
                    </div>
                    {previewRate != null && (
                      <div className="rounded-lg bg-purple-50 border border-purple-100 px-4 py-3 flex items-center justify-between">
                        <span className="text-xs text-purple-600">Effective hourly cost rate</span>
                        <span className="text-sm font-bold text-purple-700">${previewRate.toFixed(2)}/hr</span>
                      </div>
                    )}
                    <Field label="Rate Change Note" hint="Optional — appears in rate history log">
                      <input type="text" value={editForm.rateChangeNote}
                        onChange={e => setEdit('rateChangeNote', e.target.value)}
                        placeholder="e.g. Annual raise, promotion" className={inp} />
                    </Field>
                  </div>

                  {saveError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                      <p className="text-sm text-red-600">{saveError}</p>
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                      <p className="text-sm text-green-700">✓ Changes saved.</p>
                    </div>
                  )}
                  <button onClick={handleSave} disabled={saving}
                    className="w-full rounded-lg bg-bba-primary py-2.5 text-sm font-semibold text-white hover:bg-bba-primary/85 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    {saving && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>

                  {/* Log past rate change */}
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 space-y-3 mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--bba-secondary, #b20476)' }}>Log Past Rate Change</p>
                    <p className="text-xs text-slate-400">Manually enter a historical rate to make rate history accurate.</p>
                    {/* Rate type toggle */}
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      {(['hourly', 'salary'] as const).map(v => (
                        <button key={v} type="button"
                          onClick={() => setPastEntry(p => ({ ...p, rateType: v }))}
                          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${(pastEntry as any).rateType === v ? 'bg-bba-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                          {v === 'hourly' ? '⏱ Hourly' : '📅 Salary'}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">
                          {(pastEntry as any).rateType === 'salary' ? 'Annual Salary ($)' : 'Hourly Rate ($)'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input type="number" step="0.01" min={0} value={pastEntry.rate}
                            onChange={e => setPastEntry(p => ({ ...p, rate: e.target.value }))}
                            placeholder="0.00" className={`${inp} pl-6`} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Effective Date</label>
                        <input type="date" value={pastEntry.date}
                          onChange={e => setPastEntry(p => ({ ...p, date: e.target.value }))}
                          className={`${inp} [color-scheme:light]`} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Note (optional)</label>
                      <input type="text" value={pastEntry.notes}
                        onChange={e => setPastEntry(p => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. Starting salary, 2023 raise" className={inp} />
                    </div>
                    {pastMsg && (
                      <div className={`rounded-lg px-3 py-2 text-xs ${pastMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {pastMsg.text}
                      </div>
                    )}
                    <button onClick={handleLogPastRate} disabled={savingPast || !pastEntry.rate || !pastEntry.date}
                      className="w-full rounded-lg border border-purple-300 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-40">
                      {savingPast ? 'Saving…' : 'Log Past Rate Entry'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Rate History tab ── */}
              {tab === 'rate-history' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Rate changes are logged automatically when compensation is updated on the Edit tab.</p>
                  {loadingHistory ? (
                    <div className="flex justify-center py-8">
                      <svg className="h-5 w-5 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                      No rate history yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((entry, i) => (
                        <div key={entry.id} className={`rounded-xl border p-4 ${i === 0 ? 'border-purple-200 bg-purple-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800">
                                {entry.rateType === 'salary'
                                  ? `$${Number(entry.rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr`
                                  : `$${Number(entry.rate).toFixed(2)}/hr`}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {entry.rateType === 'salary' ? 'Annual Salary' : 'Hourly rate'} ·{' '}
                                Effective {new Date(entry.effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                              {entry.notes && <p className="text-xs text-slate-500 mt-1 italic">"{entry.notes}"</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {i === 0 && <span className="text-[10px] font-semibold bg-purple-200 text-purple-700 rounded-full px-2 py-0.5">Current</span>}
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                disabled={deletingId === entry.id}
                                className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40"
                                title="Delete entry">
                                {deletingId === entry.id
                                  ? <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}
