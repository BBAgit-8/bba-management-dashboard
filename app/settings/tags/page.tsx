'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TAGS } from '@/lib/mock-data'
import type { Tag } from '@/lib/mock-data'

const PRESET_COLORS = [
  '#4e008e', '#b20476', '#d4bebe', '#EF4444',
  '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
]

export default function TagSettingsPage() {
  const [tags,     setTags]     = useState<Tag[]>(TAGS)
  const [name,     setName]     = useState('')
  const [color,    setColor]    = useState(PRESET_COLORS[0])
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tags')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.tags)) setTags(d.tags) })
      .catch(() => { /* DB not available — keep mock data */ })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create tag'); return }
      setTags(prev => [...prev, data.tag].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setDeleting(id); setError(null)
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const d = await res.json()
        setError(d.error ?? 'Failed to delete tag')
        return
      }
      setTags(prev => prev.filter(t => t.id !== id))
    } catch { setError('Network error') }
    finally { setDeleting(null) }
  }

  return (
    <div className="max-w-xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link href="/settings" className="transition-colors hover:text-white/70">Settings</Link>
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-white/60">Client Tags</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Client Tags</h1>
        <p className="mt-1 text-sm text-[#8a6a90]">Tags appear on client cards, filter pills, and the Add Client form.</p>
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-[#7020b8]/40 bg-[#2d0050] p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Create New Tag</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/60">Tag Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. High Priority"
              className="w-full rounded-lg border border-[#5020a0] bg-[#1a0030] px-3 py-2 text-sm text-white placeholder-white/25 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#b20476]"
              maxLength={32}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-white/60">Color</label>
            <div className="flex flex-wrap items-center gap-3">
              {PRESET_COLORS.map(c => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid white` : undefined,
                    outlineOffset: color === c ? '2px' : undefined,
                  }}
                  title={c}
                />
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent"
                  title="Custom color"
                />
                <span className="font-mono text-xs text-white/50">{color}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-white/40">Preview:</span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}50` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                {name || 'Tag Name'}
              </span>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit" disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#b20476] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d00590] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {saving ? 'Creating…' : 'Create Tag'}
          </button>
        </form>
      </div>

      {/* Existing tags */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">
          Existing Tags <span className="ml-1.5 text-xs font-normal text-white/40">({tags.length})</span>
        </h2>
        {tags.length === 0 ? (
          <p className="text-sm text-white/40">No tags yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between rounded-lg border border-[#7020b8]/40 bg-[#2d0050] px-4 py-3">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
                <button
                  onClick={() => handleDelete(tag.id)}
                  disabled={deleting === tag.id}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-white/40 transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:opacity-40"
                >
                  {deleting === tag.id ? 'Deleting…' : '✕ Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
