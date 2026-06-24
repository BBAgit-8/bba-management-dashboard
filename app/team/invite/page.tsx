'use client'

import { useState, useEffect } from 'react'

type Employee = {
  id: string; name: string; email: string | null
  hubAccess: boolean; invitedAt: string | null; authUserId: string | null
}

export default function InvitePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [inviting,  setInviting]  = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/team/invite')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.employees)) setEmployees(d.employees) })
      .finally(() => setLoading(false))
  }, [])

  async function handleInvite(emp: Employee) {
    if (!emp.email) { setError(`${emp.name} has no email address on file.`); return }
    setInviting(emp.id); setError(null); setSuccess(null)
    const res  = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: emp.id, email: emp.email, name: emp.name }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? JSON.stringify(json) ?? 'Invite failed.')
    } else {
      setSuccess(`Invite sent to ${emp.name} (${emp.email})`)
      setEmployees(prev => prev.map(e =>
        e.id === emp.id ? { ...e, hubAccess: true, invitedAt: new Date().toISOString() } : e
      ))
    }
    setInviting(null)
  }

  async function handleRevoke(emp: Employee) {
    setInviting(emp.id); setError(null); setSuccess(null)
    const res  = await fetch('/api/team/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: emp.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Revoke failed.')
    } else {
      setSuccess(`Access revoked for ${emp.name}.`)
      setEmployees(prev => prev.map(e =>
        e.id === emp.id ? { ...e, hubAccess: false, invitedAt: null, authUserId: null } : e
      ))
    }
    setInviting(null)
  }

  const invited = employees.filter(e => e.hubAccess)
  const pending = employees.filter(e => !e.hubAccess)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Team Hub Access</h1>
        <p className="mt-1 text-sm text-slate-500">
          Invite employees to the BBA Team Hub. They'll receive an email to set their password and can then sign in at <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">/hub</span>.
        </p>
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2">
          <svg className="h-4 w-4 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading team…</p>
      ) : (
        <div className="space-y-6">
          {/* Active access */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--bba-secondary, #b20476)' }}>
              Has Hub Access ({invited.length})
            </h2>
            {invited.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No one has access yet.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                {invited.map(emp => (
                  <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                      {emp.name.split(' ').map(w => w[0]).join('').slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.email ?? 'No email'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Active
                      </span>
                      {emp.invitedAt && (
                        <span className="text-[10px] text-slate-400">
                          Invited {new Date(emp.invitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <button onClick={() => handleRevoke(emp)} disabled={inviting === emp.id}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* No access yet */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--bba-secondary, #b20476)' }}>
              No Access Yet ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Everyone has been invited.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                {pending.map(emp => (
                  <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                      {emp.name.split(' ').map(w => w[0]).join('').slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.email ?? <span className="text-amber-500">⚠ No email on file</span>}</p>
                    </div>
                    <button onClick={() => handleInvite(emp)} disabled={inviting === emp.id || !emp.email}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-bba-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-bba-primary/85 transition-colors disabled:opacity-50">
                      {inviting === emp.id ? (
                        <><svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
                      ) : (
                        <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Send Invite</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
