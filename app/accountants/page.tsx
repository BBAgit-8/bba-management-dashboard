'use client'

import { useState, useEffect, useRef } from 'react'
import { usePersistedState } from '@/lib/use-persisted-state'

interface AccountantRow {
  id:               string
  name:             string
  businessName:     string | null
  email:            string | null
  phoneNumber:      string | null
  status:           'ACTIVE' | 'ARCHIVED'
  okToContactAccountant?: boolean
  hasSecurePortal?: boolean
  activeClientCount: number
  activeClients?: { businessName: string; projectCode: string }[]
  derivedStatus:    'ACTIVE' | 'INACTIVE'
}

type ColKey  = 'name' | 'biz' | 'email' | 'phone' | 'clients' | 'status' | 'consent'
type SortDir = 'asc' | 'desc'

// Progressive phone formatter — turns any input into "(xxx) xxx-xxxx" as digits accrue.
// Strips a leading "1" country code, caps at 10 digits, drops all non-digit input.
function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11)
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(0, 10)
  if (d.length === 0)  return ''
  if (d.length <= 3)   return `(${d}`
  if (d.length <= 6)   return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

const ALL_COLS: { key: ColKey; label: string; sortable: boolean }[] = [
  { key: 'name',    label: 'Name',                sortable: true  },
  { key: 'biz',     label: 'Business',            sortable: true  },
  { key: 'email',   label: 'Email',               sortable: true  },
  { key: 'phone',   label: 'Phone',               sortable: false },
  { key: 'clients', label: 'Active Clients',      sortable: true  },
  { key: 'status',  label: 'Status',              sortable: true  },
  { key: 'consent', label: 'Direct Contact Auth', sortable: false },
]

const fieldCls = 'w-full rounded-lg bg-white border border-surface-border px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent'

