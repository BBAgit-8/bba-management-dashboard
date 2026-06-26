'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabaseClient'

type ClientView = {
  id:             string
  name:           string
  visibleCols:    string[]
  colOrder:       string[]
  colWidths:      Record<string, number>
  filters:        {
    statusFilters:     string[]
    bookkeeperFilters: string[]
    entityTypeFilters: string[]
    ptFilters:         string[]
    cadenceFilters:    string[]
    search:            string
  }
  sortKey:        string
  sortDir:        string
  sharedWithTeam: boolean
  allowEditing:   boolean
}

type Client = Record<string, any>

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active:      { bg: '#dcfce7', text: '#166534', label: 'Active'       },
  offboarding: { bg: '#fef9c3', text: '#854d0e', label: 'Off-boarding' },
  inactive:    { bg: '#f1f5f9', text: '#475569', label: 'Inactive'     },
  archived:    { bg: '#f1f5f9', text: '#94a3b8', label: 'Archived'     },
}

function deriveStatus(client: Client): string {
  if (client.archiveStatus === 'ARCHIVED') return 'archived'
  if (client.archiveStatus === 'OFFBOARDING') return 'offboarding'
  if (!client.contractEndDate) return 'active'
  const end = new Date(client.contractEndDate.slice(0, 10))
  const now = new Date(); now.setHours(0,0,0,0)
  return end < now ? 'inactive' : 'active'
}

function fmtVal(key: string, val: any): string {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if ((key.toLowerCase().includes('rate') || key.toLowerCase().includes('cost')) && typeof val === 'number')
    return `$${Number(val).toLocaleString()}`
  if (key.toLowerCase().includes('date') && typeof val === 'string')
    return val.slice(0, 10)
  if (typeof val === 'string') return val.replace(/_/g, ' ')
  return String(val)
}

