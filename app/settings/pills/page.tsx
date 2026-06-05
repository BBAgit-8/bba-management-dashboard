'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PillEntry {
  category: string
  key:      string
  label:    string
  color:    string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Default theme values (matches hardcoded maps in ClientDirectory) ───────────

const DEFAULTS: PillEntry[] = [
  // Project Types
  { category: 'projectType', key: 'ANNUAL',              label: 'Annual',                       color: '#3b82f6' },
  { category: 'projectType', key: 'CLEAN_UP',            label: 'Clean Up',                     color: '#f97316' },
  { category: 'projectType', key: 'MONTHLY_MAINTENANCE', label: 'Monthly Maintenance',           color: '#4e008e' },
  { category: 'projectType', key: 'QBO_ONLY',            label: 'QBO Only',                     color: '#0ea5e9' },
  { category: 'projectType', key: 'RECURRING',           label: 'Recurring',                    color: '#14b8a6' },
  // Revenue Types
  { category: 'revenueType', key: 'CLEANUP',                    label: 'Cleanup',                      color: '#f97316' },
  { category: 'revenueType', key: 'FREE',                       label: 'Free',                         color: '#6b7280' },
  { category: 'revenueType', key: 'HOURLY_CLEANUP',             label: 'Hourly Cleanup',               color: '#8b5cf6' },
  { category: 'revenueType', key: 'QBO_ONLY_ANCHOR',            label: 'QBO only - Anchor',            color: '#0ea5e9' },
  { category: 'revenueType', key: 'QBO_ONLY_QBO',               label: 'QBO only - QBO',               color: '#06b6d4' },
  { category: 'revenueType', key: 'RECURRING_MONTHLY_ACH',      label: 'Recurring Monthly - ACH',      color: '#10b981' },
  { category: 'revenueType', key: 'RECURRING_MONTHLY_HOURLY',   label: 'Recurring Monthly - Hourly',   color: '#14b8a6' },
  { category: 'revenueType', key: 'RECURRING_MONTHLY_INVOICED', label: 'Recurring Monthly - Invoiced', color: '#059669' },
  // Processing Cadences
  { category: 'cadence', key: 'WEEKLY',    label: 'Weekly',    color: '#0ea5e9' },
  { category: 'cadence', key: 'BIWEEKLY',  label: 'Bi-Weekly', color: '#8b5cf6' },
  { category: 'cadence', key: 'MONTHLY',   label: 'Monthly',   color: '#4e008e' },
  { category: 'cadence', key: 'QUARTERLY', label: 'Quarterly', color: '#14b8a6' },
  // Client Statuses
  { category: 'clientStatus', key: 'ACTIVE',          label: 'Active',          color: '#b20476' },
  { category: 'clientStatus', key: 'OFF_BOARDING',    label: 'Off-boarding',    color: '#f59e0b' },
  { category: 'clientStatus', key: 'INACTIVE',        label: 'Inactive',        color: '#64748b' },
  { category: 'clientStatus', key: 'ARCHIVED',        label: 'Archived',        color: '#475569' },
  { category: 'clientStatus', key: 'PENDING_ARCHIVE', label: 'Pending Archive', color: '#f97316' },
]

