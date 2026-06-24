'use client'

import { useState } from 'react'
import { useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'

interface AccountantRow {
  id:           string
  name:         string
  businessName: string | null
  email:        string | null
  phoneNumber:  string | null
  status:       'ACTIVE' | 'ARCHIVED'
  okToContactAccountant?: boolean
}

type ColKey  = 'name' | 'biz' | 'email' | 'phone' | 'status' | 'consent'
type SortDir = 'asc' | 'desc'

const ALL_COLS: { key: ColKey; label: string; sortable: boolean }[] = [
  { key: 'name',    label: 'Name',                sortable: true  },
  { key: 'biz',     label: 'Business',            sortable: true  },
  { key: 'email',   label: 'Email',               sortable: true  },
  { key: 'phone',   label: 'Phone',               sortable: false },
  { key: 'status',  label: 'Status',              sortable: false },
  { key: 'consent', label: 'Direct Contact Auth.', sortable: false },
]
const DEFAULT_COL_ORDER: ColKey[] = ALL_COLS.map(c => c.key)

const fieldCls = 'w-full rounded-lg bg-white border border-surface-border px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent'

function toRow(a: { id: string; name: string; businessName?: string | null; email?: string | null; phoneNumber?: string | null; status: 'ACTIVE' | 'ARCHIVED'; okToContactAccountant?: boolean }): AccountantRow {
  return { id: a.id, name: a.name, businessName: a.businessName ?? null, email: a.email ?? null, phoneNumber: a.phoneNumber ?? null, status: a.status, okToContactAccountant: a.okToContactAccountant ?? false }
}

function GripIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 10 16" fill="currentColor">
      <circle cx="3" cy="2"  r="1.2" /><circle cx="7" cy="2"  r="1.2" />
      <circle cx="3" cy="7"  r="1.2" /><circle cx="7" cy="7"  r="1.2" />
      <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
    </svg>
  )
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-0.5 text-xs leading-none ${active ? 'text-white' : 'opacity-50'}`}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '⇅'}
    </span>
  )
}

export default function AccountantsPage() {
  const [accountants, setAccountants] = useState<AccountantRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [toggling,  setToggling]  = useState<string | null>(null)
  const [form,      setForm]      = useState({ name: '', businessName: '', email: '', phoneNumber: '' })
  const [error,     setError]     = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [colOrder, setColOrder] = useState<ColKey[]>(DEFAULT_COL_ORDER)
  const [sortCol,  setSortCol]  = useState<ColKey | null>(null)
  const [sortDir,  setSortDir]  = useState<SortDir>('asc')

  useEffect(() => {
    fetch('/api/accountants')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.accountants)) setAccountants(d.accountants.map(toRow)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function resetForm() { setForm({ name: '', businessName: '', email: '', phoneNumber: '' }); setError(null); setEditingId(null) }

  function openEdit(acc: AccountantRow) {
    setForm({ name: acc.name, businessName: acc.businessName ?? '', email: acc.email ?? '', phoneNumber: acc.phoneNumber ?? '' })
    setEditingId(acc.id)
    setModalOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError(null)
    if (editingId) {
      // Update existing
      try {
        const res = await fetch(`/api/accountants/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Failed to update'); return }
        setAccountants(prev => prev.map(a => a.id === editingId ? toRow(data.accountant) : a))
        resetForm(); setModalOpen(false)
      } catch { setError('Network error') }
      finally { setSaving(false) }
      return
    }
    try {
      const res = await fetch('/api/accountants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create'); return }
      setAccountants(prev => [...prev, toRow(data.accountant)])
      resetForm(); setModalOpen(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function setStatus(acc: AccountantRow, status: 'ACTIVE' | 'ARCHIVED') {
    setToggling(acc.id)
    try {
      const res = await fetch(`/api/accountants/${acc.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const newAcc = res.ok ? toRow((await res.json()).accountant) : { ...acc, status }
      setAccountants(prev => prev.map(a => a.id === acc.id ? newAcc : a))
    } catch {
      setAccountants(prev => prev.map(a => a.id === acc.id ? { ...a, status } : a))
    } finally { setToggling(null) }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = [...colOrder]
    const [removed] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, removed)
    setColOrder(next)
  }

  function handleSort(key: ColKey) {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  const sorted = [...accountants].sort((a, b) => {
    if (!sortCol) return 0
    let va = '', vb = ''
    if (sortCol === 'name')  { va = a.name;               vb = b.name }
    if (sortCol === 'biz')   { va = a.businessName ?? ''; vb = b.businessName ?? '' }
    if (sortCol === 'email') { va = a.email ?? '';         vb = b.email ?? '' }
    const cmp = va.localeCompare(vb)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const activeList   = accountants.filter(a => a.status === 'ACTIVE')
  const archivedList = accountants.filter(a => a.status === 'ARCHIVED')

  function renderCell(acc: AccountantRow, key: ColKey): React.ReactNode {
    switch (key) {
      case 'name':
        return <td key={key} className="px-5 py-3 font-medium text-slate-800">{acc.name}</td>
      case 'biz':
        return <td key={key} className="px-5 py-3 text-slate-600">{acc.businessName ?? '—'}</td>
      case 'email':
        return <td key={key} className="px-5 py-3 text-slate-600">{acc.email ?? '—'}</td>
      case 'phone':
        return <td key={key} className="px-5 py-3 text-slate-600">{acc.phoneNumber ?? '—'}</td>
      case 'status':
        return (
          <td key={key} className="px-5 py-3">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
              acc.status === 'ACTIVE'
                ? 'bg-bba-highlight/10 text-bba-highlight ring-bba-highlight/20'
                : 'bg-slate-100 text-slate-500 ring-slate-200'
            }`}>
              {acc.status === 'ACTIVE' ? 'Active' : 'Archived'}
            </span>
          </td>
        )
      case 'consent':
        return (
          <td key={key} className="px-5 py-3">
            {acc.okToContactAccountant ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Authorized
              </span>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </td>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Accountants</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeList.length} active{archivedList.length > 0 ? ` · ${archivedList.length} archived` : ''}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setModalOpen(true) }}
          className="inline-flex items-center gap-2 rounded-lg bg-bba-primary px-4 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 active:scale-95 transition-all"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Accountant
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2d8e8' }}>

        <div
          className="border-b px-5 py-3.5 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bba-primary)', borderColor: 'rgba(78,0,142,0.2)' }}
        >
          <h3 className="text-sm font-semibold text-white">Registered Accountants</h3>
          <span className="text-[10px] font-medium text-white">
            Drag headers to reorder · Click label to sort
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400 bg-white">
            Loading…
          </div>
        ) : accountants.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400 bg-white">
            No accountants yet. Add one above.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white">
            <DragDropContext onDragEnd={handleDragEnd}>
              <table className="w-full text-sm">
                <Droppable droppableId="acct-cols" direction="horizontal">
                  {(dp) => (
                    <thead>
                      <tr
                        ref={dp.innerRef}
                        {...dp.droppableProps}
                        style={{ backgroundColor: 'var(--bba-primary)', borderBottom: '1px solid rgba(78,0,142,0.3)' }}
                      >
                        {colOrder.map((key, idx) => {
                          const col = ALL_COLS.find(c => c.key === key)!
                          return (
                            <Draggable key={key} draggableId={key} index={idx}>
                              {(dragP, snap) => (
                                <th
                                  ref={dragP.innerRef}
                                  {...dragP.draggableProps}
                                  className={`px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap select-none transition-opacity ${snap.isDragging ? 'opacity-50' : ''}`}
                                  style={dragP.draggableProps.style}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      {...dragP.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing opacity-40 hover:opacity-80 transition-opacity shrink-0 text-white"
                                      title="Drag to reorder"
                                    >
                                      <GripIcon />
                                    </span>
                                    {col.sortable ? (
                                      <button
                                        type="button"
                                        onClick={() => handleSort(key)}
                                        className="flex items-center gap-1 hover:opacity-80 transition-opacity w-full"
                                      >
                                        <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{col.label}</span>
                                        <SortArrow active={sortCol === key} dir={sortDir} />
                                      </button>
                                    ) : (
                                      <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{col.label}</span>
                                    )}
                                  </div>
                                </th>
                              )}
                            </Draggable>
                          )
                        })}
                        <th style={{ padding: 0, border: 'none' }}>{dp.placeholder}</th>
                        <th className="px-5 py-3 w-36" />
                      </tr>
                    </thead>
                  )}
                </Droppable>
                <tbody>
                  {sorted.map((acc, i) => {
                    const baseBg = i % 2 === 0 ? '#ffffff' : '#faf5ff'
                    return (
                      <tr
                        key={acc.id}
                        className={acc.status === 'ARCHIVED' ? 'opacity-60' : ''}
                        style={{ backgroundColor: baseBg, borderBottom: '1px solid #f0e8f8' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3e8ff' }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}
                      >
                        {colOrder.map(key => renderCell(acc, key))}
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(acc)}
                              className="text-xs text-purple-600 underline underline-offset-2 hover:text-purple-800 transition-colors"
                            >
                              Edit
                            </button>
                            {acc.status === 'ACTIVE' ? (
                              <button
                                onClick={() => setStatus(acc, 'ARCHIVED')}
                                disabled={toggling === acc.id}
                                className="text-xs text-slate-400 underline underline-offset-2 disabled:opacity-40 transition-opacity hover:text-slate-600"
                              >
                                {toggling === acc.id ? '…' : 'Archive'}
                              </button>
                            ) : (
                              <button
                                onClick={() => setStatus(acc, 'ACTIVE')}
                                disabled={toggling === acc.id}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 bg-slate-100 text-slate-600 border border-slate-200 hover:bg-bba-primary hover:text-white hover:border-bba-primary"
                              >
                                {toggling === acc.id ? '…' : '↩ Reactivate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </DragDropContext>
          </div>
        )}
      </div>

      {/* Add modal */}
      {modalOpen && (
        <>
          <div onClick={() => { setModalOpen(false); resetForm(); }} className="fixed inset-0 z-40 bg-black/40" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-surface-border">
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
                <h2 className="text-base font-semibold text-slate-800">{editingId ? 'Edit Accountant' : 'Add New Accountant'}</h2>
                <button
                  onClick={() => { setModalOpen(false); resetForm(); }}
                  className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input required type="text" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name" className={fieldCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Business Name</label>
                  <input type="text" value={form.businessName}
                    onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="Company or firm name" className={fieldCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                    <input type="email" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.com" className={fieldCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone Number</label>
                    <input type="tel" value={form.phoneNumber}
                      onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                      placeholder="(555) 000-0000" className={fieldCls} />
                  </div>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button type="button" onClick={() => { setModalOpen(false); resetForm(); }}
                    className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving || !form.name.trim()}
                    className="rounded-lg bg-bba-primary px-5 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : '+ Create Accountant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}