function colLabel(key: string): string {
  if (key === 'name') return 'Client Name'
  if (key === 'code') return 'Code'
  return key
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

const EDITABLE_TEXT = new Set(['clientContactName', 'clientContactEmail', 'clientContactPhone', 'notes', 'bookkeeper'])

export default function HubViewPage() {
  const { viewId } = useParams<{ viewId: string }>()
  const [view,       setView]       = useState<ClientView | null>(null)
  const [allClients, setAllClients] = useState<Client[]>([])
  const [empName,    setEmpName]    = useState('')
  const [loading,    setLoading]    = useState(true)
  const [showAll,    setShowAll]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [savingId,   setSavingId]   = useState<string | null>(null)
  const [localEdits, setLocalEdits] = useState<Record<string, Record<string, string>>>({})

  // Sort state
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Column widths — start from view definition, user can resize
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const resizingCol = useRef<{ key: string; startX: number; startW: number } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabaseClient.auth.getSession()
      if (!data.session) return
      const email = data.session.user.email ?? ''
      const meRes  = await fetch(`/api/hub/me?email=${encodeURIComponent(email)}`)
      const meJson = await meRes.json()
      if (meJson.name) setEmpName(meJson.name)

      const [vRes, cRes] = await Promise.all([fetch('/api/views'), fetch('/api/clients')])
      const vJson = await vRes.json()
      const cJson = await cRes.json()
      const found = (vJson.views ?? []).find((v: ClientView) => v.id === viewId)
      if (found) {
        setView(found)
        setSortKey(found.sortKey ?? 'name')
        setSortDir((found.sortDir ?? 'asc') as 'asc' | 'desc')
        setColWidths(found.colWidths ?? {})
      }
      if (Array.isArray(cJson.clients)) setAllClients(cJson.clients)
      setLoading(false)
    }
    load()
  }, [viewId])

  // Column resize handlers
  function startResize(e: React.MouseEvent, colKey: string, currentW: number) {
    e.preventDefault()
    e.stopPropagation()
    resizingCol.current = { key: colKey, startX: e.clientX, startW: currentW }

    function onMove(ev: MouseEvent) {
      if (!resizingCol.current) return
      const delta = ev.clientX - resizingCol.current.startX
      const newW = Math.max(60, resizingCol.current.startW + delta)
      setColWidths(prev => ({ ...prev, [resizingCol.current!.key]: newW }))
    }
    function onUp() {
      resizingCol.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Sort toggle
  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // Patch cell
  async function patchCell(client: Client, field: string, value: string) {
    setLocalEdits(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [field]: value } }))
    setSavingId(client.id)
    try {
      await fetch(`/api/clients/${client.harvestProjectCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
      setAllClients(prev => prev.map(c => c.id === client.id ? { ...c, [field]: value || null } : c))
      setLocalEdits(prev => {
        const next = { ...prev }
        if (next[client.id]) delete next[client.id][field]
        return next
      })
    } catch { /* silent */ }
    finally { setSavingId(null) }
  }

  // Filter
  const filtered = allClients.filter(client => {
    if (!showAll && empName) {
      if ((client.bookkeeper ?? '').toLowerCase() !== empName.toLowerCase()) return false
    }
    const status = deriveStatus(client)
    if (view?.filters?.statusFilters?.length) {
      if (!view.filters.statusFilters.includes(status)) return false
    } else {
      if (status === 'archived') return false
    }
    if (view?.filters?.entityTypeFilters?.length) {
      if (!view.filters.entityTypeFilters.includes(client.entityType ?? '')) return false
    }
    if (view?.filters?.ptFilters?.length) {
      if (!view.filters.ptFilters.includes(client.projectType ?? '')) return false
    }
    if (view?.filters?.cadenceFilters?.length) {
      if (!view.filters.cadenceFilters.includes(client.processingCadence ?? '')) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!client.name.toLowerCase().includes(q) && !(client.harvestProjectCode ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const aVal = sortKey === 'status' ? deriveStatus(a) : (a[sortKey] ?? '')
    const bVal = sortKey === 'status' ? deriveStatus(b) : (b[sortKey] ?? '')
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const cols = view ? view.colOrder.filter(k => view.visibleCols.includes(k)) : ['name', 'status', 'bookkeeper']
  const canEdit = view?.allowEditing ?? false

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-56 bg-slate-200 rounded animate-pulse" />
      <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
    </div>
  )

  if (!view) return (
    <div className="text-center py-20 space-y-3">
      <p className="text-slate-400">View not found.</p>
      <Link href="/hub/dashboard" className="text-sm text-bba-action hover:underline">← Back to My Clients</Link>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{view.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {sorted.length} client{sorted.length !== 1 ? 's' : ''}
            {!showAll && empName ? ` · ${empName.split(' ')[0]}'s clients` : ' · All bookkeepers'}
            {canEdit && <span className="ml-2 text-xs text-bba-action font-medium">· Editing enabled</span>}
          </p>
        </div>
        {/* My Clients / All toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shrink-0">
          <button onClick={() => setShowAll(false)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${!showAll ? 'bg-bba-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            My Clients
          </button>
          <button onClick={() => setShowAll(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${showAll ? 'bg-bba-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            All Clients
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bba-action" />
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-400 text-sm">
            {search ? 'No clients match your search.' : !showAll ? 'No clients assigned to you match this view.' : 'No clients match this view.'}
          </p>
          {!showAll && (
            <button onClick={() => setShowAll(true)} className="mt-3 text-sm text-bba-action hover:underline">
              View all bookkeepers →
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#4e008e' }}>
                  {cols.map(colKey => {
                    const w = colWidths[colKey] ?? 150
                    const isActive = sortKey === colKey
                    return (
                      <th key={colKey}
                        className="relative px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white select-none"
                        style={{ width: w, minWidth: w }}>
                        {/* Sort button */}
                        <button
                          onClick={() => handleSort(colKey)}
                          className="flex items-center gap-1 hover:text-white/80 transition-colors w-full">
                          <span className="truncate">{colLabel(colKey)}</span>
                          <span className="text-[9px] opacity-60 shrink-0">
                            {isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                          </span>
                        </button>
                        {/* Resize handle */}
                        <div
                          onMouseDown={e => startResize(e, colKey, w)}
                          className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center group"
                          style={{ touchAction: 'none' }}>
                          <div className="w-px h-4 bg-white/30 group-hover:bg-white/70 transition-colors" />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((client, idx) => {
                  const status = deriveStatus(client)
                  const statusStyle = STATUS_COLORS[status] ?? STATUS_COLORS.active
                  const isSaving = savingId === client.id
                  const rowBg = idx % 2 === 0 ? '#ffffff' : '#faf5ff'

                  return (
                    <tr key={client.id} style={{ backgroundColor: isSaving ? '#f5f0ff' : rowBg }}>
                      {cols.map(colKey => {
                        const rawVal = localEdits[client.id]?.[colKey] ?? client[colKey]

                        if (colKey === 'name') return (
                          <td key={colKey} className="px-4 py-3 sticky left-0 z-10"
                            style={{ backgroundColor: rowBg, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' }}>
                            <Link href={`/hub/clients/${client.harvestProjectCode}`}
                              className="font-medium text-slate-800 hover:text-bba-action transition-colors block truncate">
                              {client.name}
                            </Link>
                          </td>
                        )

                        if (colKey === 'status') return (
                          <td key={colKey} className="px-4 py-3">
                            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                              style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                              {statusStyle.label}
                            </span>
                          </td>
                        )

                        if (colKey === 'code') return (
                          <td key={colKey} className="px-4 py-3">
                            <span className="font-mono text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                              {client.harvestProjectCode}
                            </span>
                          </td>
                        )

                        if (canEdit && EDITABLE_TEXT.has(colKey)) return (
                          <td key={colKey} className="px-4 py-3">
                            <input
                              defaultValue={rawVal ?? ''}
                              onBlur={e => { if (e.target.value !== (client[colKey] ?? '')) patchCell(client, colKey, e.target.value) }}
                              className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-700 hover:border-slate-200 focus:border-bba-action focus:outline-none focus:ring-1 focus:ring-bba-action"
                            />
                          </td>
                        )

                        return (
                          <td key={colKey} className="px-4 py-3 text-slate-600 truncate">
                            {fmtVal(colKey, rawVal)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
