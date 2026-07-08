'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Pod = { id: string; name: string; createdAt?: string }

export default function PodsSettingsPage() {
  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/pods', { cache: 'no-store' })
    const j = await r.json()
    setPods(j.pods ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    const r = await fetch('/api/pods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setBusy(false)
    if (r.ok) { setNewName(''); load() }
    else { const j = await r.json().catch(() => ({})); alert(j.error ?? 'Failed to create') }
  }

  const saveEdit = async (id: string) => {
    const name = editingName.trim()
    if (!name || busy) return
    setBusy(true)
    const r = await fetch('/api/pods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    })
    setBusy(false)
    if (r.ok) { setEditingId(null); setEditingName(''); load() }
    else { const j = await r.json().catch(() => ({})); alert(j.error ?? 'Failed to save') }
  }

  const del = async (p: Pod) => {
    if (!confirm(
      `Delete pod "${p.name}"?\n\nAll employees and clients assigned to it will be unassigned. This can't be undone.`
    )) return
    setBusy(true)
    const r = await fetch(`/api/pods?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' })
    setBusy(false)
    if (r.ok) load()
    else { const j = await r.json().catch(() => ({})); alert(j.error ?? 'Failed to delete') }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-[#b20476] hover:underline">← Back to Settings</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pods</h1>
        <p className="mt-1 text-sm text-[#8a6a90]">
          Pods are groups of employees who share responsibility for a set of clients.
          Employees are assigned to pods on their profile; clients are assigned on the Employee Planning page.
        </p>
      </div>

      <div className="rounded-xl border border-surface-border bg-white p-5 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Create a new pod</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
            placeholder="e.g. Pod 2"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#4e008e] focus:outline-none focus:ring-1 focus:ring-[#4e008e]"
          />
          <button
            onClick={create}
            disabled={!newName.trim() || busy}
            className="rounded-md bg-[#4e008e] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d006e] disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-surface-border bg-white overflow-hidden">
        <div className="border-b border-surface-border px-5 py-3 text-sm font-semibold text-slate-800">
          Existing pods ({pods.length})
        </div>
        {loading ? (
          <div className="p-5 text-sm text-slate-500">Loading…</div>
        ) : pods.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No pods yet. Create one above.</div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {pods.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                {editingId === p.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(p.id) }}
                      autoFocus
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-[#4e008e] focus:outline-none focus:ring-1 focus:ring-[#4e008e]"
                    />
                    <button
                      onClick={() => saveEdit(p.id)}
                      disabled={busy}
                      className="rounded bg-[#4e008e] px-3 py-1 text-xs font-medium text-white hover:bg-[#3d006e] disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditingName('') }}
                      className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-800">{p.name}</span>
                    <button
                      onClick={() => { setEditingId(p.id); setEditingName(p.name) }}
                      className="text-xs text-[#b20476] hover:underline"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => del(p)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
