"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Attachment {
  id: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  uploadedAt: string
  uploadedBy: string | null
}

interface Props {
  clientId: string
  client: any
  projectCode: string
}

// Debounce hook — waits until the user stops typing before firing the save
function useDebouncedSave(value: string, initial: string, save: (v: string) => Promise<void>, delay = 800) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<NodeJS.Timeout | null>(null)
  const savedTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (value === initial) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setStatus('saving')
      try {
        await save(value)
        setStatus('saved')
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setStatus('idle'), 2000)
      } catch (e) {
        console.error(e)
        setStatus('idle')
      }
    }, delay)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return status
}

function formatBytes(n: number | null): string {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotesTab({ clientId, client, projectCode }: Props) {
  const [context,     setContext]     = useState<string>(client?.clientContext ?? '')
  const [oddNotes,    setOddNotes]    = useState<string>(client?.oddBookkeepingNotes ?? '')
  const [initialCtx]  = useState<string>(client?.clientContext ?? '')
  const [initialOdd]  = useState<string>(client?.oddBookkeepingNotes ?? '')

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [uploading,   setUploading]   = useState(false)
  const [dragOver,    setDragOver]    = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const patchClient = useCallback(async (field: 'clientContext' | 'oddBookkeepingNotes', value: string) => {
    // Use UUID rather than project code — codes like "N/A" contain a slash
    // that breaks Next.js dynamic route matching on the API side.
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (!res.ok) throw new Error(`Failed to save ${field}`)
  }, [clientId])

  const ctxStatus = useDebouncedSave(context,  initialCtx, v => patchClient('clientContext',       v))
  const oddStatus = useDebouncedSave(oddNotes, initialOdd, v => patchClient('oddBookkeepingNotes', v))

  // Load attachments
  const loadAttachments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/attachments`)
      if (res.ok) {
        const j = await res.json()
        setAttachments(j.attachments || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { loadAttachments() }, [loadAttachments])

  const uploadFiles = async (files: FileList | File[]) => {
    setError(null)
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    try {
      for (const file of list) {
        if (file.size > 25 * 1024 * 1024) {
          setError(`${file.name}: over 25 MB limit`)
          continue
        }
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(`/api/clients/${clientId}/attachments`, { method: 'POST', body: form })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError(`${file.name}: ${j.error ?? 'upload failed'}`)
        }
      }
      await loadAttachments()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return
    const res = await fetch(`/api/clients/${clientId}/attachments/${id}`, { method: 'DELETE' })
    if (res.ok) await loadAttachments()
    else setError('Delete failed')
  }

  const download = async (id: string, name: string) => {
    const res = await fetch(`/api/clients/${clientId}/attachments/${id}/download`)
    if (!res.ok) { setError('Download failed'); return }
    const j = await res.json()
    if (j.url) window.open(j.url, '_blank')
  }

  const statusPill = (s: 'idle' | 'saving' | 'saved') => {
    if (s === 'saving') return <span className="text-[11px] text-slate-400">Saving…</span>
    if (s === 'saved')  return <span className="text-[11px] text-green-600">Saved</span>
    return null
  }

  const ta = "w-full min-h-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent resize-y"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Client Context */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 lg:col-span-2">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Client Context</h2>
            <p className="text-xs text-slate-500 mt-0.5">Who they are, what their business is, personality quirks, how they like to work — anything that helps the team serve them well.</p>
          </div>
          {statusPill(ctxStatus)}
        </header>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="e.g. Owner runs a family-owned HVAC business in southern NH. Prefers text over email. Slow to respond first week of the month. Wife handles all financial questions..."
          className={ta}
        />
      </section>

      {/* Odd Bookkeeping Notes */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 lg:col-span-2">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Odd Bookkeeping Notes</h2>
            <p className="text-xs text-slate-500 mt-0.5">Quirks, exceptions, one-off treatments, historical decisions. The stuff a new bookkeeper needs to know before touching this file.</p>
          </div>
          {statusPill(oddStatus)}
        </header>
        <textarea
          value={oddNotes}
          onChange={e => setOddNotes(e.target.value)}
          placeholder="e.g. Owner drawings coded to 'Personal — Owner' regardless of what QBO auto-categorizes. Sales tax remitted quarterly by CPA (do not accrue). Truck payments split 60/40 between two entities..."
          className={ta}
        />
      </section>

      {/* Attachments */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 lg:col-span-2">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Attachments</h2>
            <p className="text-xs text-slate-500 mt-0.5">Reference documents that live with this client. Max 25 MB per file.</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-bba-action text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Add File'}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => e.target.files && uploadFiles(e.target.files)}
          />
        </header>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
            dragOver ? 'border-bba-action bg-purple-50/50 text-bba-action' : 'border-slate-200 text-slate-400'
          }`}
        >
          Drag & drop files here, or click <button onClick={() => fileRef.current?.click()} className="underline text-bba-action">Add File</button>
        </div>

        {/* File list */}
        <div className="mt-4">
          {loading ? (
            <div className="text-xs text-slate-400 text-center py-4">Loading…</div>
          ) : attachments.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-4">No files yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Size</th>
                  <th className="py-2 font-medium">Uploaded</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 text-slate-700 font-medium">{a.fileName}</td>
                    <td className="py-2.5 text-slate-500 tabular-nums">{formatBytes(a.fileSize)}</td>
                    <td className="py-2.5 text-slate-500">{formatDate(a.uploadedAt)}</td>
                    <td className="py-2.5 text-right space-x-3">
                      <button onClick={() => download(a.id, a.fileName)} className="text-bba-action hover:underline text-xs">Download</button>
                      <button onClick={() => remove(a.id, a.fileName)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
