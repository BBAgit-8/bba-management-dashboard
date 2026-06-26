'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabaseClient'

type Client = {
  id: string
  name: string
  harvestProjectCode: string
  entityType: string | null
  processingCadence: string | null
  projectType: string | null
  archiveStatus: string
  contractStartDate: string | null
  clientContactName: string | null
  totalHrsPerMonth: number | null
  tags: { name: string; color: string }[]
}

const CADENCE_LABEL: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Bi-Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
}

const PTYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  ANNUAL:              { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Annual'     },
  CLEAN_UP:            { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Cleanup'    },
  MONTHLY_MAINTENANCE: { bg: 'bg-purple-100', text: 'text-bba-action', label: 'Recurring'  },
  QBO_ONLY:            { bg: 'bg-sky-100',    text: 'text-sky-700',    label: 'QBO Only'   },
  RECURRING:           { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'Recurring'  },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function HubDashboard() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [empName, setEmpName] = useState('')

  useEffect(() => {
    supabaseClient.auth.getSession().then(async ({ data }) => {
      if (!data.session) return
      const email = data.session.user.email ?? ''
      const res  = await fetch(`/api/hub/me?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      if (json.name) {
        setEmpName(json.name)
        const cres  = await fetch(`/api/hub/clients?bookkeeper=${encodeURIComponent(json.name)}`)
        const cjson = await cres.json()
        if (Array.isArray(cjson.clients)) setClients(cjson.clients)
      }
      setLoading(false)
    })
  }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.harvestProjectCode.toLowerCase().includes(search.toLowerCase())
  )

  const active  = clients.filter(c => c.archiveStatus === 'ACTIVE').length
  const cleanup = clients.filter(c => c.projectType === 'CLEAN_UP').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">
          {empName ? `Welcome, ${empName.split(' ')[0]}` : 'My Clients'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {active} active client{active !== 1 ? 's' : ''}
          {cleanup > 0 ? ` · ${cleanup} cleanup` : ''}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-action" />
      </div>

      {/* Client grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-400 text-sm">{search ? 'No clients match your search.' : 'No clients assigned yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => {
            const pt = PTYPE_STYLE[client.projectType ?? 'MONTHLY_MAINTENANCE'] ?? PTYPE_STYLE.MONTHLY_MAINTENANCE
            return (
              <Link key={client.id} href={`/hub/clients/${client.harvestProjectCode}`}
                className="group rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-purple-200 transition-all space-y-4">
                {/* Top */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: 'rgba(109,40,217,0.15)', color: '#6d28d9' }}>
                    {initials(client.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 group-hover:text-bba-action transition-colors truncate">{client.name}</p>
                    <p className="text-xs font-mono text-slate-400">{client.harvestProjectCode}</p>
                  </div>
                  <svg className="h-4 w-4 text-slate-300 group-hover:text-purple-400 transition-colors shrink-0 mt-0.5"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pt.bg} ${pt.text}`}>{pt.label}</span>
                  {client.entityType && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">{client.entityType}</span>
                  )}
                  {client.processingCadence && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-600">
                      {CADENCE_LABEL[client.processingCadence] ?? client.processingCadence}
                    </span>
                  )}
                </div>

                {/* Hours placeholder */}
                {client.totalHrsPerMonth != null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Hours budget</span>
                      <span>{client.totalHrsPerMonth} hrs/mo</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-purple-400" style={{ width: '40%' }} />
                    </div>
                  </div>
                )}

                {/* Tags */}
                {client.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {client.tags.slice(0, 3).map(tag => (
                      <span key={tag.name} className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
