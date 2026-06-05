'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { CLIENTS, TAGS, type Tag } from '@/lib/mock-data'

// ── Types ────────────────────────────────────────────────────────────────────
type Tab      = 'active' | 'archived'
type ColKey   = 'name' | 'code' | 'contact' | 'phone' | 'email' | 'address' | 'contractEnd' | 'status'
type SortKey  = 'name' | 'code' | 'contact'
type StatusKey = 'active' | 'archived' | 'inactive' | 'offboarding' | 'pendingArchive'

// ── Column definitions ────────────────────────────────────────────────────────
const ALL_COLS: { key: ColKey; label: string; sortKey?: SortKey }[] = [
  { key: 'name',        label: 'Business Name',   sortKey: 'name'    },
  { key: 'code',        label: 'Project Code',    sortKey: 'code'    },
  { key: 'contact',     label: 'Primary Contact', sortKey: 'contact' },
  { key: 'phone',       label: 'Phone' },
  { key: 'email',       label: 'Email' },
  { key: 'address',     label: 'Address' },
  { key: 'contractEnd', label: 'Contract End' },
  { key: 'status',      label: 'Status' },
]
const DEFAULT_COL_ORDER: ColKey[] = ALL_COLS.map(c => c.key)

// ── Status pill map (matches ClientDirectory exactly) ─────────────────────────
const STATUS_PILL: Record<StatusKey, { bg: string; text: string; ring: string; label: string }> = {
  active:         { bg: 'bg-bba-highlight/10', text: 'text-bba-highlight',   ring: 'ring-bba-highlight/20', label: 'Active'          },
  offboarding:    { bg: 'bg-amber-500/10',     text: 'text-amber-400',       ring: 'ring-amber-500/20',     label: 'Off-boarding'    },
  inactive:       { bg: 'bg-slate-700/40',     text: 'text-slate-400',       ring: 'ring-slate-600/40',     label: 'Inactive'        },
  archived:       { bg: 'bg-slate-700/50',     text: 'text-slate-500',       ring: 'ring-slate-600/50',     label: 'Archived'        },
  pendingArchive: { bg: 'bg-orange-500/10',    text: 'text-orange-400',      ring: 'ring-orange-500/20',    label: 'Pending Archive' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deriveStatus(client: typeof CLIENTS[0]): StatusKey {
  if (client.contractEndDate) {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const end = new Date(client.contractEndDate); end.setHours(0, 0, 0, 0)
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

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [tab,     setTab]    = useState<Tab>('active')
  const [search,  setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [tags,    setTags]   = useState<Tag[]>(TAGS)

  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COL_ORDER
    try {
      const saved = localStorage.getItem('cl-col-order-v1')
      if (saved) {
        const parsed = JSON.parse(saved) as ColKey[]
        if (parsed.length === DEFAULT_COL_ORDER.length && parsed.every(k => DEFAULT_COL_ORDER.includes(k as ColKey)))
          return parsed
      }
    } catch { /* ignore */ }
    return DEFAULT_COL_ORDER
  })

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.tags) && d.tags.length > 0) setTags(d.tags) })
      .catch(() => {})
  }, [])

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = Array.from(colOrder)
    const [removed] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, removed)
    setColOrder(next)
    localStorage.setItem('cl-col-order-v1', JSON.stringify(next))
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  const q = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    const list = CLIENTS.filter(c => {
      if (tab === 'active'   && c.archiveStatus !== 'ACTIVE')   return false
      if (tab === 'archived' && c.archiveStatus !== 'ARCHIVED') return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.harvestProjectCode.toLowerCase().includes(q) ||
        (c.primaryContact ?? '').toLowerCase().includes(q)
      )
    })
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')    cmp = a.name.localeCompare(b.name)
      if (sortKey === 'code')    cmp = a.harvestProjectCode.localeCompare(b.harvestProjectCode)
      if (sortKey === 'contact') cmp = (a.primaryContact ?? '').localeCompare(b.primaryContact ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [tab, q, sortKey, sortDir])

  const activeCount   = CLIENTS.filter(c => c.archiveStatus === 'ACTIVE').length
  const archivedCount = CLIENTS.filter(c => c.archiveStatus === 'ARCHIVED').length

  // SortBtn — nested component so it closes over sortKey/sortDir state
  function SortBtn({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const isActive = sortKey === k
    return (
      <button
        onClick={e => { e.stopPropagation(); toggleSort(k) }}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer select-none w-full"
      >
        <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{children}</span>
        <span className="text-[9px] opacity-60 shrink-0">
          {isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    )
  }

  // Cell renderer — closes over tab + tags state
  function renderCell(client: typeof CLIENTS[0], key: ColKey): React.ReactNode {
    const isArchived = tab === 'archived'
    const statusKey  = isArchived ? 'archived' : deriveStatus(client)
    const pill       = STATUS_PILL[statusKey]

    // Merge live tag colors from API over mock tag data
    const clientTags = (client.tags ?? []).map(ct => tags.find(t => t.id === ct.id) ?? ct)

    switch (key) {
      case 'name':
        return (
          <td key={key} className="px-4 py-3 min-w-[180px]">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {!isArchived && !client.qboOnly ? (
                  <Link
                    href={`/clients/${client.harvestProjectCode}`}
                    className="font-semibold text-white hover:text-bba-highlight transition-colors whitespace-nowrap"
                  >
                    {client.name}
                  </Link>
                ) : (
                  <span className={`font-semibold whitespace-nowrap ${isArchived ? 'text-white/45' : 'text-white'}`}>
                    {client.name}
                  </span>
                )}
                {client.qboOnly && (
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-sky-500/15 text-sky-400">
                    QBO
                  </span>
                )}
              </div>
              {clientTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {clientTags.map(tag => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${tag.color}18`,
                        color: isArchived ? `${tag.color}70` : tag.color,
                        boxShadow: `0 0 0 1px ${tag.color}${isArchived ? '30' : '45'}`,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </td>
        )

      case 'code':
        return (
          <td key={key} className="px-4 py-3">
            <span
              className="font-mono text-xs rounded px-1.5 py-0.5"
              style={{
                backgroundColor: 'rgba(212,190,190,0.08)',
                color: isArchived ? 'rgba(212,190,190,0.38)' : '#d4bebe',
              }}
            >
              {client.harvestProjectCode}
            </span>
          </td>
        )

      case 'contact':
        return (
          <td key={key} className="px-4 py-3 whitespace-nowrap text-sm"
            style={{ color: isArchived ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.82)' }}>
            {client.primaryContact ?? '—'}
          </td>
        )

      case 'phone':
        return (
          <td key={key} className="px-4 py-3 tabular-nums whitespace-nowrap text-sm"
            style={{ color: isArchived ? 'rgba(212,190,190,0.32)' : '#d4bebe' }}>
            {client.phone ?? '—'}
          </td>
        )

      case 'email':
        return (
          <td key={key} className="px-4 py-3 text-sm">
            {client.email && !isArchived ? (
              <a
                href={`mailto:${client.email}`}
                className="underline underline-offset-2 hover:opacity-70 transition-opacity whitespace-nowrap"
                style={{ color: '#d4bebe' }}
              >
                {client.email}
              </a>
            ) : (
              <span style={{ color: isArchived ? 'rgba(212,190,190,0.32)' : '#d4bebe' }}>
                {client.email ?? '—'}
              </span>
            )}
          </td>
        )

      case 'address':
        return (
          <td key={key} className="px-4 py-3 max-w-[220px] text-sm"
            style={{ color: isArchived ? 'rgba(212,190,190,0.26)' : 'rgba(212,190,190,0.62)' }}>
            <span className="block truncate" title={client.address ?? undefined}>
              {client.address ?? '—'}
            </span>
          </td>
        )

      case 'contractEnd':
        return (
          <td key={key} className="px-4 py-3 tabular-nums whitespace-nowrap text-sm"
            style={{ color: isArchived ? 'rgba(212,190,190,0.38)' : 'rgba(212,190,190,0.55)' }}>
            {fmtDate(client.contractEndDate)}
          </td>
        )

      case 'status':
        return (
          <td key={key} className="px-4 py-3">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${pill.bg} ${pill.text} ${pill.ring}`}>
              {pill.label}
            </span>
          </td>
        )

      default:
        return null
    }
  }

  // Per-tab background palette
  const BG_CARD     = tab === 'active' ? '#4e008e'  : '#2d0050'
  const BG_TABLE    = tab === 'active' ? '#2d0050'  : '#1e0038'
  const BG_THEAD    = tab === 'active' ? '#3d0070'  : '#260045'
  const ROW_ODD     = tab === 'active' ? '#2d0050'  : '#1e0038'
  const ROW_EVEN    = tab === 'active' ? '#330060'  : '#220040'
  const ROW_HOVER   = tab === 'active' ? '#4e008e'  : '#2d0050'

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Clients List</h1>
        <p className="mt-1 text-sm text-slate-400">
          {activeCount} active client{activeCount !== 1 ? 's' : ''} · {archivedCount} archived
        </p>
      </div>

      {/* ── Tab switcher + Search ── */}
      <div className="flex items-center gap-4 flex-wrap">

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: '#2d0050' }}>
          {([
            { id: 'active'   as Tab, label: 'Active Clients',   count: activeCount   },
            { id: 'archived' as Tab, label: 'Archived Clients', count: archivedCount },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
              style={{
                backgroundColor: tab === t.id ? '#4e008e' : 'transparent',
                color:           tab === t.id ? '#ffffff' : 'rgba(255,255,255,0.45)',
              }}
            >
              {t.label}
              <span
                className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: tab === t.id ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)',
                  color:           tab === t.id ? '#d4bebe' : 'rgba(255,255,255,0.3)',
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[260px] max-w-sm">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'rgba(212,190,190,0.5)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, code, or contact…"
            className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-bba-highlight focus:border-transparent border"
            style={{ backgroundColor: '#4e008e', borderColor: 'rgba(212,190,190,0.25)', colorScheme: 'dark' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
              style={{ color: 'rgba(212,190,190,0.5)' }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(212,190,190,0.18)' }}>

        {/* Card header bar */}
        <div
          className="border-b px-5 py-3.5 flex items-center justify-between"
          style={{ borderColor: 'rgba(212,190,190,0.18)', backgroundColor: BG_CARD }}
        >
          <h3 className="text-sm font-semibold text-white">
            {tab === 'active' ? 'Active Clients' : 'Archived Clients Vault'}
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-medium text-white">
              Drag headers to reorder · click to sort
            </span>
            <span className="text-xs tabular-nums" style={{ color: 'rgba(212,190,190,0.65)' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Scrollable table region */}
        <div className="overflow-x-auto" style={{ backgroundColor: BG_TABLE }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <table className="w-full text-sm">

              {/* ── Draggable thead ── */}
              <Droppable droppableId="cl-cols" direction="horizontal">
                {(dp) => (
                  <thead>
                    <tr
                      ref={dp.innerRef}
                      {...dp.droppableProps}
                      style={{ backgroundColor: BG_THEAD, borderBottom: '1px solid rgba(212,190,190,0.13)' }}
                    >
                      {colOrder.map((key, idx) => {
                        const col = ALL_COLS.find(c => c.key === key)!
                        return (
                          <Draggable key={key} draggableId={key} index={idx}>
                            {(dragP, snap) => (
                              <th
                                ref={dragP.innerRef}
                                {...dragP.draggableProps}
                                {...dragP.dragHandleProps}
                                className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-opacity ${snap.isDragging ? 'opacity-50' : ''}`}
                                style={dragP.draggableProps.style}
                              >
                                {col.sortKey
                                  ? <SortBtn k={col.sortKey}>{col.label}</SortBtn>
                                  : <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{col.label}</span>
                                }
                              </th>
                            )}
                          </Draggable>
                        )
                      })}
                      {/* Placeholder wrapper keeps HTML valid inside <tr> */}
                      <th style={{ padding: 0, border: 'none' }}>{dp.placeholder}</th>
                      {/* Non-draggable action column — active tab only */}
                      {tab === 'active' && <th className="px-4 py-3 w-28" />}
                    </tr>
                  </thead>
                )}
              </Droppable>

              {/* ── Body ── */}
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={colOrder.length + (tab === 'active' ? 2 : 1)}
                      className="px-5 py-12 text-center text-sm"
                      style={{ color: 'rgba(212,190,190,0.38)' }}
                    >
                      {search ? 'No clients match your search.' : `No ${tab} clients.`}
                    </td>
                  </tr>
                ) : filtered.map((client, i) => {
                  const baseBg = i % 2 === 0 ? ROW_ODD : ROW_EVEN
                  return (
                    <tr
                      key={client.id}
                      style={{ backgroundColor: baseBg, borderBottom: '1px solid rgba(212,190,190,0.07)' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = ROW_HOVER }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = baseBg }}
                    >
                      {colOrder.map(key => renderCell(client, key))}
                      {/* Action button — active tab only */}
                      {tab === 'active' && (
                        <td className="px-4 py-3 text-right">
                          {!client.qboOnly && (
                            <Link
                              href={`/clients/${client.harvestProjectCode}`}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap"
                              style={{
                                backgroundColor: 'rgba(212,190,190,0.08)',
                                color: '#d4bebe',
                                border: '1px solid rgba(212,190,190,0.16)',
                              }}
                              onMouseEnter={e => {
                                const el = e.currentTarget as HTMLAnchorElement
                                el.style.backgroundColor = '#b20476'
                                el.style.color = '#ffffff'
                                el.style.border = '1px solid #b20476'
                              }}
                              onMouseLeave={e => {
                                const el = e.currentTarget as HTMLAnchorElement
                                el.style.backgroundColor = 'rgba(212,190,190,0.08)'
                                el.style.color = '#d4bebe'
                                el.style.border = '1px solid rgba(212,190,190,0.16)'
                              }}
                            >
                              ⚙️ Open
                            </Link>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DragDropContext>
        </div>
      </div>
    </div>
  )
}
