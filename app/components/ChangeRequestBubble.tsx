'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function ChangeRequestBubble() {
  const pathname = usePathname()
  const [open, setOpen]       = useState(false)
  const [title, setTitle]     = useState('')
  const [desc,  setDesc]      = useState('')
  const [status, setStatus]   = useState<Status>('idle')
  const [error,  setError]    = useState<string | null>(null)
  const [openCount, setOpenCount] = useState(0)

  // Refresh open-count when the bubble mounts and whenever we navigate.
  // (Cheap enough — we don't need real-time; a stale count won't hurt.)
  const refreshCount = useCallback(async () => {
    try {
      const r = await fetch('/api/change-requests?status=open', { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        setOpenCount(j.openCount ?? 0)
      }
    } catch { /* silent — the bubble still works */ }
  }, [])

  useEffect(() => { refreshCount() }, [refreshCount, pathname])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function submit() {
    if (!title.trim() || !desc.trim()) return
    setStatus('submitting'); setError(null)
    try {
      const res = await fetch('/api/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim(),
          pageContext: pathname,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      setStatus('success')
      setTitle(''); setDesc('')
      refreshCount()
      setTimeout(() => { setOpen(false); setStatus('idle') }, 1500)
    } catch (e: any) {
      setStatus('error')
      setError(e.message ?? 'Failed to submit')
    }
  }

  return (
    <>
      {/* Bubble button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Submit a change request"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-bba-action text-white shadow-lg hover:opacity-90 hover:scale-105 transition-all"
        style={{ boxShadow: '0 10px 25px -5px rgba(78, 0, 142, 0.4)' }}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {openCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white text-[11px] font-bold text-bba-action ring-2 ring-bba-action px-1">
            {openCount}
          </span>
        )}
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-bba-action text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Change request</h2>
                <p className="text-xs opacity-90 mt-0.5">
                  A note to Dawn / Claude — describe what you want changed or added.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white text-2xl leading-none"
                aria-label="Close"
              >×</button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {status === 'success' ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="rounded-full bg-green-100 p-3">
                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">Request logged</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Short title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Add a Save button to the pods page"
                      maxLength={120}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">What do you want changed?</label>
                    <textarea
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      placeholder="Describe the change. Which page, which button, what it should do differently…"
                      rows={5}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent resize-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Current page (<code className="font-mono bg-slate-100 rounded px-1">{pathname}</code>) will be captured automatically.
                  </p>

                  {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <Link
                      href="/settings/change-requests"
                      onClick={() => setOpen(false)}
                      className="text-xs text-slate-500 hover:text-bba-action underline"
                    >
                      View all requests
                    </Link>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
                      >Cancel</button>
                      <button
                        onClick={submit}
                        disabled={!title.trim() || !desc.trim() || status === 'submitting'}
                        className="rounded-lg bg-bba-action text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
                      >
                        {status === 'submitting' ? 'Sending…' : 'Submit'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
