'use client'

import { useState, useEffect, useMemo } from 'react'

// ─────────────────────────────────────────────────────────────────────
// Fixed QBO tier keys. These live in the settings table but are rendered
// as a dedicated section because they drive the tier picker on the
// client form (not a "check to add" catalog item).
// ─────────────────────────────────────────────────────────────────────
const QBO_TIER_KEYS = [
  { key: 'qbo_simple_start', label: 'QuickBooks Simple Start' },
  { key: 'qbo_essentials',   label: 'QuickBooks Essentials'   },
  { key: 'qbo_plus',         label: 'QuickBooks Plus'         },
  { key: 'qbo_advanced',     label: 'QuickBooks Advanced'     },
] as const

// A catalog row is any setting whose key starts with "software." OR is
// the legacy "dext" key (Double Receipts). Keeping "dext" as-is avoids
// breaking existing clients that reference it in AddClientPanel.
function isCatalogKey(k: string): boolean {
  return k === 'dext' || k.startsWith('software.')
}

// Turn a display label into a URL-safe slug: "Bill.com" → "bill_com"
function slugify(s: string): string {
  return s.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

type Setting = { key: string; value: string; label: string | null }

export default function SoftwarePricingPage() {
  // Full settings state, keyed by settings key
  const [rows, setRows]       = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [msg, setMsg]         = useState<string | null>(null)

  // Drafts for existing rows (uncommitted edits): key → { value, label }
  const [drafts, setDrafts] = useState<Record<string, { value: string; label: string }>>({})

  // "Add new software" form state
  const [newLabel, setNewLabel] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [adding, setAdding] = useState(false)

  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/settings', { cache: 'no-store' })
      const j = await r.json()
      const list: Setting[] = j.settings ?? []
      setRows(list)
      const d: Record<string, { value: string; label: string }> = {}
      for (const s of list) d[s.key] = { value: s.value ?? '', label: s.label ?? '' }
      setDrafts(d)
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const qboRows = QBO_TIER_KEYS.map(t => ({
    key: t.key,
    // If DB has a label, prefer that; otherwise use our hardcoded label.
    label: (rows.find(r => r.key === t.key)?.label) || t.label,
  }))
  const catalogRows = useMemo(
    () => rows
      .filter(r => isCatalogKey(r.key))
      .sort((a, b) => (a.label ?? a.key).localeCompare(b.label ?? b.key)),
    [rows]
  )

  const isDirty = useMemo(() => rows.some(r => {
    const d = drafts[r.key]
    if (!d) return false
    return d.value !== (r.value ?? '') || d.label !== (r.label ?? '')
  }), [rows, drafts])

  // ── Save all uncommitted edits (both QBO + catalog) ─────────────────
  async function handleSave(applyToClients = false) {
    if (busy) return
    setBusy(true); setError(null); setMsg(null)
    const updates = rows
      .filter(r => {
        const d = drafts[r.key]; if (!d) return false
        return d.value !== (r.value ?? '') || d.label !== (r.label ?? '')
      })
      .map(r => ({ key: r.key, value: drafts[r.key].value, label: drafts[r.key].label || null }))

    if (updates.length === 0) { setBusy(false); return }

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const j = await res.json()
    if (!res.ok) { setError(j.error ?? 'Save failed'); setBusy(false); return }

    let updatedClients: number | null = null
    if (applyToClients) {
      // Only price changes propagate to existing clients (label edits don't).
      const priceChanges = updates
        .map(u => {
          const orig = rows.find(r => r.key === u.key)?.value
          const oldP = parseFloat(orig ?? '')
          const newP = parseFloat(u.value ?? '')
          return { oldPrice: oldP, newPrice: newP }
        })
        .filter(c => !isNaN(c.oldPrice) && !isNaN(c.newPrice) && c.oldPrice !== c.newPrice)
      if (priceChanges.length > 0) {
        const r2 = await fetch('/api/settings/apply-software-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceChanges }),
        })
        const j2 = await r2.json()
        if (r2.ok) updatedClients = j2.updated ?? 0
      }
    }
    setMsg(`Saved.${updatedClients !== null ? ` Updated softwareRate on ${updatedClients} client${updatedClients !== 1 ? 's' : ''}.` : ''}`)
    setBusy(false)
    await load()
    setTimeout(() => setMsg(null), 5000)
  }

  // ── Add a new catalog item ──────────────────────────────────────────
  async function handleAdd() {
    if (busy) return
    const label = newLabel.trim()
    const price = newPrice.trim()
    if (!label) { setError('Name required'); return }
    if (!price || isNaN(parseFloat(price))) { setError('Price must be a number'); return }
    setBusy(true); setError(null); setMsg(null)
    const key = `software.${slugify(label)}`
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: price, label }),
    })
    const j = await res.json()
    if (!res.ok) { setError(j.error ?? 'Add failed'); setBusy(false); return }
    setNewLabel(''); setNewPrice(''); setAdding(false)
    setMsg(`Added "${label}".`)
    setBusy(false)
    await load()
    setTimeout(() => setMsg(null), 5000)
  }

  // ── Delete a catalog item ───────────────────────────────────────────
  async function handleDelete(key: string, label: string) {
    if (busy) return
    if (!confirm(`Delete "${label}" from the software catalog?\n\nExisting clients using this software will still have it on their record — this only removes it from the picker for new clients.`)) return
    setBusy(true); setError(null); setMsg(null)
    const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error ?? 'Delete failed'); setBusy(false); return }
    setMsg(`Deleted "${label}".`)
    setBusy(false)
    await load()
    setTimeout(() => setMsg(null), 5000)
  }

  function setDraft(key: string, patch: Partial<{ value: string; label: string }>) {
    setDrafts(d => ({ ...d, [key]: { value: d[key]?.value ?? '', label: d[key]?.label ?? '', ...patch } }))
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Software Pricing</h1>
        <p className="mt-1 text-sm text-slate-500">
          These prices auto-populate on the client form when adding a new client.
          Update them here whenever subscription costs change.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* ── QuickBooks tiers (fixed) ────────────────────────────── */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: 'var(--bba-primary)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-white">QuickBooks Online Tiers</p>
            </div>
            <div className="divide-y divide-slate-100">
              {qboRows.map(s => (
                <PriceRow
                  key={s.key}
                  label={s.label}
                  value={drafts[s.key]?.value ?? ''}
                  onChange={v => setDraft(s.key, { value: v })}
                />
              ))}
            </div>
          </section>

          {/* ── Additional software catalog (dynamic) ──────────────── */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--bba-primary)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-white">Additional Software</p>
              {!adding && (
                <button
                  type="button"
                  onClick={() => { setAdding(true); setError(null) }}
                  className="rounded-md bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 text-xs font-semibold transition-colors">
                  + Add Software
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {catalogRows.length === 0 && !adding && (
                <p className="px-5 py-4 text-xs text-slate-400 italic">
                  No additional software yet — click Add Software to include Double Receipts, Gusto, Bill.com, etc.
                </p>
              )}
              {catalogRows.map(s => (
                <CatalogRow
                  key={s.key}
                  labelDraft={drafts[s.key]?.label ?? s.label ?? ''}
                  valueDraft={drafts[s.key]?.value ?? ''}
                  onLabelChange={v => setDraft(s.key, { label: v })}
                  onValueChange={v => setDraft(s.key, { value: v })}
                  onDelete={() => handleDelete(s.key, s.label ?? s.key)}
                  slug={s.key}
                />
              ))}
              {adding && (
                <div className="px-5 py-3.5 bg-purple-50/50 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      autoFocus
                      type="text"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      placeholder="Software name (e.g. Gusto)"
                      className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-400">$</span>
                      <input
                        type="number" min={0} step="0.01"
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-right text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent"
                      />
                      <span className="text-xs text-slate-400">/mo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={busy || !newLabel.trim() || !newPrice.trim()}
                      className="rounded-lg bg-bba-action text-white px-3 py-1.5 text-xs font-semibold hover:bg-bba-action/85 disabled:opacity-50 transition-colors">
                      {busy ? 'Adding…' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setAdding(false); setNewLabel(''); setNewPrice(''); setError(null) }}
                      className="rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-1.5 transition-colors">
                      Cancel
                    </button>
                    {newLabel.trim() && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        key: software.{slugify(newLabel)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {msg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-700">✓ {msg}</p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => handleSave(false)}
          disabled={busy || !isDirty || loading}
          className="rounded-lg bg-bba-action px-5 py-2 text-sm font-semibold text-white hover:bg-bba-action/85 transition-colors disabled:opacity-50">
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={busy || !isDirty || loading}
          className="rounded-lg border border-purple-300 bg-purple-50 px-5 py-2 text-sm font-semibold text-bba-action hover:bg-purple-100 transition-colors disabled:opacity-50">
          Save + Update Existing Clients
        </button>
      </div>
      <p className="text-xs text-slate-400">
        "Save + Update Existing Clients" propagates price changes to any client whose current softwareRate matches the old prices.
        Label changes and new/deleted items do not affect existing clients.
      </p>
    </div>
  )
}

// ── Row for fixed QBO tiers: label read-only, value editable ───────────
function PriceRow({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-slate-700 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-slate-400">$</span>
        <input
          type="number" min={0} step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-right text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent"
        />
        <span className="text-xs text-slate-400">/mo</span>
      </div>
    </div>
  )
}

// ── Row for catalog items: label + value editable, delete button ─────────
function CatalogRow({ labelDraft, valueDraft, onLabelChange, onValueChange, onDelete, slug }: {
  labelDraft: string
  valueDraft: string
  onLabelChange: (v: string) => void
  onValueChange: (v: string) => void
  onDelete: () => void
  slug: string
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <input
        type="text"
        value={labelDraft}
        onChange={e => onLabelChange(e.target.value)}
        placeholder="(no name)"
        className="flex-1 min-w-0 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-200 px-2 py-1.5 text-sm text-slate-700 font-medium bg-transparent focus:outline-none focus:ring-2 focus:ring-bba-action focus:bg-white"
        title={`Setting key: ${slug}`}
      />
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-slate-400">$</span>
        <input
          type="number" min={0} step="0.01"
          value={valueDraft}
          onChange={e => onValueChange(e.target.value)}
          className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-right text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-bba-action focus:border-transparent"
        />
        <span className="text-xs text-slate-400">/mo</span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        title="Delete this software from the catalog"
        className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
        </svg>
      </button>
    </div>
  )
}
