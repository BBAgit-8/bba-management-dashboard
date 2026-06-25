'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { broadcastBookkeeperChange, useBookkeeperSync } from '@/app/hooks/useBookkeeperSync'

type Tag = { id: string; name: string; color: string }
type ProcessingCadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY'
type ProjectType = 'ANNUAL' | 'CLEAN_UP' | 'MONTHLY_MAINTENANCE' | 'QBO_ONLY' | 'RECURRING'

type ApiClient = {
  id: string
  name: string
  harvestProjectCode: string
  archiveStatus: string
  processingCadence: string
  contractEndDate?: string | null
  contractStartDate?: string | null
  contractedCloseDate?: string | null
  projectType?: string | null
  revenueType?: string | null
  entityType?: string | null
  qboOnly?: boolean
  bookkeeper?: string | null          // from employees join
  clientGroupName?: string | null
  doubleId?: string | null
  qboId?: string | null
  clickUpId?: string | null
  clientContactName?: string | null
  softwareRate?: number | null
  totalMonthlyAmount?: number | null
  bookkeepingRate?: number | null
  totalHrsPerMonth?: number | null
  apArHrs?: number | null
  qaHours?: number | null
  custSuccessMgmtHrs?: number | null
  yeOrTaxHours?: number | null
  auditHours?: number | null
  bkprHours?: number | null
  bankFeedTime?: number | null
  transactionsPerMonth?: number | null
  recTime?: number | null
  numBanksAndCCs?: number | null
  numLoans?: number | null
  numPmtPortals?: number | null
  pettyCash?: boolean | null
  referredBy?: string | null
  hasContractedLoom?: boolean | null
  hasScheduledMeetings?: boolean | null
  hasSignedAutoIncrease?: boolean | null
  autoPriceIncreasePercent?: number | null
  priceAdjustmentDate?: string | null
  accountantName?: string | null
  guaranteedDeadlineDay?: number | null
  tags: Tag[]
  sows: Array<{ billingType: string; fixedMonthlyRate?: number | null; billingRate?: number | null; targetHours?: number | null }>
}

import AddClientPanel from './AddClientPanel'

// ── Column definitions ────────────────────────────────────────────────────────
type ColKey =
  | 'name' | 'code' | 'projectType' | 'revenueType' | 'bookkeepingRate' | 'status'
  | 'bookkeeper' | 'entityType' | 'monthlyBilling' | 'contractStartDate' | 'contractEndDate'
  | 'clientGroupName' | 'doubleId' | 'qboId' | 'clickUpId' | 'clientContactName'
  | 'contractedCloseDate' | 'softwareRate' | 'totalHrsPerMonth' | 'apArHrs'
  | 'qaHours' | 'custSuccessMgmtHrs' | 'yeOrTaxHours' | 'auditHours' | 'bkprHours'
  | 'bankFeedTime' | 'transactionsPerMonth' | 'recTime' | 'numBanksAndCCs'
  | 'numLoans' | 'numPmtPortals' | 'pettyCash' | 'referredBy'
  | 'guaranteedDeadlineDay' | 'hasContractedLoom' | 'hasScheduledMeetings'
  | 'hasSignedAutoIncrease' | 'autoPriceIncreasePercent' | 'accountantName'

type SortKey = ColKey

type StatusKey = 'active' | 'archived' | 'inactive' | 'offboarding' | 'pendingArchive'
type StatusFilter = StatusKey | 'all'

