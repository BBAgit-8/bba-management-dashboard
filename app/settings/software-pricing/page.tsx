'use client'

import { useState, useEffect } from 'react'

type Setting = { key: string; value: string; label: string }

const SETTING_KEYS = [
  { key: 'qbo_simple_start', label: 'QuickBooks Simple Start', prefix: '$' },
  { key: 'qbo_essentials',   label: 'QuickBooks Essentials',   prefix: '$' },
  { key: 'qbo_plus',         label: 'QuickBooks Plus',         prefix: '$' },
  { key: 'qbo_advanced',     label: 'QuickBooks Advanced',     prefix: '$' },
  { key: 'dext',             label: 'Double Receipts',         prefix: '$' },
]

export default function SoftwarePricingPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [draft,    setDraft]    = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setSettings(d.map ?? {})
        setDraft(d.map ?? {})
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const isDirty = SETTING_KEYS.some(s => draft[s.key] !== settings[s.key])

  async function handleSave(applyToClients = false) {
    setSaving(true); setError(null); setSaved(false)
    const updates = SETTING_KEYS
      .filter(s => draft[s.key] !== settings[s.key])
      .map(s => ({ key: s.key, value: draft[s.key] ?? '' }))

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Save failed')
    } else {
      if (applyToClients) {
        // Build old→new price map for changed settings
        const priceChanges = updates
          .filter(u => settings[u.key] && draft[u.key] && settings[u.key] !== draft[u.key])
          .map(u => ({ oldPrice: parseFloat(settings[u.key]), newPrice: parseFloat(draft[u.key]) }))
          .filter(c => !isNaN(c.oldPrice) && !isNaN(c.newPrice))

        if (priceChanges.length > 0) {
          const r2 = await fetch('/api/settings/apply-software-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceChanges }),
          })
          const j2 = await r2.json()
          if (!r2.ok) setError(j2.error ?? 'Price update failed')
          else setApplyResult(j2.updated ?? 0)
        }
      }
      setSettings({ ...draft })
      setSaved(true)
      setTimeout(() => { setSaved(false); setApplyResult(null) }, 5000)
    }
    setSaving(false)
  }

  function handleReset() {
    setDraft({ ...settings })
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Software Pricing</h1>
        <p className="mt-1 text-sm text-slate-500">
          These prices are used to auto-calculate software rates and monthly billing when adding clients.
          Update them here whenever subscription costs change.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* QuickBooks section */}
          <div className="px-5 py-3 border-b border-slate-100" style={{ backgroundColor: 'var(--bba-primary)' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-white">QuickBooks Online Tiers</p>
          </div>
          <div className="divide-y divide-slate-100">
            {SETTING_KEYS.slice(0, 4).map(s => (
              <PriceRow key={s.key} label={s.label}
                value={draft[s.key] ?? ''}
                onChange={v => setDraft(d => ({ ...d, [s.key]: v }))}
              />
            ))}
          </div>

          {/* Other software */}
          <div className="px-5 py-3 border-t border-b border-slate-100" style={{ backgroundColor: 'var(--bba-primary)' }}>
            <p className="text-xs font-bold uppercase tracking-widest text-white">Other Software</p>
          </div>
          <div className="divide-y divide-slate-100">
            {SETTING_KEYS.slice(4).map(s => (
              <PriceRow key={s.key} label={s.label}
                value={draft[s.key] ?? ''}
                onChange={v => setDraft(d => ({ ...d, [s.key]: v }))}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-700">
            ✓ Prices saved.{applyResult !== null ? ` Updated softwareRate on ${applyResult} client${applyResult !== 1 ? 's' : ''}.` : ''}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => handleSave(false)} disabled={saving || !isDirty || loading}
          className="rounded-lg bg-bba-primary px-5 py-2 text-sm font-semibold text-white hover:bg-bba-primary/85 transition-colors disabled:opacity-50 flex items-center gap-2">
          {saving && <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving || !isDirty || loading}
          className="rounded-lg border border-purple-300 bg-purple-50 px-5 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50">
          Save + Update Existing Clients
        </button>
        {isDirty && (
          <button onClick={handleReset} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            Reset
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400">"Save + Update Existing Clients" will update the softwareRate on any client whose current rate matches one of the old prices.</p>
    </div>
  )
}

function PriceRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-slate-700 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-slate-400">$</span>
        <input
          type="number" min={0} step="0.01"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-right text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <span className="text-xs text-slate-400">/mo</span>
      </div>
    </div>
  )
}
