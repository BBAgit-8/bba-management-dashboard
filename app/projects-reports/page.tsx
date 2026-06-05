'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { CLIENTS, SOWS } from '@/lib/mock-data'
import type { Client, ProjectType, RevenueType, EntityType } from '@/lib/mock-data'

// ── Option lists ──────────────────────────────────────────────────────────────
const PROJECT_OPTS: { value: ProjectType; label: string }[] = [
  { value: 'ANNUAL',              label: 'Annual'               },
  { value: 'CLEAN_UP',            label: 'Clean Up'             },
  { value: 'MONTHLY_MAINTENANCE', label: 'Monthly Maintenance'  },
  { value: 'QBO_ONLY',            label: 'QBO Only'             },
  { value: 'RECURRING',           label: 'Recurring'            },
]
const REVENUE_OPTS: { value: RevenueType; label: string }[] = [
  { value: 'CLEANUP',                    label: 'Cleanup'                      },
  { value: 'FREE',                       label: 'Free'                         },
  { value: 'HOURLY_CLEANUP',             label: 'Hourly Cleanup'               },
  { value: 'QBO_ONLY_ANCHOR',            label: 'QBO only - Anchor'            },
  { value: 'QBO_ONLY_QBO',               label: 'QBO only - QBO'               },
  { value: 'RECURRING_MONTHLY_ACH',      label: 'Recurring Monthly - ACH'      },
  { value: 'RECURRING_MONTHLY_HOURLY',   label: 'Recurring Monthly - Hourly'   },
  { value: 'RECURRING_MONTHLY_INVOICED', label: 'Recurring Monthly - Invoiced' },
]
const ENTITY_OPTS: { value: EntityType; label: string }[] = [
  { value: 'LLC',             label: 'LLC'             },
  { value: 'S_CORP',          label: 'S-Corp'          },
  { value: 'C_CORP',          label: 'C-Corp'          },
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'PARTNERSHIP',     label: 'Partnership'     },
  { value: 'NON_PROFIT',      label: 'Non-Profit'      },
  { value: 'OTHER',           label: 'Other'           },
]

// ── Column definitions ────────────────────────────────────────────────────────
type ColKey = 'name' | 'projectType' | 'revenueType' | 'contractStart' | 'contractEnd' | 'entity' | 'bkRate' | 'swRate' | 'total' | 'deadline' | 'loom' | 'meetings' | 'autoIncrease'
type SortKey = 'name' | 'projectType' | 'revenueType' | 'contractEnd' | 'total'

const COL_META: { key: ColKey; label: string; sortKey?: SortKey; minWidth?: number; align?: 'right' | 'center' }[] = [
  { key: 'name',          label: 'Business Name',  sortKey: 'name',        minWidth: 200 },
  { key: 'projectType',   label: 'Project Type',   sortKey: 'projectType', minWidth: 150 },
  { key: 'revenueType',   label: 'Revenue Type',   sortKey: 'revenueType', minWidth: 175 },
  { key: 'contractStart', label: 'Start Date',                             minWidth: 135 },
  { key: 'contractEnd',   label: 'End Date',       sortKey: 'contractEnd', minWidth: 135 },
  { key: 'entity',        label: 'Entity',                                 minWidth: 125 },
  { key: 'bkRate',        label: 'BK Rate',        sortKey: undefined,     minWidth: 90,  align: 'right'  },
  { key: 'swRate',        label: 'SW Rate',                                minWidth: 100, align: 'right'  },
  { key: 'total',         label: 'Total/Mo',       sortKey: 'total',       minWidth: 110, align: 'right'  },
  { key: 'deadline',      label: 'Deadline',                               minWidth: 80,  align: 'center' },
  { key: 'loom',          label: 'Loom',                                   minWidth: 55,  align: 'center' },
  { key: 'meetings',      label: 'Meetings',                               minWidth: 65,  align: 'center' },
  { key: 'autoIncrease',  label: 'Auto ↑',                                 minWidth: 65,  align: 'center' },
]
const DEFAULT_COL_ORDER: ColKey[] = COL_META.map(c => c.key)

// ── Helpers ───────────────────────────────────────────────────────────────────
type StatusKey = 'active' | 'offboarding' | 'inactive'

