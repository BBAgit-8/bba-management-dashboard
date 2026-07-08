'use client'

import { useState, useEffect, useCallback } from 'react'

type Status = 'open' | 'in-progress' | 'done'
type Row = {
  id: string
  title: string
  description: string
  pageContext: string | null
  status: Status
  createdAt: string
  updatedAt: string
}
type Filter = Status | 'all'

const STATUS_PILL: Record<Status, { bg: string; text: string; label: string }> = {
  'open':        { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Open'        },
  'in-progress': { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'In progress' },
  'done':        { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Done'        },
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function briefFor(row: Row): string {
  return `CHANGE REQUEST: ${row.title}

Page: ${row.pageContext ?? '(none)'}
Created: ${fmtDate(row.createdAt)}
Status: ${STATUS_PILL[row.status].label}

Details:
${row.description}`
}

export default function ChangeRequestsPage() {
  const [rows,   setRows]   = useState<Row[]>([])
  const [filter, setFilter] = useState<Filter>('open')
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/change-requests', { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        setRows(j.requests ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (id: string, status: Status) => {
    const res = await fetch(`/api/change-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) load()
  }

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete change request "${title}"? This cannot be undone.`)) return
    const res = await fetch(`/api/change-requests/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  const copyBrief = async (row: Row) => {
    try {
      await navigator.clipboard.writeText(briefFor(row))
      setCopiedId(row.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // Fallback: open a prompt so user can copy manually
      window.prompt('Copy brief:', briefFor(row))
    }
  }

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const counts = {
    open:        rows.filter(r => r.status === 'open').length,
    inProgress:  rows.filter(r => r.status === 'in-progress').length,
    done:        rows.filter(r => r.status === 'done').length,
  }

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Change requests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Anything you&apos;d like changed in the dashboard — new features, bug fixes, tweaks — logged here so nothing gets lost between chats.
          Hit the &ldquo;Copy for Claude&rdquo; button on any row when we work on it together.
        </p>
      </header>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {([
          ['open',        'Open',        counts.open],
          ['in-progress', 'In progress', counts.inProgress],
          ['done',        'Done',        counts.done],
          ['all',         'All',         rows.length],
        ] as [Filter, string, number][]).map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-bba-action text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 min-w-[20px] text-center ${
              filter === key ? 'bg-white/25' : 'bg-slate-100'
            }`}>{n}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-slate-400 text-center py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 text-center py-12 text-sm text-slate-400">
          {filter === 'open' ? 'Nothing open — nice work.' : 'No requests to show.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const pill = STATUS_PILL[row.status]
            return (
              <div key={row.id} className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-800">{row.title}</h3>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.bg} ${pill.text}`}>
                        {pill.label}
                      </span>
                      {row.pageContext && (
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {row.pageContext}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{row.description}</p>
                    <p className="mt-2 text-[11px] text-slate-400">{fmtDate(row.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => copyBrief(row)}
                      className="text-xs font-medium text-bba-action hover:underline whitespace-nowrap"
                    >
                      {copiedId === row.id ? '✓ Copied' : 'Copy for Claude'}
                    </button>
                    <select
                      value={row.status}
                      onChange={e => setStatus(row.id, e.target.value as Status)}
                      className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    <button
                      onClick={() => remove(row.id, row.title)}
                      className="text-[11px] text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
