'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabaseClient'

type ClientView = {
  id:             string
  name:           string
  filters:        {
    statusFilters:     string[]
    bookkeeperFilters: string[]
    entityTypeFilters: string[]
    ptFilters:         string[]
    cadenceFilters:    string[]
    search:            string
  }
  sharedWithTeam: boolean
}

type Client = {
  id:                 string
  name:               string
  harvestProjectCode: string
  entityType:         string | null
  processingCadence:  string | null
  projectType:        string | null
  archiveStatus:      string
  bookkeeper:         string | null
  tags:               { name: string; color: string }[]
}

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Bi-Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
}

const PTYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ANNUAL:              { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Annual'    },
  CLEAN_UP:            { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Cleanup'   },
  MONTHLY_MAINTENANCE: { bg: 'bg-purple-100', text: 'text-bba-action', label: 'Recurring' },
  QBO_ONLY:            { bg: 'bg-sky-100',    text: 'text-sky-700',    label: 'QBO Only'  },
  RECURRING:           { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'Recurring' },
}

function deriveStatus(client: Client): string {
  if (client.archiveStatus === 'ARCHIVED') return 'archived'
  return 'active'
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function HubViewPage() {
  const { viewId } = useParams<{ viewId: string }>()

  const [view,      setView]      = useState<ClientView | null>(null)
  const [allClients, setAllClients] = useState<Client[]>([])
  const [empName,   setEmpName]   = useState('')
  const [loading,   setLoading]   = useState(true)
  const [showAll,   setShowAll]   = useState(false)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Get logged-in user
      const { data } = await supabaseClient.auth.getSession()
      if (!data.session) return

      const email = data.session.user.email ?? ''
      const meRes  = await fetch(`/api/hub/me?email=${encodeURIComponent(email)}`)
      const meJson = await meRes.json()
      if (meJson.name) setEmpName(meJson.name)

      // Load views
      const vRes  = await fetch('/api/views')
      const vJson = await vRes.json()
      const found = (vJson.views ?? []).find((v: ClientView) => v.id === viewId)
      if (found) setView(found)

      // Load all clients (we filter client-side)
      const cRes  = await fetch('/api/clients')
      const cJson = await cRes.json()
      if (Array.isArray(cJson.clients)) setAllClients(cJson.clients)

      setLoading(false)
    }
    load()
  }, [viewId])

  // Apply view filters + my-clients toggle + search
  const filtered = allClients.filter(client => {
    // My clients filter
    if (!showAll && empName) {
      const bk = (client.bookkeeper ?? '').toLowerCase()
      if (bk !== empName.toLowerCase()) return false
    }

    // Skip archived unless view explicitly includes them
    const status = deriveStatus(client)
    if (view?.filters.statusFilters?.length) {
      if (!view.filters.statusFilters.includes(status)) return false
    } else {
      if (status === 'archived') return false
    }

    // Entity type filter
    if (view?.filters.entityTypeFilters?.length) {
      if (!view.filters.entityTypeFilters.includes(client.entityType ?? '')) return false
    }

    // Project type filter
    if (view?.filters.ptFilters?.length) {
      if (!view.filters.ptFilters.includes(client.projectType ?? '')) return false
    }

    // Cadence filter
    if (view?.filters.cadenceFilters?.length) {
      if (!view.filters.cadenceFilters.includes(client.processingCadence ?? '')) return false
    }

    // Search
    if (search) {
      const q = search.toLowerCase()
      if (!client.name.toLowerCase().includes(q) && !client.harvestProjectCode.toLowerCase().includes(q)) return false
    }

    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse h-32" />
          ))}
        </div>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">View not found.</p>
        <Link href="/hub/dashboard" className="mt-4 inline-block text-sm text-bba-action hover:underline">← Back to My Clients</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{view.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filtered.length} client{filtered.length !== 1 ? 's' : ''}
            {!showAll && empName ? ` · ${empName.split(' ')[0]}'s clients` : ' · All bookkeepers'}
          </p>
        </div>

        {/* My Clients / All toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shrink-0">
          <button
            onClick={() => setShowAll(false)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              !showAll ? 'bg-bba-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            My Clients
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              showAll ? 'bg-bba-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            All Clients
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-action" />
      </div>

      {/* Client grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-400 text-sm">
            {search ? 'No clients match your search.' : showAll ? 'No clients match this view.' : 'No clients assigned to you match this view.'}
          </p>
          {!showAll && (
            <button onClick={() => setShowAll(true)} className="mt-3 text-sm text-bba-action hover:underline">
              View all bookkeepers →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => {
            const pt = PTYPE_STYLE[client.projectType ?? 'RECURRING'] ?? PTYPE_STYLE.RECURRING
            return (
              <Link key={client.id} href={`/hub/clients/${client.harvestProjectCode}`}
                className="group rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-purple-200 transition-all space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: 'rgba(78,0,142,0.12)', color: '#4e008e' }}>
                    {initials(client.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-bba-action transition-colors truncate">{client.name}</p>
                    <p className="text-xs font-mono text-slate-400">{client.harvestProjectCode}</p>
                    {showAll && client.bookkeeper && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{client.bookkeeper}</p>
                    )}
                  </div>
                  <svg className="h-4 w-4 text-slate-300 group-hover:text-purple-400 transition-colors shrink-0 mt-0.5"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pt.bg} ${pt.text}`}>{pt.label}</span>
                  {client.entityType && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {client.entityType.replace(/_/g, ' ')}
                    </span>
                  )}
                  {client.processingCadence && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-600">
                      {CADENCE_LABEL[client.processingCadence] ?? client.processingCadence}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