function deriveStatus(archiveStatus: string, contractEndDate?: string): StatusKey {
  if (contractEndDate) {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const end = new Date(contractEndDate); end.setHours(0, 0, 0, 0)
    return end <= now ? 'inactive' : 'offboarding'
  }
  if (archiveStatus === 'INACTIVE')    return 'inactive'
  if (archiveStatus === 'OFF_BOARDING') return 'offboarding'
  return 'active'
}

function clientBkRate(clientId: string): number {
  const sow = SOWS.find(s => s.clientId === clientId)
  if (!sow) return 0
  return sow.billingType === 'FLAT' ? (sow.fixedMonthlyRate ?? 0) : (sow.targetHours ?? 0) * (sow.billingRate ?? 0)
}

function fmtUSD(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// ── Shared cell styles — match dashboard BBA token set ────────────────────────
const iCls = 'w-full rounded bg-[#4e008e] border border-bba-secondary/25 px-1.5 py-1 text-xs text-white placeholder-white/35 focus:outline-none focus:ring-1 focus:ring-bba-highlight focus:border-transparent'
const sCls = iCls + ' [color-scheme:dark]'
const dCls = iCls + ' [color-scheme:dark]'

// ── Status chip styles ────────────────────────────────────────────────────────
type Edits = Record<string, Record<string, unknown>>

const STATUS_CHIP: Record<StatusKey | 'all', string> = {
  all:         'bg-white/10 text-white/70 border-white/20',
  active:      'bg-[#b20476]/15 text-[#f060c0] border-[#b20476]/40',
  offboarding: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  inactive:    'bg-white/5 text-white/40 border-white/15',
}
const STATUS_LABEL: Record<StatusKey, string> = {
  active: 'Active', offboarding: 'Off-boarding', inactive: 'Inactive',
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProjectsReportsPage() {
  const [edits,        setEdits]        = useState<Edits>({})
  const [saving,       setSaving]       = useState<Record<string, boolean>>({})
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'all'>('all')
  const [ptFilter,     setPtFilter]     = useState<string>('all')
  const [sortKey,      setSortKey]      = useState<SortKey>('name')
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc')
  const [colOrder,     setColOrder]     = useState<ColKey[]>(DEFAULT_COL_ORDER)

  // ── Background lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const toInactivate = CLIENTS.filter(c => {
      if (!c.contractEndDate) return false
      const end = new Date(c.contractEndDate); end.setHours(0, 0, 0, 0)
      return end <= today && c.archiveStatus !== 'INACTIVE' && c.archiveStatus !== 'ARCHIVED'
    })
    if (toInactivate.length === 0) return
    setEdits(prev => {
      const next = { ...prev }
      toInactivate.forEach(c => { next[c.id] = { ...next[c.id], archiveStatus: 'INACTIVE' } })
      return next
    })
    toInactivate.forEach(c => {
      fetch(`/api/clients/${c.harvestProjectCode}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveStatus: 'INACTIVE' }),
      }).catch(() => {})
    })
  }, [])

  const patchClient = useCallback(
    async (code: string, id: string, field: string, value: unknown) => {
      setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
      setSaving(prev => ({ ...prev, [id]: true }))
      try {
        await fetch(`/api/clients/${code}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
      } catch { /* best-effort */ }
      finally { setSaving(prev => ({ ...prev, [id]: false })) }
    }, []
  )

  const allRows = useMemo(() =>
    CLIENTS
      .filter(c => c.archiveStatus !== 'ARCHIVED')
      .map(c => {
        const e = edits[c.id] ?? {}
        const g = (k: keyof Client) => (k in e ? e[k as string] : c[k])
        const archiveStatus   = String(g('archiveStatus') ?? c.archiveStatus)
        const contractEndDate = String(g('contractEndDate') ?? c.contractEndDate ?? '')
        const status          = deriveStatus(archiveStatus, contractEndDate || undefined)
        const bkRate          = clientBkRate(c.id)
        const swRate          = parseFloat(String(g('softwareRate') ?? c.softwareRate ?? 0)) || 0
        const totalOverride   = parseFloat(String(g('totalMonthlyAmount') ?? c.totalMonthlyAmount ?? 0))
        const total           = totalOverride > 0 ? totalOverride : bkRate + swRate
        return { c, e, g, status, bkRate, swRate, total, archiveStatus, contractEndDate }
      }),
  [edits])

  const filtered = useMemo(() => {
    let rows = allRows
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter)
    if (ptFilter !== 'all')     rows = rows.filter(r => String(r.g('projectType') ?? r.c.projectType ?? '') === ptFilter)
    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter(r => r.c.name.toLowerCase().includes(q) || r.c.harvestProjectCode.toLowerCase().includes(q))
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name')        cmp = a.c.name.localeCompare(b.c.name)
      if (sortKey === 'projectType') cmp = String(a.g('projectType') ?? '').localeCompare(String(b.g('projectType') ?? ''))
      if (sortKey === 'revenueType') cmp = String(a.g('revenueType') ?? '').localeCompare(String(b.g('revenueType') ?? ''))
      if (sortKey === 'contractEnd') cmp = (a.contractEndDate || 'zzz').localeCompare(b.contractEndDate || 'zzz')
      if (sortKey === 'total')       cmp = a.total - b.total
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [allRows, statusFilter, ptFilter, search, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = Array.from(colOrder)
    const [removed] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, removed)
    setColOrder(next)
  }

  const counts = useMemo(() => {
    const s: Record<string, number> = { all: allRows.length, active: 0, offboarding: 0, inactive: 0 }
    allRows.forEach(r => s[r.status] = (s[r.status] ?? 0) + 1)
    return s
  }, [allRows])

  function SortArrow({ k }: { k: SortKey }) {
    return (
      <span className="ml-0.5 text-[9px] opacity-50">
        {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    )
  }

  // ── Cell renderer ─────────────────────────────────────────────────────────
  type RowData = typeof filtered[0]

  function renderCell(row: RowData, key: ColKey): React.ReactNode {
    const { c, g, status, bkRate, swRate, total } = row
    const isSaving = !!saving[c.id]
    const str  = (k: keyof Client) => String(g(k) ?? '')
    const bool = (k: keyof Client) => Boolean(k in row.e ? row.e[k as string] : c[k])
    const colDef = COL_META.find(m => m.key === key)!
    const minW = colDef.minWidth ? { minWidth: `${colDef.minWidth}px` } : {}

    switch (key) {
      case 'name':
        return (
          <td key={key} className="px-3 py-2.5" style={minW}>
            <div className="flex items-center gap-2">
              {status !== 'active' && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: status === 'offboarding' ? '#f59e0b' : '#64748b' }} title={status === 'offboarding' ? 'Off-boarding' : 'Inactive'} />
              )}
              <Link href={`/clients/${c.harvestProjectCode}`} className="font-semibold text-white/90 hover:text-[#f060c0] transition-colors truncate">
                {c.name}
              </Link>
              {isSaving && <span className="ml-1 text-[9px] text-[#b20476] animate-pulse">saving…</span>}
            </div>
            <span className="font-mono text-[9px] text-white/30">{c.harvestProjectCode}</span>
          </td>
        )
      case 'projectType':
        return (
          <td key={key} className="px-2 py-2" style={minW}>
            <select value={str('projectType') || 'MONTHLY_MAINTENANCE'} onChange={ev => patchClient(c.harvestProjectCode, c.id, 'projectType', ev.target.value)} className={sCls}>
              {PROJECT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </td>
        )
      case 'revenueType':
        return (
          <td key={key} className="px-2 py-2" style={minW}>
            <select value={str('revenueType')} onChange={ev => patchClient(c.harvestProjectCode, c.id, 'revenueType', ev.target.value)} className={sCls}>
              <option value="">— Select —</option>
              {REVENUE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </td>
        )
      case 'contractStart':
        return (
          <td key={key} className="px-2 py-2" style={minW}>
            <input type="date" value={str('contractStartDate')}
              onBlur={ev => patchClient(c.harvestProjectCode, c.id, 'contractStartDate', ev.target.value || null)}
              onChange={ev => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], contractStartDate: ev.target.value } }))}
              className={dCls} />
          </td>
        )
      case 'contractEnd':
        return (
          <td key={key} className="px-2 py-2" style={minW}>
            <input type="date" value={str('contractEndDate')}
              onBlur={ev => patchClient(c.harvestProjectCode, c.id, 'contractEndDate', ev.target.value || null)}
              onChange={ev => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], contractEndDate: ev.target.value } }))}
              className={dCls}
              style={{ color: status === 'offboarding' ? '#f59e0b' : status === 'inactive' ? '#64748b' : undefined }} />
          </td>
        )
      case 'entity':
        return (
          <td key={key} className="px-2 py-2" style={minW}>
            <select value={str('entityType') || 'LLC'} onChange={ev => patchClient(c.harvestProjectCode, c.id, 'entityType', ev.target.value)} className={sCls}>
              {ENTITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </td>
        )
      case 'bkRate':
        return (
          <td key={key} className="px-3 py-2.5 text-right tabular-nums" style={minW}>
            {bkRate > 0 ? <span className="text-white/70">${fmtUSD(bkRate)}</span> : <span className="text-white/25">—</span>}
          </td>
        )
      case 'swRate':
        return (
          <td key={key} className="px-2 py-2" style={minW}>
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/40">$</span>
              <input type="number" min={0} step={0.01}
                value={String(g('softwareRate') ?? c.softwareRate ?? '')}
                onBlur={ev => patchClient(c.harvestProjectCode, c.id, 'softwareRate', parseFloat(ev.target.value) || 0)}
                onChange={ev => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], softwareRate: ev.target.value } }))}
                placeholder="0" className={iCls + ' pl-5 tabular-nums'} />
            </div>
          </td>
        )
      case 'total':
        return (
          <td key={key} className="px-2 py-2" style={minW}>
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/40">$</span>
              <input type="number" min={0} step={0.01}
                value={String(g('totalMonthlyAmount') ?? c.totalMonthlyAmount ?? '')}
                placeholder={total > 0 ? fmtUSD(total) : '0'}
                onBlur={ev => patchClient(c.harvestProjectCode, c.id, 'totalMonthlyAmount', parseFloat(ev.target.value) || null)}
                onChange={ev => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], totalMonthlyAmount: ev.target.value } }))}
                className={iCls + ' pl-5 tabular-nums'} title={`Auto-calculated: $${fmtUSD(bkRate)} BK + $${fmtUSD(swRate)} SW`} />
            </div>
            {total > 0 && !(g('totalMonthlyAmount') ?? c.totalMonthlyAmount) && (
              <p className="mt-0.5 text-[9px] text-white/30 tabular-nums">≈ ${fmtUSD(total)}</p>
            )}
          </td>
        )
      case 'deadline':
        return (
          <td key={key} className="px-2 py-2 text-center" style={minW}>
            <input type="number" min={1} max={31}
              value={String(g('guaranteedDeadlineDay') ?? c.guaranteedDeadlineDay ?? '')}
              placeholder="—"
              onBlur={ev => patchClient(c.harvestProjectCode, c.id, 'guaranteedDeadlineDay', parseInt(ev.target.value) || null)}
              onChange={ev => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], guaranteedDeadlineDay: ev.target.value } }))}
              className={iCls + ' text-center'} />
          </td>
        )
      case 'loom':
        return (
          <td key={key} className="px-2 py-2 text-center" style={minW}>
            <input type="checkbox" checked={bool('hasContractedLoom')}
              onChange={ev => patchClient(c.harvestProjectCode, c.id, 'hasContractedLoom', ev.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-[#b20476]" title="Contracted Loom Video" />
          </td>
        )
      case 'meetings':
        return (
          <td key={key} className="px-2 py-2 text-center" style={minW}>
            <input type="checkbox" checked={bool('hasScheduledMeetings')}
              onChange={ev => patchClient(c.harvestProjectCode, c.id, 'hasScheduledMeetings', ev.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-[#b20476]" title="Scheduled Meetings" />
          </td>
        )
      case 'autoIncrease':
        return (
          <td key={key} className="px-2 py-2 text-center" style={minW}>
            <input type="checkbox" checked={bool('hasSignedAutoIncrease')}
              onChange={ev => patchClient(c.harvestProjectCode, c.id, 'hasSignedAutoIncrease', ev.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-[#b20476]" title="Signed Auto Annual Increase" />
          </td>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects &amp; Reports</h1>
          <p className="mt-1 text-sm text-slate-400">
            {allRows.length} project{allRows.length !== 1 ? 's' : ''} · inline-editable compliance grid
          </p>
        </div>
        <button
          className="inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-bba-primary hover:text-white"
          style={{ border: '1px solid rgba(212,190,190,0.3)', backgroundColor: '#2d0050', color: '#d4bebe' }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'active', 'offboarding', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${statusFilter === s ? STATUS_CHIP[s] + ' ring-1 ring-current' : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'}`}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]} ({counts[s] ?? 0})
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-white/15" />
          <select value={ptFilter} onChange={e => setPtFilter(e.target.value)}
            className="rounded-lg border border-bba-secondary/30 bg-[#4e008e] px-3 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-bba-highlight [color-scheme:dark]">
            <option value="all">All Project Types</option>
            {PROJECT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'rgba(212,190,190,0.5)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by client name or project code…"
            className="w-full rounded-lg border border-bba-secondary/30 bg-[#4e008e] py-2.5 pl-9 pr-4 text-sm text-white placeholder-white/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-bba-highlight"
            style={{ colorScheme: 'dark' }} />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl" style={{ border: '1px solid rgba(212,190,190,0.18)' }}>

        <div className="border-b px-5 py-3.5 flex items-center justify-between" style={{ borderColor: 'rgba(112,32,184,0.4)', backgroundColor: '#4e008e' }}>
          <h3 className="text-sm font-bold text-white">
            {filtered.length} Project{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' || ptFilter !== 'all' || search ? ' — filtered' : ''}
          </h3>
          <span className="text-[10px] font-medium text-white">Drag headers to reorder · click to sort</span>
        </div>

        <div className="overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <table className="w-full text-xs" style={{ minWidth: '1420px' }}>
              <Droppable droppableId="pr-cols" direction="horizontal">
                {(dp) => (
                  <thead>
                    <tr
                      ref={dp.innerRef}
                      {...dp.droppableProps}
                      style={{ backgroundColor: '#3d0070', borderBottom: '1px solid rgba(212,190,190,0.13)' }}
                    >
                      {colOrder.map((key, idx) => {
                        const col = COL_META.find(c => c.key === key)!
                        const alignCls = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        return (
                          <Draggable key={key} draggableId={key} index={idx}>
                            {(dragP, snap) => (
                              <th
                                ref={dragP.innerRef}
                                {...dragP.draggableProps}
                                {...dragP.dragHandleProps}
                                className={`cursor-grab active:cursor-grabbing select-none whitespace-nowrap px-3 py-3 ${alignCls} text-[10px] font-bold uppercase tracking-wider transition-opacity ${snap.isDragging ? 'opacity-50' : ''}`}
                                style={dragP.draggableProps.style}
                              >
                                {col.sortKey ? (
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleSort(col.sortKey as SortKey) }}
                                    className="flex items-center gap-1 hover:opacity-80 cursor-pointer w-full"
                                  >
                                    <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{col.label}</span>
                                    <SortArrow k={col.sortKey as SortKey} />
                                  </button>
                                ) : (
                                  <span className="uppercase tracking-wider font-bold text-white block w-full text-center">{col.label}</span>
                                )}
                              </th>
                            )}
                          </Draggable>
                        )
                      })}
                      <th style={{ padding: 0, border: 'none' }}>{dp.placeholder}</th>
                    </tr>
                  </thead>
                )}
              </Droppable>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={colOrder.length + 1} className="px-4 py-12 text-center" style={{ backgroundColor: '#2d0050', color: 'rgba(212,190,190,0.45)' }}>
                      No projects match your filters.
                    </td>
                  </tr>
                ) : filtered.map(({ c, e, g, status, bkRate, swRate, total }, i) => {
                  const isSaving   = !!saving[c.id]
                  const rowBg      = isSaving ? '#4e008e' : status === 'inactive' ? (i % 2 === 0 ? '#1e0038' : '#220040') : status === 'offboarding' ? (i % 2 === 0 ? '#1a1200' : '#251800') : (i % 2 === 0 ? '#2d0050' : '#330060')
                  const rowOpacity = status === 'inactive' ? 0.65 : 1
                  const row        = filtered[i]
                  return (
                    <tr key={c.id} style={{ backgroundColor: rowBg, opacity: rowOpacity, borderBottom: '1px solid rgba(212,190,190,0.07)' }} className="transition-colors hover:brightness-125">
                      {colOrder.map(key => renderCell(row, key))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DragDropContext>
        </div>

        {/* Legend */}
        <div
          className="flex items-center gap-5 px-5 py-2.5"
          style={{ backgroundColor: '#2d0050', borderTop: '1px solid rgba(212,190,190,0.1)' }}
        >
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(212,190,190,0.45)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" /> Off-boarding (future end date)
          </div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'rgba(212,190,190,0.45)' }}>
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: 'rgba(212,190,190,0.35)' }} /> Inactive (auto-set when end date passes)
          </div>
          <p className="ml-auto text-[10px]" style={{ color: 'rgba(212,190,190,0.3)' }}>
            Text fields save on blur · Dropdowns &amp; checkboxes save instantly
          </p>
        </div>
      </div>
    </div>
  )
}
