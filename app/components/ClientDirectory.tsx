'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
type Tag = { id: string; name: string; color: string }
type ProcessingCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY'
type ProjectType = 'ANNUAL' | 'CLEAN_UP' | 'MONTHLY_MAINTENANCE' | 'QBO_ONLY' | 'RECURRING'

// Shape returned by GET /api/clients
type ApiClient = {
  id: string
  name: string
  harvestProjectCode: string
  archiveStatus: string
  processingCadence: string
  contractEndDate?: string | null
  projectType?: string | null
  revenueType?: string | null
  qboOnly?: boolean
  tags: Tag[]
  sows: Array<{ billingType: string; fixedMonthlyRate?: number | null; billingRate?: number | null }>
}
import AddClientPanel from './AddClientPanel'

// ── Column / status types ─────────────────────────────────────────────────────
type ColKey   = 'name' | 'code' | 'projectType' | 'revenueType' | 'bookkeepingRate' | 'status'
type SortKey  = 'name' | 'code' | 'projectType' | 'revenueType' | 'bookkeepingRate' | 'status'
type StatusKey = 'active' | 'archived' | 'inactive' | 'offboarding' | 'pendingArchive'
type StatusFilter = StatusKey | 'all'

const ALL_COLUMNS: { key: ColKey; label: string; sortKey?: SortKey; align?: 'right' }[] = [
  { key: 'name',            label: 'Client Name',    sortKey: 'name' },
  { key: 'code',            label: 'Project Code',   sortKey: 'code' },
  { key: 'projectType',     label: 'Project Type',   sortKey: 'projectType' },
  { key: 'revenueType',     label: 'Revenue Type',   sortKey: 'revenueType' },
  { key: 'bookkeepingRate', label: 'Bookkeeping Rate', sortKey: 'bookkeepingRate', align: 'right' },
  { key: 'status',          label: 'Status',         sortKey: 'status' },
]
const DEFAULT_COL_ORDER: ColKey[] = ALL_COLUMNS.map(c => c.key)

// ── Style maps ────────────────────────────────────────────────────────────────
const dropSel = 'rounded-lg bg-white border border-surface-border px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-primary'

const PTYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ANNUAL:              { bg: 'bg-blue-500/15',    text: 'text-blue-400',      label: 'Annual'      },
  CLEAN_UP:            { bg: 'bg-orange-500/15',  text: 'text-orange-500',    label: 'Clean Up'    },
  MONTHLY_MAINTENANCE: { bg: 'bg-bba-primary/15', text: 'text-bba-secondary', label: 'Mthly Maint' },
  QBO_ONLY:            { bg: 'bg-sky-500/15',     text: 'text-sky-400',       label: 'QBO Only'    },
  RECURRING:           { bg: 'bg-teal-500/15',    text: 'text-teal-500',      label: 'Recurring'   },
}

const RTYPE_LABEL: Record<string, string> = {
  CLEANUP:                   'Cleanup',
  FREE:                      'Free',
  HOURLY_CLEANUP:            'Hourly Cleanup',
  QBO_ONLY_ANCHOR:           'QBO - Anchor',
  QBO_ONLY_QBO:              'QBO - QBO',
  RECURRING_MONTHLY_ACH:     'Monthly - ACH',
  RECURRING_MONTHLY_HOURLY:  'Monthly - Hourly',
  RECURRING_MONTHLY_INVOICED:'Monthly - Invoiced',
}

