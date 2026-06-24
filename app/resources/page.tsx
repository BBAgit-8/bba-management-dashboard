'use client'

import { useState } from 'react'

type Resource = {
  id: string
  title: string
  description: string
  url: string
  category: 'sheet' | 'tool' | 'app'
  embedUrl?: string
  icon: React.ReactNode
}

function toEmbedUrl(url: string): string {
  // Convert various Google Sheets URL formats to a previewable embed URL
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return `https://docs.google.com/spreadsheets/d/${match[1]}/preview`
  return url
}

function AddSheetCard({ onAdd }: { onAdd: (r: Resource) => void }) {
  const [open,  setOpen]  = useState(false)
  const [title, setTitle] = useState('')
  const [desc,  setDesc]  = useState('')
  const [url,   setUrl]   = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!url.trim()) { setError('Please paste a URL'); return }
    const isSheet = url.includes('docs.google.com/spreadsheets')
    if (!isSheet && !url.startsWith('http')) { setError('Please enter a valid URL'); return }
    onAdd({
      id: `custom-${Date.now()}`,
      title: title.trim() || 'Untitled Sheet',
      description: desc.trim(),
      url: url.trim(),
      embedUrl: isSheet ? toEmbedUrl(url.trim()) : undefined,
      category: isSheet ? 'sheet' : 'tool',
      icon: SHEETS_ICON,
    })
    setTitle(''); setDesc(''); setUrl(''); setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-5 flex items-center gap-3 text-slate-400 hover:border-purple-300 hover:text-purple-500 transition-colors w-full text-left">
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <p className="text-sm">Add a sheet or resource — paste a Google Sheet URL or any link</p>
    </button>
  )

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Add Resource</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        <input type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="Paste Google Sheet URL or any link…"
          autoFocus
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xs" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button type="submit"
            className="rounded-lg bg-bba-primary px-4 py-2 text-xs font-semibold text-white hover:bg-bba-primary/85">
            Add Resource
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

const SHEETS_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 3h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm-4-8h2v2H8V6zm0 4h2v2H8v-2zm0 4h2v2H8v-2zm8-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" />
  </svg>
)

const TOOL_ICON = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
)

const RESOURCES: Resource[] = [
  {
    id: 'qa-tracking',
    title: 'QA Needs Changes Tracker',
    description: 'Tracks all QA review comments with Needs Changes status by bookkeeper and client. Includes summaries by quarter, bookkeeper detail, and client detail views.',
    url: 'https://docs.google.com/spreadsheets/d/1oVBXQMKXNXgPQI5nP-91ReupTTEZYdyekUWi5yYy2n4/edit',
    embedUrl: 'https://docs.google.com/spreadsheets/d/1oVBXQMKXNXgPQI5nP-91ReupTTEZYdyekUWi5yYy2n4/preview',
    category: 'sheet',
    icon: SHEETS_ICON,
  },
  // ── Add more sheets/tools below ──
  // {
  //   id: 'weekly-update',
  //   title: 'Weekly Update',
  //   description: 'Staff hours from Harvest, client hours vs budget, overdue tasks.',
  //   url: 'https://docs.google.com/spreadsheets/d/YOUR_ID/edit',
  //   embedUrl: 'https://docs.google.com/spreadsheets/d/YOUR_ID/preview',
  //   category: 'sheet',
  //   icon: SHEETS_ICON,
  // },
]

const EXTERNAL_TOOLS = [
  { label: 'ClickUp',    href: 'https://app.clickup.com',            color: '#7B68EE' },
  { label: 'Double',     href: 'https://app.doublehq.com',           color: '#FF6B6B' },
  { label: 'Harvest',    href: 'https://harvestapp.com',              color: '#FA5C00' },
  { label: 'Anchor',     href: 'https://app.sayanchor.com/home',      color: '#0057FF' },
  { label: 'MailerLite', href: 'https://app.mailerlite.com',         color: '#09C269' },
  { label: 'Gusto',      href: 'https://app.gusto.com',              color: '#F45D48' },
  { label: 'Vercel',     href: 'https://vercel.com/dashboard',       color: '#000000' },
  { label: 'Supabase',   href: 'https://supabase.com/dashboard',     color: '#3ECF8E' },
  { label: 'GitHub',     href: 'https://github.com/BBAgit-8',        color: '#24292F' },
]

const CATEGORY_LABEL: Record<Resource['category'], string> = {
  sheet: 'Google Sheet',
  tool:  'Tool',
  app:   'App',
}

const CATEGORY_COLOR: Record<Resource['category'], { bg: string; text: string }> = {
  sheet: { bg: 'bg-green-100', text: 'text-green-700' },
  tool:  { bg: 'bg-blue-100',  text: 'text-blue-700'  },
  app:   { bg: 'bg-purple-100',text: 'text-purple-700' },
}

export default function ResourcesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [customSheets, setCustomSheets] = useState<Resource[]>([])
  const allResources = [...RESOURCES, ...customSheets]

  function toggleEmbed(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Resources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sheets, trackers, and tools the BBA team uses regularly. Open in full or preview inline.
        </p>
      </div>

      {/* ── Sheets & Docs ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bba-secondary, #b20476)' }}>
          Sheets &amp; Trackers
        </h2>
        <div className="space-y-3">
          {allResources.map(resource => {
            const isExpanded = expandedId === resource.id
            const cat = CATEGORY_COLOR[resource.category]
            return (
              <div key={resource.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Card header */}
                <div className="flex items-start gap-4 p-5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-green-600"
                    style={{ backgroundColor: '#e8f5e9' }}>
                    {resource.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{resource.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cat.bg} ${cat.text}`}>
                        {CATEGORY_LABEL[resource.category]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{resource.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {resource.embedUrl && (
                      <button
                        onClick={() => toggleEmbed(resource.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                          isExpanded
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-700'
                        }`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                        </svg>
                        {isExpanded ? 'Hide' : 'Preview'}
                      </button>
                    )}
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-85"
                      style={{ backgroundColor: 'var(--bba-primary)' }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open
                    </a>
                  </div>
                </div>

                {/* Inline embed */}
                {isExpanded && resource.embedUrl && (
                  <div className="border-t border-slate-100">
                    <div className="flex items-center justify-between px-5 py-2 bg-slate-50 border-b border-slate-100">
                      <p className="text-xs text-slate-500">
                        Preview — for editing, use <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline underline-offset-2">Open ↗</a>
                      </p>
                      <button onClick={() => setExpandedId(null)} className="text-xs text-slate-400 hover:text-slate-600">
                        ✕ Close
                      </button>
                    </div>
                    <iframe
                      src={resource.embedUrl}
                      className="w-full"
                      style={{ height: '520px', border: 'none' }}
                      title={resource.title}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Add sheet form */}
          <AddSheetCard onAdd={(r) => setCustomSheets(prev => [...prev, r])} />
        </div>
      </section>

      {/* ── External Tools ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bba-secondary, #b20476)' }}>
          External Tools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {EXTERNAL_TOOLS.map(tool => (
            <a
              key={tool.label}
              href={tool.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition-all hover:shadow-md hover:border-slate-300"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: tool.color }}>
                {tool.label[0]}
              </span>
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{tool.label}</span>
              <svg className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
