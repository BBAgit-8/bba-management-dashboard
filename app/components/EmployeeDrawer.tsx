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

export default function EmployeeDrawer({ employee, onClose, onUpdated }: Props) {
  const open = employee != null
  const [tab,     setTab]     = useState<'profile' | 'rate-history'>('profile')
  const [history, setHistory] = useState<RateHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!employee) return
    setTab('profile')
    setInviteMsg(null)
  }, [employee?.id])

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
              {(['profile', 'rate-history'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors capitalize ${
                    tab === t
                      ? 'border-b-2 border-purple-600 text-purple-700'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}>
                  {t === 'rate-history' ? 'Rate History' : 'Profile'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tab === 'profile' && (
                <div className="space-y-5">
                  {/* Details */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100" style={{ backgroundColor: 'rgba(109,40,217,0.05)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700">Details</p>
                    </div>
                    <div className="px-4 py-1">
                      <InfoRow label="Email"           value={employee.email} />
                      <InfoRow label="Title"           value={employee.title} />
                      <InfoRow label="Contracted Hrs"  value={employee.contractedHours ? `${employee.contractedHours} hrs/week` : null} />
                      <InfoRow label="Admin Time"      value={employee.adminTimePercent ? `${employee.adminTimePercent}%` : null} />
                    </div>
                  </div>

                  {/* Compensation */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100" style={{ backgroundColor: 'rgba(109,40,217,0.05)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700">Compensation</p>
                    </div>
                    <div className="px-4 py-1">
                      <InfoRow label="Rate Type"      value={employee.rateType === 'salary' ? 'Salary' : 'Hourly'} />
                      {employee.rateType === 'salary' && employee.salary && (
                        <InfoRow label="Annual Salary" value={`$${Number(employee.salary).toLocaleString()}`} />
                      )}
                      <InfoRow label="Effective Hourly Rate" value={
                        <span className="font-bold text-purple-700">${Number(employee.effectiveHourlyRate).toFixed(2)}/hr</span>
                      } />
                    </div>
                  </div>

                  {/* Client Hub Access */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100" style={{ backgroundColor: 'rgba(109,40,217,0.05)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-700">Client Hub Access</p>
                    </div>
                    <div className="px-4 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-700">
                            {employee.hubAccess ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="font-medium text-green-700">Active access</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">No access yet</span>
                            )}
                          </p>
                          {employee.invitedAt && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Invited {new Date(employee.invitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                          {!employee.email && (
                            <p className="text-[10px] text-amber-500 mt-0.5">⚠ Add email address to send invite</p>
                          )}
                        </div>
                        {employee.hubAccess ? (
                          <button onClick={handleRevoke} disabled={revoking}
                            className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
                            {revoking ? 'Revoking…' : 'Revoke'}
                          </button>
                        ) : (
                          <button onClick={handleInvite} disabled={inviting || !employee.email}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-bba-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-bba-primary/85 transition-colors disabled:opacity-50">
                            {inviting ? (
                              <><svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
                            ) : (
                              <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Send Invite</>
                            )}
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

              {tab === 'rate-history' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">All rate changes are logged automatically when compensation is updated.</p>
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
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-800">${Number(entry.rate).toFixed(2)}/hr</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {entry.rateType === 'salary' ? 'Salary-based' : 'Hourly'} ·{' '}
                                Effective {new Date(entry.effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                              {entry.notes && <p className="text-xs text-slate-500 mt-1">{entry.notes}</p>}
                            </div>
                            {i === 0 && (
                              <span className="text-[10px] font-semibold bg-purple-200 text-purple-700 rounded-full px-2 py-0.5">Current</span>
                            )}
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