const CATEGORY_META: { key: string; label: string; description: string }[] = [
  { key: 'projectType',  label: 'Project Types',        description: 'Badges shown in the Project Type column on the client dashboard.' },
  { key: 'revenueType',  label: 'Revenue Types',        description: 'Labels shown in the Revenue Type column on the client dashboard.' },
  { key: 'cadence',      label: 'Processing Cadences',  description: 'Frequency pills used in cadence filters and client detail views.' },
  { key: 'clientStatus', label: 'Client Statuses',      description: 'Status pills driven by contract end-date lifecycle logic.' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidHex(v: string) { return /^#[0-9a-fA-F]{6}$/.test(v) }

function mergeWithDefaults(saved: PillEntry[]): PillEntry[] {
  return DEFAULTS.map(def => {
    const override = saved.find(s => s.category === def.category && s.key === def.key)
    return override ?? def
  })
}

// ── Row component ─────────────────────────────────────────────────────────────

function PillRow({
  entry,
  index,
  onChange,
}: {
  entry:    PillEntry
  index:    number
  onChange: (category: string, key: string, field: 'label' | 'color', value: string) => void
}) {
  const validColor = isValidHex(entry.color) ? entry.color : '#888888'

  return (
    <div
      className="flex items-center gap-4 px-5 py-3"
      style={{ backgroundColor: index % 2 === 0 ? '#1e0038' : '#2d0054' }}
    >
      {/* Enum key — readonly identifier */}
      <span className="w-52 shrink-0 font-mono text-[11px] text-[#8050b0]">
        {entry.key}
      </span>

      {/* Label input */}
      <input
        type="text"
        value={entry.label}
        onChange={e => onChange(entry.category, entry.key, 'label', e.target.value)}
        placeholder="Display label"
        maxLength={40}
        className="min-w-0 flex-1 rounded-md border border-[#5020a0] bg-[#1a0030] px-3 py-1.5 text-xs text-white placeholder-white/25 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#b20476]"
      />

      {/* Color picker + hex input */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={validColor}
            onChange={e => onChange(entry.category, entry.key, 'color', e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            title="Pick a color"
          />
          <div
            className="h-7 w-7 rounded-md border-2 border-white/20 shadow-inner"
            style={{ backgroundColor: validColor }}
          />
        </div>
        <input
          type="text"
          value={entry.color}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(entry.category, entry.key, 'color', v)
          }}
          placeholder="#000000"
          maxLength={7}
          spellCheck={false}
          className="w-24 rounded-md border border-[#5020a0] bg-[#1a0030] px-2.5 py-1.5 font-mono text-xs text-white placeholder-white/25 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#b20476]"
          style={{ color: isValidHex(entry.color) ? entry.color : undefined }}
        />
      </div>

      {/* Live preview badge */}
      <div className="w-36 shrink-0">
        <span
          className="inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1"
          style={{
            backgroundColor: `${validColor}22`,
            color:            validColor,
            boxShadow:        `0 0 0 1px ${validColor}50`,
          }}
        >
          {entry.label || entry.key}
        </span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PillManagerPage() {
  const [entries,   setEntries]   = useState<PillEntry[]>(DEFAULTS)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)

  // Fetch any saved overrides from DB on mount and merge with defaults
  useEffect(() => {
    fetch('/api/pill-themes')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.themes) && d.themes.length > 0) {
          setEntries(mergeWithDefaults(d.themes as PillEntry[]))
        }
      })
      .catch(() => { /* DB unavailable — keep defaults */ })
  }, [])

  const updateEntry = useCallback(
    (category: string, key: string, field: 'label' | 'color', value: string) => {
      setEntries(prev =>
        prev.map(e =>
          e.category === category && e.key === key ? { ...e, [field]: value } : e
        )
      )
      setSaveState('idle')
    },
    []
  )

  async function handleSave() {
    // Validate all hex colors before submitting
    const invalid = entries.filter(e => !isValidHex(e.color))
    if (invalid.length > 0) {
      setErrorMsg(`Fix invalid hex colors before saving: ${invalid.map(e => e.key).join(', ')}`)
      return
    }

    setSaveState('saving')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/pill-themes', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ themes: entries }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Save failed')
        setSaveState('error')
        return
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setErrorMsg('Network error — changes not saved')
      setSaveState('error')
      setTimeout(() => setSaveState('error'), 4000)
    }
  }

  function handleReset() {
    setEntries(DEFAULTS)
    setSaveState('idle')
    setErrorMsg(null)
  }

  const saveLabel =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved'  ? '✓ Theme Saved' :
    saveState === 'error'  ? '✗ Save Failed' :
    '💾 Save Visual Theme'

  const saveCls =
    saveState === 'saved'  ? 'bg-emerald-600 hover:bg-emerald-500' :
    saveState === 'error'  ? 'bg-red-700 hover:bg-red-600' :
    saveState === 'saving' ? 'bg-[#b20476]/70 cursor-wait' :
    'bg-[#b20476] hover:bg-[#d00590]'

  return (
    <div className="max-w-5xl space-y-8">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link href="/settings" className="transition-colors hover:text-white/70">Settings</Link>
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-white/60">Visual Pill Manager</span>
      </div>

      {/* ── Page header + sticky save bar ── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visual Pill Manager</h1>
          <p className="mt-1 text-sm text-[#8a6a90]">
            Edit badge labels and brand colors for every pill type used across the dashboard.
            Changes are saved to the database and applied on the next page load.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={handleReset}
            className="rounded-lg border border-[#7020b8]/60 bg-transparent px-4 py-2.5 text-sm font-medium text-white/60 transition-colors hover:border-white/30 hover:text-white"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className={`rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed ${saveCls}`}
          >
            {saveLabel}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </div>
      )}

      {/* ── Category sections ── */}
      {CATEGORY_META.map(cat => {
        const rows = entries.filter(e => e.category === cat.key)
        return (
          <div key={cat.key} className="overflow-hidden rounded-xl border border-[#7020b8]/40 bg-[#2d0050]">

            {/* Card header — auto-styled #b20476 by global CSS (div.border-b:has(> h3)) */}
            <div className="border-b px-5 py-4">
              <h3 className="text-sm font-bold tracking-tight">{cat.label}</h3>
              <p className="mt-0.5 text-[11px] text-white/65">{cat.description}</p>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[208px_1fr_208px_144px] gap-4 border-b border-[#7020b8]/20 bg-[#1a0030] px-5 py-2">
              {['Enum Key', 'Display Label', 'Color', 'Live Preview'].map(h => (
                <span key={h} className="text-[10px] font-bold uppercase tracking-widest text-[#8050b0]">{h}</span>
              ))}
            </div>

            {/* Pill rows */}
            {rows.map((entry, i) => (
              <PillRow key={entry.key} entry={entry} index={i} onChange={updateEntry} />
            ))}
          </div>
        )
      })}

      {/* ── Custom Tags link card ── */}
      <div className="overflow-hidden rounded-xl border border-[#7020b8]/40 bg-[#2d0050]">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-bold tracking-tight">Custom Tags</h3>
          <p className="mt-0.5 text-[11px] text-white/65">
            User-defined tags attached to individual clients — managed separately.
          </p>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <p className="text-sm text-white/60">
            Create, rename, recolor, or delete custom client tags from the Tags settings page.
          </p>
          <Link
            href="/settings/tags"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#b20476]/20 px-4 py-2 text-xs font-semibold text-[#f060c0] transition-colors hover:bg-[#b20476]/35"
          >
            Manage Tags
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Bottom save button ── */}
      <div className="flex items-center justify-end gap-3 border-t border-[#7020b8]/30 pt-6">
        <p className="mr-auto text-xs text-white/35">
          {entries.length} pill entries across {CATEGORY_META.length} categories
        </p>
        <button
          onClick={handleReset}
          className="rounded-lg border border-[#7020b8]/60 bg-transparent px-4 py-2.5 text-sm font-medium text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          Reset Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className={`rounded-lg px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed ${saveCls}`}
        >
          {saveLabel}
        </button>
      </div>

    </div>
  )
}