const ALL_COLUMNS: { key: ColKey; label: string; defaultVisible: boolean; align?: 'right' | 'center' }[] = [
  // ── Default visible — exact order from spec ────────────────────────────────
  { key: 'name',               label: 'Client Name',              defaultVisible: true  },
  { key: 'clientGroupName',    label: 'Client Group Name',        defaultVisible: false },
  { key: 'code',               label: 'Project Code',             defaultVisible: true  },
  { key: 'clientContactName',  label: 'Client Contact Name',      defaultVisible: false },
  { key: 'projectType',        label: 'Recurring or Cleanup',     defaultVisible: true  },
  { key: 'contractStartDate',  label: 'Contract Start Date',      defaultVisible: false },
  { key: 'contractEndDate',    label: 'End Date / Archive',       defaultVisible: false },
  { key: 'entityType',         label: 'Entity Type',              defaultVisible: true  },
  { key: 'revenueType',        label: 'Rev Type',                 defaultVisible: true  },
  { key: 'bookkeepingRate',    label: 'Bookkeeping Rate',         defaultVisible: true,  align: 'right' },
  { key: 'softwareRate',       label: 'Software Rate',            defaultVisible: true,  align: 'right' },
  { key: 'monthlyBilling',     label: 'Monthly Billing',          defaultVisible: true,  align: 'right' },
  { key: 'totalHrsPerMonth',   label: 'Total Hrs/Mo',             defaultVisible: true,  align: 'right' },
  { key: 'apArHrs',            label: 'AP Hours',                 defaultVisible: false, align: 'right' },
  { key: 'qaHours',            label: 'QA Hours',                 defaultVisible: false, align: 'right' },
  { key: 'custSuccessMgmtHrs', label: 'Cust Success / Mgmt Hrs', defaultVisible: false, align: 'right' },
  { key: 'yeOrTaxHours',       label: 'YE / 1099 Hours',         defaultVisible: false, align: 'right' },
  { key: 'auditHours',         label: 'Audit Hours',              defaultVisible: false, align: 'right' },
  { key: 'bkprHours',          label: 'Bkpr Hours',              defaultVisible: true,  align: 'right' },
  { key: 'bankFeedTime',       label: 'Bank Feed Time',           defaultVisible: false, align: 'right' },
  { key: 'transactionsPerMonth',label: '# Transactions/Mo',      defaultVisible: false, align: 'right' },
  { key: 'recTime',            label: 'Rec Time',                 defaultVisible: false, align: 'right' },
  { key: 'numBanksAndCCs',     label: '# Banks & CCs',           defaultVisible: false, align: 'right' },
  { key: 'numLoans',           label: '# Loans',                  defaultVisible: false, align: 'right' },
  { key: 'numPmtPortals',      label: '# Pmt Portals',           defaultVisible: false, align: 'right' },
  { key: 'pettyCash',          label: 'Petty Cash',               defaultVisible: false, align: 'center' },
  { key: 'referredBy',         label: 'Referred By',              defaultVisible: true  },
  { key: 'bookkeeper',         label: 'Bookkeeper',               defaultVisible: true  },
  // ── Hidden — available in Show Columns ─────────────────────────────────────
  { key: 'status',             label: 'Status',                   defaultVisible: false },
  { key: 'contractedCloseDate',label: 'Contracted Close Date',    defaultVisible: false },
  { key: 'doubleId',           label: 'Double ID',                defaultVisible: false },
  { key: 'qboId',              label: 'QBO ID',                   defaultVisible: false },
  { key: 'clickUpId',          label: 'ClickUp ID',               defaultVisible: false },
  { key: 'guaranteedDeadlineDay', label: 'Deadline Day',          defaultVisible: false, align: 'center' as const },
  { key: 'hasContractedLoom',     label: 'Loom',                  defaultVisible: false, align: 'center' as const },
  { key: 'hasScheduledMeetings',  label: 'Meetings',              defaultVisible: false, align: 'center' as const },
  { key: 'hasSignedAutoIncrease', label: 'Auto Increase',         defaultVisible: false, align: 'center' as const },
  { key: 'autoPriceIncreasePercent', label: 'Auto Increase %',    defaultVisible: false, align: 'right'  as const },
  { key: 'accountantName',        label: 'Accountant',            defaultVisible: false },
]

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
const ALL_COL_KEYS = ALL_COLUMNS.map(c => c.key)
const STORAGE_VISIBLE = 'cd-visible-cols-v5'  // bumped — resets saved prefs
const STORAGE_ORDER   = 'cd-col-order-v5'     // bumped

// ── Style maps ────────────────────────────────────────────────────────────────
const dropSel = 'rounded-lg bg-white border border-surface-border px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-primary'

const PTYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ANNUAL:              { bg: 'bg-blue-500/15',    text: 'text-blue-600',      label: 'Annual'      },
  CLEAN_UP:            { bg: 'bg-orange-500/15',  text: 'text-orange-600',    label: 'Cleanup'     },
  MONTHLY_MAINTENANCE: { bg: 'bg-purple-500/15',  text: 'text-purple-700',    label: 'Recurring'   },
  QBO_ONLY:            { bg: 'bg-sky-500/15',     text: 'text-sky-600',       label: 'QBO Only'    },
  RECURRING:           { bg: 'bg-teal-500/15',    text: 'text-teal-600',      label: 'Recurring'   },
}

const RTYPE_LABEL: Record<string, string> = {
  CLEANUP:                    'Cleanup',
  FREE:                       'Free',
  HOURLY_CLEANUP:             'Hourly Cleanup',
  QBO_ONLY_ANCHOR:            'QBO - Anchor',
  QBO_ONLY_QBO:               'QBO - QBO',
  RECURRING_MONTHLY_ACH:      'Monthly - ACH',
  RECURRING_MONTHLY_HOURLY:   'Monthly - Hourly',
  RECURRING_MONTHLY_INVOICED: 'Monthly - Invoiced',
}