function toRow(a: any): AccountantRow {
  return {
    id: a.id, name: a.name,
    businessName: a.businessName ?? null,
    email: a.email ?? null,
    phoneNumber: a.phoneNumber ?? null,
    status: a.status,
    okToContactAccountant: a.okToContactAccountant ?? false,
    hasSecurePortal: a.hasSecurePortal ?? false,
    activeClientCount: a.activeClientCount ?? 0,
    activeClients: Array.isArray(a.activeClients) ? a.activeClients : [],
    derivedStatus: a.derivedStatus ?? (a.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'),
  }
}

export default function AccountantsPage() {
  const [accountants, setAccountants] = useState<AccountantRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [form,       setForm]       = useState({ name: '', businessName: '', email: '', phoneNumber: '', okToContactAccountant: false, hasSecurePortal: false })
  const [error,      setError]      = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = usePersistedState<'ACTIVE' | 'INACTIVE' | 'ALL'>('bba.accountants.statusFilter', 'ACTIVE')
  const [deleteTarget, setDeleteTarget] = useState<AccountantRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // Column order + sort — persisted per browser in localStorage. Bump the key
  // if ALL_COLS changes so stale saved orders don't reference removed columns.
  const STORAGE_ORDER = 'bba.accountants.colOrder.v1'
  const STORAGE_SORT  = 'bba.accountants.sort.v1'
  const ALL_COL_KEYS  = ALL_COLS.map(c => c.key)

  const [colOrder,  setColOrder]  = useState<ColKey[]>(() => {
    if (typeof window === 'undefined') return ALL_COL_KEYS
    try {
      const saved = localStorage.getItem(STORAGE_ORDER)
      if (saved) {
        const parsed = JSON.parse(saved) as ColKey[]
        // Sanity: only accept if every key still exists in ALL_COLS.
        if (Array.isArray(parsed) && parsed.length === ALL_COL_KEYS.length
            && parsed.every(k => ALL_COL_KEYS.includes(k))) return parsed
      }
    } catch { /* ignore corrupt storage */ }
    return ALL_COL_KEYS
  })

  const [sortCol,   setSortCol]   = useState<ColKey | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(STORAGE_SORT)
      if (raw) {
        const p = JSON.parse(raw) as { col: ColKey | null; dir: SortDir }
        if (p && (p.col === null || ALL_COL_KEYS.includes(p.col))) return p.col
      }
    } catch { /* ignore */ }
    return null
  })
  const [sortDir,   setSortDir]   = useState<SortDir>(() => {
    if (typeof window === 'undefined') return 'asc'
    try {
      const raw = localStorage.getItem(STORAGE_SORT)
      if (raw) {
        const p = JSON.parse(raw) as { col: ColKey | null; dir: SortDir }
        if (p && (p.dir === 'asc' || p.dir === 'desc')) return p.dir
      }
    } catch { /* ignore */ }
    return 'asc'
  })

  // Persist on change.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_ORDER, JSON.stringify(colOrder)) } catch {}
  }, [colOrder])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_SORT, JSON.stringify({ col: sortCol, dir: sortDir })) } catch {}
  }, [sortCol, sortDir])

  // Pointer drag for col reorder
  const colDrag = useRef<{ key: string; idx: number } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  function startColDrag(e: React.MouseEvent, key: string, idx: number) {
    e.preventDefault()
    colDrag.current = { key, idx }
    let latest: string | null = null
    function onMove(ev: MouseEvent) {
      const ths = document.querySelectorAll('[data-acct-col]')
      for (const th of ths) {
        const r = th.getBoundingClientRect()
        if (ev.clientX >= r.left && ev.clientX <= r.right) {
          latest = (th as HTMLElement).dataset.acctCol ?? null
          setDragOver(latest); break
        }
      }
    }
    function onUp() {
      if (colDrag.current && latest && latest !== colDrag.current.key) {
        setColOrder(prev => {
          const next = [...prev]
          const fi = next.indexOf(colDrag.current!.key as ColKey)
          const ti = next.indexOf(latest as ColKey)
          if (fi !== -1 && ti !== -1) { next.splice(fi, 1); next.splice(ti, 0, colDrag.current!.key as ColKey) }
          return next
        })
      }
      colDrag.current = null; setDragOver(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    fetch('/api/accountants')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.accountants)) setAccountants(d.accountants.map(toRow)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function resetForm() { setForm({ name: '', businessName: '', email: '', phoneNumber: '', okToContactAccountant: false, hasSecurePortal: false }); setError(null); setEditingId(null) }

  function openEdit(acc: AccountantRow) {
    setForm({ name: acc.name, businessName: acc.businessName ?? '', email: acc.email ?? '', phoneNumber: formatPhone(acc.phoneNumber ?? ''), okToContactAccountant: !!acc.okToContactAccountant, hasSecurePortal: !!acc.hasSecurePortal })
    setEditingId(acc.id); setModalOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError(null)
    if (editingId) {
      try {
        const res = await fetch(`/api/accountants/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Failed'); return }
        setAccountants(prev => prev.map(a => a.id === editingId ? toRow({ ...a, ...data.accountant }) : a))
        resetForm(); setModalOpen(false)
      } catch { setError('Network error') }
      finally { setSaving(false) }
      return
    }
    try {
      const res = await fetch('/api/accountants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setAccountants(prev => [...prev, toRow(data.accountant)])
      resetForm(); setModalOpen(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/accountants/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Delete failed')
        return
      }
      setAccountants(prev => prev.filter(a => a.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { setError('Network error') }
    finally { setDeleting(false) }
  }

  function handleSort(key: ColKey) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  const filtered = accountants.filter(a => {
    if (statusFilter === 'ALL') return true
    return a.derivedStatus === statusFilter
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortCol) return 0
    let va = '', vb = ''
    if (sortCol === 'name')    { va = a.name;                       vb = b.name }
    if (sortCol === 'biz')     { va = a.businessName ?? '';         vb = b.businessName ?? '' }
    if (sortCol === 'email')   { va = a.email ?? '';                vb = b.email ?? '' }
    if (sortCol === 'clients') { return sortDir === 'asc' ? a.activeClientCount - b.activeClientCount : b.activeClientCount - a.activeClientCount }
    if (sortCol === 'status')  { va = a.derivedStatus;              vb = b.derivedStatus }
    const cmp = va.localeCompare(vb)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const activeCount   = accountants.filter(a => a.derivedStatus === 'ACTIVE').length
  const inactiveCount = accountants.filter(a => a.derivedStatus === 'INACTIVE').length

  function renderCell(acc: AccountantRow, key: ColKey): React.ReactNode {
    switch (key) {
      case 'name':    return <td key={key} className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{acc.name}</td>
      case 'biz':     return <td key={key} className="px-5 py-3 text-slate-600">{acc.businessName ?? '—'}</td>
      case 'email':   return <td key={key} className="px-5 py-3 text-slate-600">{acc.email ?? '—'}</td>
      case 'phone':   return <td key={key} className="px-5 py-3 text-slate-600 tabular-nums">{acc.phoneNumber ? formatPhone(acc.phoneNumber) : '—'}</td>
      case 'clients': return (
        <td key={key} className="px-5 py-3 text-center tabular-nums text-slate-700">
          {acc.activeClientCount > 0 ? (
            <span
              className="group relative inline-block cursor-help border-b border-dashed border-slate-300"
              tabIndex={0}
            >
              {acc.activeClientCount}
              {acc.activeClients && acc.activeClients.length > 0 && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-left text-xs text-white shadow-lg group-hover:block group-focus:block min-w-[160px] max-w-[280px] whitespace-normal"
                >
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                    Active Clients
                  </span>
                  {acc.activeClients.map(c => (
                    <span key={c.projectCode || c.businessName} className="block truncate">
                      {c.businessName}
                    </span>
                  ))}
                </span>
              )}
            </span>
          ) : '—'}
        </td>
      )
      case 'status':
        return (
          <td key={key} className="px-5 py-3">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              acc.derivedStatus === 'ACTIVE'
                ? 'bg-green-500 text-white'
                : 'bg-slate-300 text-slate-600'
            }`}>
              {acc.derivedStatus === 'ACTIVE' ? 'Active' : 'Inactive'}
            </span>
          </td>
        )
      case 'consent':
        return (
          <td key={key} className="px-5 py-3">
            {acc.okToContactAccountant
              ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200"><svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>Authorized</span>
              : <span className="text-xs text-slate-400">—</span>}
          </td>
        )
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Accountants</h1>
          <p className="mt-1 text-sm text-slate-500">{activeCount} active · {inactiveCount} inactive</p>
        </div>
        <button onClick={() => { resetForm(); setModalOpen(true) }}
          className="inline-flex items-center gap-2 rounded-lg bg-bba-action px-4 py-2 text-sm font-semibold text-white hover:bg-bba-action/85 active:scale-95 transition-all">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add New Accountant
        </button>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        {(['ACTIVE','INACTIVE','ALL'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all ${statusFilter === s ? 'bg-bba-action text-white ring-purple-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-purple-300 hover:text-bba-action'}`}>
            {s === 'ALL' ? 'All' : s === 'ACTIVE' ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2d8e8' }}>
        <div className="border-b px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: 'var(--bba-primary)', borderColor: 'rgba(78,0,142,0.2)' }}>
          <h3 className="text-sm font-semibold text-white">Registered Accountants</h3>
          <span className="text-[10px] font-medium text-white/70">Drag headers to reorder · Click to sort</span>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400 bg-white">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400 bg-white">No accountants found.</div>
        ) : (
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bba-primary)', borderBottom: '1px solid rgba(78,0,142,0.3)' }}>
                  {colOrder.map((key, idx) => {
                    const col = ALL_COLS.find(c => c.key === key)!
                    const isDragOver = dragOver === key && colDrag.current?.key !== key
                    return (
                      <th key={key} data-acct-col={key}
                        onMouseDown={e => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          if (e.clientX > rect.right - 8) return
                          startColDrag(e, key, idx)
                        }}
                        className={`px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider select-none cursor-grab active:cursor-grabbing transition-colors ${isDragOver ? 'bg-white/20' : ''}`}
                      >
                        {col.sortable ? (
                          <button type="button" onClick={() => handleSort(key)}
                            className="flex items-center justify-center gap-1 hover:opacity-80 transition-opacity w-full text-white font-bold uppercase tracking-wider">
                            {col.label}
                            <span className="text-[9px] opacity-60">{sortCol === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                          </button>
                        ) : (
                          <span className="font-bold text-white">{col.label}</span>
                        )}
                      </th>
                    )
                  })}
                  <th className="px-5 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((acc, i) => {
                  const baseBg = i % 2 === 0 ? '#ffffff' : '#faf5ff'
                  return (
                    <tr key={acc.id} style={{ backgroundColor: baseBg, borderBottom: '1px solid #f0e8f8' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3e8ff' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}>
                      {colOrder.map(key => renderCell(acc, key))}
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(acc)}
                          className="text-xs text-bba-action underline underline-offset-2 hover:text-purple-800 transition-colors">
                          Edit
                        </button>
                        <span className="mx-2 text-slate-300">·</span>
                        <button onClick={() => setDeleteTarget(acc)}
                          className="text-xs text-red-500 underline underline-offset-2 hover:text-red-700 transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <>
          <div onClick={() => { setModalOpen(false); resetForm() }} className="fixed inset-0 z-40 bg-black/40" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-surface-border">
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
                <h2 className="text-base font-semibold text-slate-800">{editingId ? 'Edit Accountant' : 'Add New Accountant'}</h2>
                <button onClick={() => { setModalOpen(false); resetForm() }} className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Name <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className={fieldCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Business Name</label>
                  <input type="text" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Company or firm name" className={fieldCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
                    <input type="tel" value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: formatPhone(e.target.value) }))} placeholder="(555) 000-0000" className={fieldCls} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer pt-1">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, okToContactAccountant: !f.okToContactAccountant }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-bba-action focus:ring-offset-2 ${form.okToContactAccountant ? 'bg-bba-action' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.okToContactAccountant ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm text-slate-700">Direct authorization <span className="text-xs text-slate-400">(OK to contact directly)</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, hasSecurePortal: !f.hasSecurePortal }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-bba-action focus:ring-offset-2 ${form.hasSecurePortal ? 'bg-bba-action' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.hasSecurePortal ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm text-slate-700">Secure portal <span className="text-xs text-slate-400">(files exchanged via portal URL)</span></span>
                </label>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button type="button" onClick={() => { setModalOpen(false); resetForm() }} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                  <button type="submit" disabled={saving || !form.name.trim()} className="rounded-lg bg-bba-action px-5 py-2 text-sm font-semibold text-white hover:bg-bba-action/85 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : '+ Create Accountant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <>
          <div onClick={() => !deleting && setDeleteTarget(null)} className="fixed inset-0 z-40 bg-black/40" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-surface-border p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Delete Accountant</h2>
              <p className="text-sm text-slate-600">
                Delete <span className="font-semibold">{deleteTarget.name}</span>{deleteTarget.businessName ? ` (${deleteTarget.businessName})` : ''}? This cannot be undone.
              </p>
              {deleteTarget.activeClientCount > 0 && (
                <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                  Heads-up: {deleteTarget.activeClientCount} active client{deleteTarget.activeClientCount === 1 ? '' : 's'} reference this accountant. Their accountant assignment will be cleared.
                </p>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                  className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={handleDelete} disabled={deleting}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