// Status pill styles + labels
const STATUS_PILL: Record<StatusKey, { bg: string; text: string; ring: string; label: string }> = {
  active:         { bg: 'bg-bba-highlight/10', text: 'text-bba-highlight',   ring: 'ring-bba-highlight/20', label: 'Active'          },
  offboarding:    { bg: 'bg-amber-500/10',     text: 'text-amber-400',       ring: 'ring-amber-500/20',     label: 'Off-boarding'    },
  inactive:       { bg: 'bg-slate-700/40',     text: 'text-slate-400',       ring: 'ring-slate-600/40',     label: 'Inactive'        },
  archived:       { bg: 'bg-slate-700/50',     text: 'text-slate-500',       ring: 'ring-slate-600/50',     label: 'Archived'        },
  pendingArchive: { bg: 'bg-orange-500/10',    text: 'text-orange-400',      ring: 'ring-orange-500/20',    label: 'Pending Archive' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deriveStatus(client: ApiClient): StatusKey {
  if (client.contractEndDate) {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const end = new Date(client.contractEndDate)
    end.setHours(0, 0, 0, 0)
    return end <= now ? 'inactive' : 'offboarding'
  }
  switch (client.archiveStatus) {
    case 'ACTIVE':          return 'active'
    case 'ARCHIVED':        return 'archived'
    case 'INACTIVE':        return 'inactive'
    case 'OFF_BOARDING':    return 'offboarding'
    case 'PENDING_ARCHIVE': return 'pendingArchive'
    default:                return 'active'
  }
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function clientRate(sows: ApiClient['sows']): { value: number; suffix: string } | null {
  const sow = sows?.[0]
  if (!sow) return null
  if (sow.billingType === 'FLAT' && sow.fixedMonthlyRate != null) {
    return { value: sow.fixedMonthlyRate, suffix: '/mo' }
  }
  if (sow.billingType === 'HOURLY' && sow.billingRate != null) {
    return { value: sow.billingRate, suffix: '/hr' }
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClientDirectory() {
  const [search,        setSearch]       = useState('')
  const [panelOpen,     setPanelOpen]    = useState(false)
  const [sortKey,       setSortKey]      = useState<SortKey>('name')
  const [sortDir,       setSortDir]      = useState<'asc' | 'desc'>('asc')
  // Filters
  const [tagFilters,    setTagFilters]   = useState<Set<string>>(new Set())
  const [cadenceFilter, setCadenceFilter] = useState<ProcessingCadence | 'all'>('all')
  const [ptFilter,      setPtFilter]     = useState<ProjectType | 'all'>('all')
  const [statusFilter,  setStatusFilter] = useState<StatusFilter>('all')

  // Column order persisted to localStorage — new key invalidates old 7-column order
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COL_ORDER
    try {
      const saved = localStorage.getItem('cd-col-order-v3')
      if (saved) {
        const parsed = JSON.parse(saved) as ColKey[]
        if (
          parsed.length === DEFAULT_COL_ORDER.length &&
          parsed.every(k => DEFAULT_COL_ORDER.includes(k as ColKey))
        ) return parsed
      }
    } catch { /* ignore */ }
    return DEFAULT_COL_ORDER
  })

  const [tags,    setTags]    = useState<Tag[]>([])
  const [clients, setClients] = useState<ApiClient[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.tags) && d.tags.length > 0) setTags(d.tags) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.clients)) setClients(d.clients) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fetchKey])

  function refetchClients() { setFetchKey(k => k + 1) }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = Array.from(colOrder)
    const [removed] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, removed)
    setColOrder(next)
    localStorage.setItem('cd-col-order-v3', JSON.stringify(next))
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function toggleTag(id: string) {
    setTagFilters(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const activeCount = clients.filter(c => c.archiveStatus === 'ACTIVE' && !c.qboOnly).length
  const qboCount    = clients.filter(c => c.qboOnly).length

  const filtered = useMemo(() => {
    const list = clients.filter(c => {
      if (tagFilters.size > 0 && !c.tags.some(t => tagFilters.has(t.id))) return false
      if (cadenceFilter !== 'all' && c.processingCadence !== cadenceFilter) return false
      if (ptFilter !== 'all' && (c.projectType ?? 'MONTHLY_MAINTENANCE') !== ptFilter) return false
      if (statusFilter !== 'all' && deriveStatus(c) !== statusFilter) return false
      const q = search.trim().toLowerCase()
      if (q && !c.name.toLowerCase().includes(q) && !c.harvestProjectCode.toLowerCase().includes(q)) return false
      return true
    })
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')            cmp = a.name.localeCompare(b.name)
      if (sortKey === 'code')            cmp = a.harvestProjectCode.localeCompare(b.harvestProjectCode)
      if (sortKey === 'projectType')     cmp = (a.projectType ?? '').localeCompare(b.projectType ?? '')
      if (sortKey === 'revenueType')     cmp = (a.revenueType ?? '').localeCompare(b.revenueType ?? '')
      if (sortKey === 'bookkeepingRate') {
        const ra = clientRate(a.id as any)?.value ?? -1
        const rb = clientRate(b.id as any)?.value ?? -1
        cmp = ra - rb
      }
      if (sortKey === 'status') {
        cmp = STATUS_PILL[deriveStatus(a)].label.localeCompare(STATUS_PILL[deriveStatus(b)].label)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [clients, search, tagFilters, cadenceFilter, ptFilter, statusFilter, sortKey, sortDir])

  const anyFilter = tagFilters.size > 0 || cadenceFilter !== 'all' || ptFilter !== 'all' || statusFilter !== 'all' || !!search.trim()

  function clearFilters() {
    setTagFilters(new Set()); setCadenceFilter('all'); setPtFilter('all'); setStatusFilter('all'); setSearch('')
  }

  function SortBtn({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sortKey === k
    return (
      <button
        onClick={e => { e.stopPropagation(); toggleSort(k) }}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer select-none w-full"
      >
        <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{children}</span>
        <span className="text-[9px] opacity-60 shrink-0">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Client Directory</h1>
          <p className="mt-1 text-sm text-slate-400">
            {activeCount} active client{activeCount !== 1 ? 's' : ''}{qboCount > 0 ? ` · ${qboCount} QBO only` : ''}
          </p>
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-bba-primary px-4 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 active:scale-95 transition-all shrink-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Client
        </button>
      </div>


      {/* ── Filters ── */}
      <div className="space-y-3">
        {/* Tag pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setTagFilters(new Set())}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all ${tagFilters.size === 0 ? 'bg-slate-600 ring-slate-500 text-slate-100' : 'ring-slate-700 text-slate-400 hover:text-slate-200 hover:ring-slate-600'}`}
          >
            All Tags
          </button>
          {tags.map(tag => {
            const count = clients.filter(c => c.tags.some(t => t.id === tag.id)).length
            if (!count) return null
            const active = tagFilters.has(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
                style={{
                  backgroundColor: active ? `${tag.color}20` : 'transparent',
                  color: active ? tag.color : `${tag.color}aa`,
                  boxShadow: `0 0 0 1px ${active ? tag.color : tag.color + '55'}`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Dropdown filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={cadenceFilter} onChange={e => setCadenceFilter(e.target.value as ProcessingCadence | 'all')} className={dropSel}>
            <option value="all">All Cadences</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Bi-Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </select>
          <select value={ptFilter} onChange={e => setPtFilter(e.target.value as ProjectType | 'all')} className={dropSel}>
            <option value="all">All Project Types</option>
            <option value="ANNUAL">Annual</option>
            <option value="CLEAN_UP">Clean Up</option>
            <option value="MONTHLY_MAINTENANCE">Monthly Maintenance</option>
            <option value="QBO_ONLY">QBO Only</option>
            <option value="RECURRING">Recurring</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className={dropSel}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="offboarding">Off-boarding</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
            <option value="pendingArchive">Pending Archive</option>
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by client name or project code…"
              className="w-full rounded-lg bg-white border border-surface-border pl-9 pr-9 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-primary focus:border-transparent"
              style={{ colorScheme: 'dark' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {anyFilter && (
            <button onClick={clearFilters} className="text-xs text-bba-highlight hover:text-bba-highlight/80 underline underline-offset-2 transition-colors whitespace-nowrap">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2d8e8' }}>
        <div
          className="border-b px-5 py-3.5 flex items-center justify-between"
          style={{ backgroundColor: 'var(--bba-primary)', borderColor: 'rgba(78,0,142,0.2)' }}
        >
          <h3 className="text-sm font-semibold text-white">
            {filtered.length} Client{filtered.length !== 1 ? 's' : ''}{anyFilter ? ' — filtered' : ''}
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-medium text-white">Drag headers to reorder · click to sort</span>
            {anyFilter && (
              <button onClick={clearFilters} className="text-xs text-white/70 hover:text-white transition-colors">
                Clear filters ✕
              </button>
            )}
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <table className="w-full text-sm">
            <thead>
              <Droppable droppableId="columns" direction="horizontal">
                {(provided) => (
                  <tr
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{ backgroundColor: 'var(--bba-primary)', borderBottom: '1px solid rgba(78,0,142,0.3)' }}
                  >
                    {colOrder.map((colKey, index) => {
                      const col = ALL_COLUMNS.find(c => c.key === colKey)!
                      const alignCls = col.align === 'right' ? 'text-right' : 'text-left'
                      return (
                        <Draggable key={colKey} draggableId={colKey} index={index}>
                          {(provided, snapshot) => (
                            <th
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`px-4 py-3 ${alignCls} text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-opacity ${snapshot.isDragging ? 'opacity-50' : ''}`}
                              style={provided.draggableProps.style}
                            >
                              {col.sortKey ? (
                                <SortBtn k={col.sortKey}>{col.label}</SortBtn>
                              ) : (
                                <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{col.label}</span>
                              )}
                            </th>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                  </tr>
                )}
              </Droppable>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colOrder.length} className="px-4 py-12 text-center text-sm" style={{ color: '#8a6a90', backgroundColor: '#faf8f8' }}>
                    Loading clients…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colOrder.length} className="px-4 py-12 text-center text-sm" style={{ color: '#8a6a90', backgroundColor: '#faf8f8' }}>
                    {anyFilter
                      ? <><span>No clients match your filters. </span><button onClick={clearFilters} className="underline text-bba-highlight">Clear filters</button></>
                      : 'No active clients found. Click Add New Client to begin!'
                    }
                  </td>
                </tr>
              ) : filtered.map((client, idx) => {
                const baseBg = idx % 2 === 0 ? '#ffffff' : '#faf5ff'
                const rate      = clientRate(client.sows)
                const statusKey = deriveStatus(client)
                const pill      = STATUS_PILL[statusKey]
                const pt        = client.projectType ?? 'MONTHLY_MAINTENANCE'
                const ptStyle   = PTYPE_STYLE[pt] ?? PTYPE_STYLE.MONTHLY_MAINTENANCE
                const rt        = client.revenueType

                return (
                  <tr
                    key={client.id}
                    style={{ backgroundColor: baseBg, borderBottom: '1px solid #f0e8f8' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3e8ff' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}
                  >
                    {colOrder.map(colKey => {
                      switch (colKey) {
                        case 'name':
                          return (
                            <td key={colKey} className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: 'rgba(78,0,142,0.15)', color: '#4e008e' }}>
                                  {initials(client.name)}
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Link
                                    href={`/clients/${client.harvestProjectCode}`}
                                    className="font-semibold text-slate-900 hover:text-slate-900 whitespace-nowrap"
                                  >
                                    {client.name}
                                  </Link>
                                  <Link
                                    href={`/clients/${client.harvestProjectCode}`}
                                    className="shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                                    style={{ backgroundColor: 'rgba(78,0,142,0.08)', color: '#6a4c80', border: '1px solid rgba(78,0,142,0.2)' }}
                                    onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.backgroundColor = '#b20476'; el.style.color = '#fff' }}
                                    onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.backgroundColor = 'rgba(78,0,142,0.08)'; el.style.color = '#6a4c80' }}
                                  >
                                    Open
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </Link>
                                </div>
                              </div>
                            </td>
                          )
                        case 'code':
                          return (
                            <td key={colKey} className="px-4 py-3">
                              <span className="font-mono text-xs rounded px-1.5 py-0.5" style={{ backgroundColor: 'rgba(78,0,142,0.08)', color: '#4e008e' }}>
                                {client.harvestProjectCode}
                              </span>
                            </td>
                          )
                        case 'projectType':
                          return (
                            <td key={colKey} className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${ptStyle.bg} ${ptStyle.text}`}>
                                {ptStyle.label}
                              </span>
                            </td>
                          )
                        case 'revenueType':
                          return (
                            <td key={colKey} className="px-4 py-3">
                              {rt
                                ? <span className="text-xs whitespace-nowrap text-slate-700">{RTYPE_LABEL[rt] ?? rt}</span>
                                : <span className="text-xs text-slate-400">—</span>
                              }
                            </td>
                          )
                        case 'bookkeepingRate':
                          return (
                            <td key={colKey} className="px-4 py-3 text-right">
                              {rate != null
                                ? <span className="font-semibold tabular-nums text-slate-800">
                                    ${rate.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    <span className="text-xs ml-0.5 text-slate-500">{rate.suffix}</span>
                                  </span>
                                : <span className="text-xs text-slate-400">—</span>
                              }
                            </td>
                          )
                        case 'status':
                          return (
                            <td key={colKey} className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${pill.bg} ${pill.text} ${pill.ring}`}>
                                {pill.label}
                              </span>
                            </td>
                          )
                        default:
                          return <td key={colKey} />
                      }
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DragDropContext>
      </div>

      <AddClientPanel open={panelOpen} onClose={() => setPanelOpen(false)} onCreated={refetchClients} />
    </div>
  )
}