const STATUS_PILL: Record<StatusKey, { bg: string; text: string; ring: string; label: string }> = {
  active:         { bg: 'bg-green-500/10',  text: 'text-green-700',  ring: 'ring-green-500/20',  label: 'Active'          },
  offboarding:    { bg: 'bg-amber-500/10',  text: 'text-amber-700',  ring: 'ring-amber-500/20',  label: 'Off-boarding'    },
  inactive:       { bg: 'bg-slate-200',     text: 'text-slate-500',  ring: 'ring-slate-300',     label: 'Inactive'        },
  archived:       { bg: 'bg-slate-200',     text: 'text-slate-400',  ring: 'ring-slate-300',     label: 'Archived'        },
  pendingArchive: { bg: 'bg-orange-500/10', text: 'text-orange-600', ring: 'ring-orange-500/20', label: 'Pending Archive' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deriveStatus(client: ApiClient): StatusKey {
  if (client.contractEndDate) {
    const now = new Date(); now.setHours(0,0,0,0)
    const end = new Date(client.contractEndDate); end.setHours(0,0,0,0)
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

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return '—'
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtNum(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Excel export ──────────────────────────────────────────────────────────────
function exportToCSV(clients: ApiClient[], visibleCols: Set<ColKey>) {
  const cols = ALL_COLUMNS.filter(c => visibleCols.has(c.key))
  const header = cols.map(c => `"${c.label}"`).join(',')

  const rows = clients.map(client => {
    const statusKey = deriveStatus(client)
    return cols.map(col => {
      let val: string | number | boolean | null | undefined
      switch (col.key) {
        case 'name':               val = client.name; break
        case 'code':               val = client.harvestProjectCode; break
        case 'bookkeeper':         val = client.bookkeeper; break
        case 'entityType':         val = client.entityType; break
        case 'projectType':        val = PTYPE_STYLE[client.projectType ?? 'MONTHLY_MAINTENANCE']?.label; break
        case 'revenueType':        val = RTYPE_LABEL[client.revenueType ?? ''] ?? client.revenueType; break
        case 'monthlyBilling':     val = client.totalMonthlyAmount; break
        case 'bookkeepingRate':    val = client.bookkeepingRate; break
        case 'softwareRate':       val = client.softwareRate; break
        case 'status':             val = STATUS_PILL[statusKey].label; break
        case 'contractStartDate':  val = client.contractStartDate; break
        case 'contractEndDate':    val = client.contractEndDate; break
        case 'contractedCloseDate':val = client.contractedCloseDate; break
        case 'clientGroupName':    val = client.clientGroupName; break
        case 'doubleId':           val = client.doubleId; break
        case 'qboId':              val = client.qboId; break
        case 'clickUpId':          val = client.clickUpId; break
        case 'clientContactName':  val = client.clientContactName; break
        case 'totalHrsPerMonth':   val = client.totalHrsPerMonth; break
        case 'apArHrs':            val = client.apArHrs; break
        case 'qaHours':            val = client.qaHours; break
        case 'custSuccessMgmtHrs': val = client.custSuccessMgmtHrs; break
        case 'yeOrTaxHours':       val = client.yeOrTaxHours; break
        case 'auditHours':         val = client.auditHours; break
        case 'bkprHours':          val = client.bkprHours; break
        case 'bankFeedTime':       val = client.bankFeedTime; break
        case 'transactionsPerMonth':val = client.transactionsPerMonth; break
        case 'recTime':            val = client.recTime; break
        case 'numBanksAndCCs':     val = client.numBanksAndCCs; break
        case 'numLoans':           val = client.numLoans; break
        case 'numPmtPortals':      val = client.numPmtPortals; break
        case 'pettyCash':          val = client.pettyCash ? 'Yes' : 'No'; break
        case 'referredBy':         val = client.referredBy; break
        default:                   val = ''
      }
      if (val == null) return '""'
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  })

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bba-clients-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClientDirectory() {
  const [search,        setSearch]       = useState('')
  const [panelOpen,     setPanelOpen]    = useState(false)
  const [showColPanel,  setShowColPanel] = useState(false)
  const [sortKey,       setSortKey]      = useState<SortKey>('name')
  const [sortDir,       setSortDir]      = useState<'asc' | 'desc'>('asc')

  // Inline edits — optimistic local state
  const [inlineEdits, setInlineEdits] = useState<Record<string, Record<string, string>>>({})
  const [savingRows,  setSavingRows]  = useState<Set<string>>(new Set())

  function getVal(client: ApiClient, field: string): string {
    return inlineEdits[client.id]?.[field] ?? (client as any)[field] ?? ''
  }

  async function patchCell(client: ApiClient, field: string, value: string) {
    // Optimistic update
    setInlineEdits(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), [field]: value } }))
    setSavingRows(prev => new Set(prev).add(client.id))
    try {
      const res = await fetch(`/api/clients/${client.harvestProjectCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      // Broadcast bookkeeper changes so other pages update
      if (field === 'bookkeeper' || field === 'Bookkeeper') {
        broadcastBookkeeperChange(client.id, value || null)
      }
    } catch (err) {
      console.error('patchCell failed:', err)
      // Revert on failure
      setInlineEdits(prev => {
        const next = { ...prev }
        if (next[client.id]) { delete next[client.id][field] }
        return next
      })
    } finally {
      setSavingRows(prev => { const next = new Set(prev); next.delete(client.id); return next })
    }
  }

  // Sync bookkeeper changes from other pages — apply optimistically without full refetch
  useBookkeeperSync(useCallback(({ clientId, bookkeeper }) => {
    setInlineEdits(prev => ({
      ...prev,
      [clientId]: { ...(prev[clientId] ?? {}), bookkeeper: bookkeeper ?? '' },
    }))
  }, []))

  // Column widths — resizable via drag handle
  const STORAGE_WIDTHS = 'bba-col-widths-v1'
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(STORAGE_WIDTHS) ?? '{}') } catch { return {} }
  })
  const resizingCol = useRef<{ key: string; startX: number; startW: number } | null>(null)

  function startResize(e: React.MouseEvent, colKey: string) {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement
    const currentW = th ? th.getBoundingClientRect().width : (colWidths[colKey] ?? 120)
    // Snapshot width immediately so layout locks before drag starts
    setColWidths(prev => ({ ...prev, [colKey]: currentW }))
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
      setColWidths(prev => {
        try { localStorage.setItem(STORAGE_WIDTHS, JSON.stringify(prev)) } catch {}
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Filters
  const [tagFilters,       setTagFilters]       = useState<Set<string>>(new Set())
  const [statusFilter,     setStatusFilter]     = useState<StatusFilter>('all')
  const [bookeeperFilter,  setBookkeeperFilter] = useState<string>('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all')
  const [ptFilter,         setPtFilter]         = useState<ProjectType | 'all'>('all')
  const [cadenceFilter,    setCadenceFilter]    = useState<ProcessingCadence | 'all'>('all')

  // Visible columns — persisted
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    if (typeof window === 'undefined') return new Set(DEFAULT_VISIBLE)
    try {
      const saved = localStorage.getItem(STORAGE_VISIBLE)
      if (saved) return new Set(JSON.parse(saved) as ColKey[])
    } catch { /* ignore */ }
    return new Set(DEFAULT_VISIBLE)
  })

  // Column order — persisted
  const [colOrder, setColOrder] = useState<ColKey[]>(() => {
    if (typeof window === 'undefined') return ALL_COL_KEYS
    try {
      const saved = localStorage.getItem(STORAGE_ORDER)
      if (saved) {
        const parsed = JSON.parse(saved) as ColKey[]
        if (parsed.every(k => ALL_COL_KEYS.includes(k as ColKey))) return parsed
      }
    } catch { /* ignore */ }
    return ALL_COL_KEYS
  })

  const [tags,    setTags]    = useState<Tag[]>([])
  const [clients,   setClients]   = useState<ApiClient[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [fetchKey, setFetchKey] = useState(0)

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.tags)) setTags(d.tags) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ]).then(([cd, ed]) => {
      if (Array.isArray(cd.clients)) setClients(cd.clients)
      if (Array.isArray(ed)) setEmployees(ed)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [fetchKey])

  function refetchClients() { setFetchKey(k => k + 1) }

  // Derived filter options from live data
  const bookkeepers  = useMemo(() => [...new Set(clients.map(c => c.bookkeeper).filter(Boolean))].sort() as string[], [clients])
  const entityTypes  = useMemo(() => [...new Set(clients.map(c => c.entityType).filter(Boolean))].sort() as string[], [clients])

  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem(STORAGE_VISIBLE, JSON.stringify([...next]))
      return next
    })
  }

  function showAllCols() {
    const all = new Set(ALL_COL_KEYS)
    setVisibleCols(all)
    localStorage.setItem(STORAGE_VISIBLE, JSON.stringify(ALL_COL_KEYS))
  }

  function resetColsToDefault() {
    setVisibleCols(new Set(DEFAULT_VISIBLE))
    localStorage.setItem(STORAGE_VISIBLE, JSON.stringify([...DEFAULT_VISIBLE]))
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = Array.from(colOrder)
    const [removed] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, removed)
    setColOrder(next)
    localStorage.setItem(STORAGE_ORDER, JSON.stringify(next))
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

  const activeColOrder = colOrder.filter(k => visibleCols.has(k))

  const activeCount = clients.filter(c => c.archiveStatus === 'ACTIVE' && !c.qboOnly).length
  const qboCount    = clients.filter(c => c.qboOnly).length

  const filtered = useMemo(() => {
    const list = clients.filter(c => {
      if (tagFilters.size > 0 && !c.tags.some(t => tagFilters.has(t.id))) return false
      if (cadenceFilter !== 'all' && c.processingCadence !== cadenceFilter) return false
      if (ptFilter !== 'all' && (c.projectType ?? 'MONTHLY_MAINTENANCE') !== ptFilter) return false
      if (statusFilter !== 'all' && deriveStatus(c) !== statusFilter) return false
      if (bookeeperFilter !== 'all' && c.bookkeeper !== bookeeperFilter) return false
      if (entityTypeFilter !== 'all' && c.entityType !== entityTypeFilter) return false
      const q = search.trim().toLowerCase()
      if (q && !c.name.toLowerCase().includes(q) && !c.harvestProjectCode.toLowerCase().includes(q)) return false
      return true
    })
    return [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':            cmp = a.name.localeCompare(b.name); break
        case 'code':            cmp = a.harvestProjectCode.localeCompare(b.harvestProjectCode); break
        case 'bookkeeper':      cmp = (a.bookkeeper ?? '').localeCompare(b.bookkeeper ?? ''); break
        case 'entityType':      cmp = (a.entityType ?? '').localeCompare(b.entityType ?? ''); break
        case 'projectType':     cmp = (a.projectType ?? '').localeCompare(b.projectType ?? ''); break
        case 'revenueType':     cmp = (a.revenueType ?? '').localeCompare(b.revenueType ?? ''); break
        case 'monthlyBilling':  cmp = (a.totalMonthlyAmount ?? 0) - (b.totalMonthlyAmount ?? 0); break
        case 'bookkeepingRate': cmp = (a.bookkeepingRate ?? 0) - (b.bookkeepingRate ?? 0); break
        case 'referredBy':      cmp = (a.referredBy ?? '').localeCompare(b.referredBy ?? ''); break
        case 'status':          cmp = STATUS_PILL[deriveStatus(a)].label.localeCompare(STATUS_PILL[deriveStatus(b)].label); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [clients, search, tagFilters, cadenceFilter, ptFilter, statusFilter, bookeeperFilter, entityTypeFilter, sortKey, sortDir])

  const anyFilter = tagFilters.size > 0 || cadenceFilter !== 'all' || ptFilter !== 'all' ||
    statusFilter !== 'all' || bookeeperFilter !== 'all' || entityTypeFilter !== 'all' || !!search.trim()

  function clearFilters() {
    setTagFilters(new Set()); setCadenceFilter('all'); setPtFilter('all')
    setStatusFilter('all'); setBookkeeperFilter('all'); setEntityTypeFilter('all'); setSearch('')
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

  function renderCell(colKey: ColKey, client: ApiClient) {
    const statusKey = deriveStatus(client)
    const pill = STATUS_PILL[statusKey]
    const pt = client.projectType ?? 'MONTHLY_MAINTENANCE'
    const ptStyle = PTYPE_STYLE[pt] ?? PTYPE_STYLE.MONTHLY_MAINTENANCE
    const col = ALL_COLUMNS.find(c => c.key === colKey)!
    const alignCls = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'

    switch (colKey) {
      case 'name':
        return (
          <td key={colKey} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: 'rgba(78,0,142,0.12)' }}>
                {initials(client.name)}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Link href={`/clients/${client.harvestProjectCode}`} className="font-medium text-slate-800 hover:text-purple-700 transition-colors whitespace-nowrap">
                  {client.name}
                </Link>
                <Link
                  href={`/clients/${client.harvestProjectCode}`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{ backgroundColor: 'rgba(78,0,142,0.08)', color: '#6a4c80', border: '1px solid rgba(78,0,142,0.2)' }}
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
      case 'bookkeeper':
        return (
          <td key={colKey} className="px-3 py-2">
            <select
              value={getVal(client, 'bookkeeper')}
              onChange={e => patchCell(client, 'bookkeeper', e.target.value)}
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
            >
              <option value="">—</option>
              {employees.map((e: any) => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </td>
        )
      case 'entityType':
        return (
          <td key={colKey} className="px-3 py-2">
            <select
              value={getVal(client, 'entityType')}
              onChange={e => patchCell(client, 'entityType', e.target.value)}
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-700 hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
            >
              <option value="">—</option>
              {[
                {v:'LLC',label:'LLC'},{v:'S_CORP',label:'S-Corp'},{v:'C_CORP',label:'C-Corp'},
                {v:'SOLE_PROPRIETOR',label:'Sole Proprietor'},{v:'PARTNERSHIP',label:'Partnership'},
                {v:'NON_PROFIT',label:'Non-Profit'},{v:'OTHER',label:'Other'},
              ].map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </td>
        )
      case 'projectType':
        return (
          <td key={colKey} className="px-3 py-2">
            <select
              value={getVal(client, 'projectType')}
              onChange={e => patchCell(client, 'projectType', e.target.value)}
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
            >
              <option value="">—</option>
              {[{v:'RECURRING',l:'Recurring'},{v:'CLEAN_UP',l:'Cleanup'},{v:'ANNUAL',l:'Annual'},{v:'QBO_ONLY',l:'QBO Only'},{v:'MONTHLY_MAINTENANCE',l:'Monthly Maintenance'}].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </td>
        )
      case 'revenueType':
        return (
          <td key={colKey} className="px-3 py-2">
            <select
              value={getVal(client, 'revenueType')}
              onChange={e => patchCell(client, 'revenueType', e.target.value)}
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-slate-600 hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
            >
              <option value="">—</option>
              {[
                {v:'RECURRING_MONTHLY_ACH',l:'Recurring Monthly - ACH'},
                {v:'RECURRING_MONTHLY_INVOICED',l:'Recurring Monthly - Invoiced'},
                {v:'RECURRING_MONTHLY_HOURLY',l:'Recurring Monthly - Hourly'},
                {v:'CLEANUP',l:'Cleanup'},{v:'HOURLY_CLEANUP',l:'Hourly Cleanup'},
                {v:'FREE',l:'Free'},{v:'QBO_ONLY_ANCHOR',l:'QBO Only - Anchor'},{v:'QBO_ONLY_QB',l:'QBO Only - QB'},
              ].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </td>
        )
      case 'monthlyBilling': {
        const bkr = parseFloat(String(inlineEdits[client.id]?.bookkeepingRate ?? client.bookkeepingRate ?? 0)) || 0
        const swr = parseFloat(String(inlineEdits[client.id]?.softwareRate    ?? client.softwareRate    ?? 0)) || 0
        const autoTotal = parseFloat((bkr + swr).toFixed(2))
        // Auto-calc wins when rates are set; only fall back to savedTotal if no rates exist
        const manualOverride = inlineEdits[client.id]?.totalMonthlyAmount
        const savedTotal = client.totalMonthlyAmount
        const displayVal = manualOverride
          ?? (autoTotal > 0 ? String(autoTotal) : (savedTotal != null ? String(savedTotal) : ''))
        return (
          <td key={colKey} className="px-2 py-1.5">
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
              <input type="number" min={0} step={0.01}
                value={displayVal}
                onChange={e => setInlineEdits(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), totalMonthlyAmount: e.target.value } }))}
                onBlur={e => patchCell(client, 'totalMonthlyAmount', e.target.value)}
                placeholder="0.00"
                className="w-24 rounded-md border border-transparent bg-transparent pl-5 pr-2 py-1 text-sm text-slate-700 tabular-nums hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
          </td>
        )
      }
      case 'bookkeepingRate':
        return (
          <td key={colKey} className="px-2 py-1.5">
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
              <input type="number" min={0} step={0.01}
                value={getVal(client, 'bookkeepingRate')}
                onChange={e => setInlineEdits(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), bookkeepingRate: e.target.value } }))}
                onBlur={e => patchCell(client, 'bookkeepingRate', e.target.value)}
                placeholder="0.00"
                className="w-24 rounded-md border border-transparent bg-transparent pl-5 pr-2 py-1 text-sm text-slate-700 tabular-nums hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
          </td>
        )
      case 'softwareRate':
        return (
          <td key={colKey} className="px-2 py-1.5">
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
              <input type="number" min={0} step={0.01}
                value={getVal(client, 'softwareRate')}
                onChange={e => setInlineEdits(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), softwareRate: e.target.value } }))}
                onBlur={e => patchCell(client, 'softwareRate', e.target.value)}
                placeholder="0.00"
                className="w-24 rounded-md border border-transparent bg-transparent pl-5 pr-2 py-1 text-sm text-slate-700 tabular-nums hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
          </td>
        )
      case 'guaranteedDeadlineDay':
        return (
          <td key={colKey} className="px-2 py-1.5 text-center">
            <input type="number" min={1} max={31}
              value={getVal(client, 'guaranteedDeadlineDay')}
              onChange={e => setInlineEdits(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), guaranteedDeadlineDay: e.target.value } }))}
              onBlur={e => patchCell(client, 'guaranteedDeadlineDay', e.target.value)}
              placeholder="—"
              className="w-14 rounded-md border border-transparent bg-transparent py-1 text-sm text-center text-slate-700 tabular-nums hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400" />
          </td>
        )
      case 'hasContractedLoom':
        return (
          <td key={colKey} className="px-4 py-3 text-center">
            <input type="checkbox"
              checked={!!( inlineEdits[client.id]?.hasContractedLoom !== undefined ? inlineEdits[client.id].hasContractedLoom === 'true' : client.hasContractedLoom)}
              onChange={e => patchCell(client, 'hasContractedLoom', String(e.target.checked))}
              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
          </td>
        )
      case 'hasScheduledMeetings':
        return (
          <td key={colKey} className="px-4 py-3 text-center">
            <input type="checkbox"
              checked={!!( inlineEdits[client.id]?.hasScheduledMeetings !== undefined ? inlineEdits[client.id].hasScheduledMeetings === 'true' : client.hasScheduledMeetings)}
              onChange={e => patchCell(client, 'hasScheduledMeetings', String(e.target.checked))}
              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
          </td>
        )
      case 'hasSignedAutoIncrease':
        return (
          <td key={colKey} className="px-4 py-3 text-center">
            <input type="checkbox"
              checked={!!( inlineEdits[client.id]?.hasSignedAutoIncrease !== undefined ? inlineEdits[client.id].hasSignedAutoIncrease === 'true' : client.hasSignedAutoIncrease)}
              onChange={e => patchCell(client, 'hasSignedAutoIncrease', String(e.target.checked))}
              className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
          </td>
        )
      case 'autoPriceIncreasePercent':
        return (
          <td key={colKey} className="px-2 py-1.5">
            <div className="relative">
              <input type="number" min={0} max={100} step={0.1}
                value={getVal(client, 'autoPriceIncreasePercent')}
                onChange={e => setInlineEdits(prev => ({ ...prev, [client.id]: { ...(prev[client.id] ?? {}), autoPriceIncreasePercent: e.target.value } }))}
                onBlur={e => patchCell(client, 'autoPriceIncreasePercent', e.target.value)}
                placeholder="0"
                className="w-16 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-right text-slate-700 tabular-nums hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400" />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
            </div>
          </td>
        )
      case 'accountantName':
        return <td key={colKey} className="px-4 py-3 text-sm text-slate-700">{client.accountantName ?? <span className="text-slate-400">—</span>}</td>
      case 'status':
        return (
          <td key={colKey} className="px-4 py-3">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${pill.bg} ${pill.text} ${pill.ring}`}>
              {pill.label}
            </span>
          </td>
        )
      case 'contractStartDate':
        return <td key={colKey} className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(client.contractStartDate)}</td>
      case 'contractEndDate':
        return <td key={colKey} className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(client.contractEndDate)}</td>
      case 'contractedCloseDate':
        return <td key={colKey} className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(client.contractedCloseDate)}</td>
      case 'clientGroupName':
        return <td key={colKey} className="px-4 py-3 text-sm text-slate-700">{client.clientGroupName ?? <span className="text-slate-400">—</span>}</td>
      case 'doubleId':
        return <td key={colKey} className="px-4 py-3 text-xs font-mono text-slate-600">{client.doubleId ?? <span className="text-slate-400">—</span>}</td>
      case 'qboId':
        return <td key={colKey} className="px-4 py-3 text-xs font-mono text-slate-600">{client.qboId ?? <span className="text-slate-400">—</span>}</td>
      case 'clickUpId':
        return <td key={colKey} className="px-4 py-3 text-xs font-mono text-slate-600">{client.clickUpId ?? <span className="text-slate-400">—</span>}</td>
      case 'clientContactName':
        return <td key={colKey} className="px-4 py-3 text-sm text-slate-700">{client.clientContactName ?? <span className="text-slate-400">—</span>}</td>
      case 'referredBy':
        return <td key={colKey} className="px-4 py-3 text-sm text-slate-700">{client.referredBy ?? <span className="text-slate-400">—</span>}</td>
      case 'pettyCash':
        return (
          <td key={colKey} className="px-4 py-3 text-center">
            {client.pettyCash
              ? <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-purple-100 text-purple-700">Yes</span>
              : <span className="text-slate-400 text-xs">—</span>}
          </td>
        )
      // Numeric hour/count columns
      default: {
        const editableNumeric: Partial<Record<ColKey, { field: keyof ApiClient; step?: number; placeholder?: string }>> = {
          totalHrsPerMonth:    { field: 'totalHrsPerMonth',    step: 0.25 },
          apArHrs:             { field: 'apArHrs',             step: 0.25 },
          qaHours:             { field: 'qaHours',             step: 0.25 },
          custSuccessMgmtHrs:  { field: 'custSuccessMgmtHrs',  step: 0.25 },
          yeOrTaxHours:        { field: 'yeOrTaxHours',        step: 0.25 },
          auditHours:          { field: 'auditHours',          step: 0.25 },
          bkprHours:           { field: 'bkprHours',           step: 0.25 },
          bankFeedTime:        { field: 'bankFeedTime',        step: 0.25 },
          transactionsPerMonth:{ field: 'transactionsPerMonth', step: 1   },
          recTime:             { field: 'recTime',             step: 0.25 },
          numBanksAndCCs:      { field: 'numBanksAndCCs',      step: 1   },
          numLoans:            { field: 'numLoans',            step: 1   },
          numPmtPortals:       { field: 'numPmtPortals',       step: 1   },
        }
        const meta = editableNumeric[colKey]
        if (meta) {
          return (
            <td key={colKey} className={`px-2 py-1.5 ${alignCls}`}>
              <input
                type="number"
                min={0}
                step={meta.step ?? 0.25}
                value={getVal(client, meta.field as string)}
                onChange={e => setInlineEdits(prev => ({
                  ...prev,
                  [client.id]: { ...(prev[client.id] ?? {}), [meta.field]: e.target.value },
                }))}
                onBlur={e => patchCell(client, meta.field as string, e.target.value)}
                placeholder="—"
                className="w-16 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-700 tabular-nums text-right hover:border-slate-200 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </td>
          )
        }
        // Fallback read-only
        return (
          <td key={colKey} className={`px-4 py-3 ${alignCls}`}>
            <span className="tabular-nums text-sm text-slate-700">—</span>
          </td>
        )
      }
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">BBA Client List</h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeCount} active client{activeCount !== 1 ? 's' : ''}{qboCount > 0 ? ` · ${qboCount} QBO only` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-bba-primary px-4 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 active:scale-95 transition-all"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          
          </button>
          <button
            onClick={() => exportToCSV(filtered, visibleCols)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Excel
          </button>
        </div>
      </div>

      {/* ── Show Columns Panel ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setShowColPanel(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showColPanel ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-semibold text-slate-700">Show columns</span>
            <span className="text-xs text-slate-400">({visibleCols.size} of {ALL_COLUMNS.length} visible)</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button onClick={showAllCols} className="text-xs text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2">Show all</button>
            <span className="text-slate-300">·</span>
            <button onClick={resetColsToDefault} className="text-xs text-slate-500 hover:text-slate-700 font-medium underline underline-offset-2">Reset to default</button>
            <span className="text-slate-300">·</span>
            <button onClick={() => { setColWidths({}); try { localStorage.removeItem(STORAGE_WIDTHS) } catch {} }} className="text-xs text-slate-500 hover:text-slate-700 font-medium underline underline-offset-2">Reset widths</button>
          </div>
        </button>
        {showColPanel && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-1.5">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors select-none">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        {/* Tag pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            onClick={() => setTagFilters(new Set())}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all ${tagFilters.size === 0 ? 'bg-purple-100 ring-purple-300 text-purple-700' : 'ring-slate-300 text-slate-500 hover:text-slate-700 hover:ring-slate-400'}`}
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
                  color: active ? tag.color : `${tag.color}99`,
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
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className={dropSel}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="offboarding">Off-boarding</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
            <option value="pendingArchive">Pending Archive</option>
          </select>
          <select value={bookeeperFilter} onChange={e => setBookkeeperFilter(e.target.value)} className={dropSel}>
            <option value="all">All Bookkeepers</option>
            {bookkeepers.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={entityTypeFilter} onChange={e => setEntityTypeFilter(e.target.value)} className={dropSel}>
            <option value="all">All Entity Types</option>
            {entityTypes.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
          <select value={ptFilter} onChange={e => setPtFilter(e.target.value as ProjectType | 'all')} className={dropSel}>
            <option value="all">All Project Types</option>
            <option value="ANNUAL">Annual</option>
            <option value="CLEAN_UP">Cleanup</option>
            <option value="MONTHLY_MAINTENANCE">Monthly Maintenance</option>
            <option value="QBO_ONLY">QBO Only</option>
            <option value="RECURRING">Recurring</option>
          </select>
          <select value={cadenceFilter} onChange={e => setCadenceFilter(e.target.value as ProcessingCadence | 'all')} className={dropSel}>
            <option value="all">All Cadences</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Bi-Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </select>
          <button
            onClick={clearFilters}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all border ${
              anyFilter
                ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                : 'bg-white border-slate-200 text-slate-400 cursor-default'
            }`}
            disabled={!anyFilter}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by client name or project code…"
            className="w-full rounded-lg bg-white border border-slate-200 pl-9 pr-9 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
          <span className="text-[10px] font-medium text-white/70">Drag headers to reorder · click to sort</span>
        </div>

        <div className="overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <table className="w-full text-sm">
              <thead>
                <Droppable droppableId="columns" direction="horizontal">
                  {(provided) => (
                    <tr
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{ backgroundColor: 'var(--bba-primary)', borderBottom: '2px solid rgba(78,0,142,0.3)' }}
                    >
                      <th className="w-1 px-0 shrink-0" />
                      {activeColOrder.map((colKey, index) => {
                        const col = ALL_COLUMNS.find(c => c.key === colKey)!
                        const alignCls = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        return (
                          <Draggable key={colKey} draggableId={colKey} index={index}>
                            {(provided, snapshot) => (
                          <th
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`relative px-4 py-3 ${alignCls} text-[11px] font-semibold uppercase tracking-wider select-none transition-opacity ${snapshot.isDragging ? 'opacity-50' : ''}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  width: colWidths[colKey] ?? undefined,
                                  minWidth: colWidths[colKey] ?? undefined,
                                }}
                              >
                                <div className="flex items-start gap-1 w-full">
                                  {/* Drag grip — only this activates column reorder */}
                                  <span
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing shrink-0 opacity-30 hover:opacity-70 transition-opacity pt-px"
                                    title="Drag to reorder"
                                  >⠿</span>
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleSort(colKey as SortKey) }}
                                    className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer select-none flex-1 min-w-0"
                                  >
                                    <span className={`uppercase tracking-wider font-bold text-white leading-tight ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                                      {col.label}
                                    </span>
                                    <span className="text-[9px] opacity-60 shrink-0">
                                      {sortKey === colKey ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                                    </span>
                                  </button>
                                </div>
                                {/* Resize handle — completely separate from drag */}
                                <div
                                  onMouseDown={e => startResize(e, colKey)}
                                  className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-60 transition-opacity z-10"
                                  title="Drag to resize"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="h-4 w-0.5 rounded-full bg-white/40" />
                                </div>
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
                    <td colSpan={activeColOrder.length} className="px-4 py-12 text-center text-sm text-slate-400">
                      Loading clients…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={activeColOrder.length} className="px-4 py-12 text-center text-sm text-slate-400">
                      {anyFilter
                        ? <><span>No clients match your filters. </span><button onClick={clearFilters} className="underline text-purple-600">Clear filters</button></>
                        : 'No clients found.'}
                    </td>
                  </tr>
                ) : filtered.map((client, idx) => {
                  const isSaving = savingRows.has(client.id)
                  const baseBg = idx % 2 === 0 ? '#ffffff' : '#faf5ff'
                  return (
                    <tr
                      key={client.id}
                      style={{
                        backgroundColor: isSaving ? '#f5f0ff' : baseBg,
                        borderBottom: '1px solid #f0e8f8',
                        borderLeft: `3px solid ${isSaving ? '#7c3aed' : 'transparent'}`,
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => { if (!isSaving) e.currentTarget.style.backgroundColor = '#f3e8ff' }}
                      onMouseLeave={e => { if (!isSaving) e.currentTarget.style.backgroundColor = baseBg }}
                    >
                      {/* Saving indicator cell — always first */}
                      <td className="w-1 px-0" />
                      {activeColOrder.map(colKey => renderCell(colKey, client))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DragDropContext>
        </div>
      </div>

      <AddClientPanel open={panelOpen} onClose={() => setPanelOpen(false)} onCreated={refetchClients} />
    </div>
  )
}
