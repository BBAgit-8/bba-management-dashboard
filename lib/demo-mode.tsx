'use client'

/**
 * DEMO MODE
 *
 * Purpose: let Dawn present the app on webinars / to other firm owners without
 * leaking real client, employee, or accountant PII, while keeping structure,
 * enums, hours, and pricing rates intact (Dawn wants to show the pricing model).
 *
 * How it works:
 *   1. A React context stores the on/off flag (persisted in localStorage).
 *   2. On mount we install a wrapper around `window.fetch` that only fires when
 *      the flag is on AND the URL contains `/api/`. It clones the response,
 *      recursively scrubs known-sensitive keys, and returns a fresh Response.
 *   3. Scrubbing is DETERMINISTIC — the same real string always maps to the
 *      same fake string within a browser tab, so the demo story stays coherent
 *      across pages (client "Thornbury" appears as the same fake name on the
 *      List, the Detail, Payroll assignments, Analytics, etc).
 *   4. Turning demo mode off restores real data on the next fetch. To keep
 *      already-in-state values in sync we do a hard reload on toggle — cheap
 *      and eliminates any "stale mixed" states.
 *
 * NOT touched:
 *   - Numbers other than salaries/rates (hours, dates, enums, counts)
 *   - Client billing rates (bookkeepingRate, softwareRate, etc) — Dawn wants
 *     to demo her pricing structure
 *   - IDs used as React keys or foreign keys (keeping app functional)
 *   - Any actual database data — this is a display-only scrub
 */

import { createContext, useContext, useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Fake data pools — big enough that even Dawn's full client list gets unique
// mappings before it starts wrapping around
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_BUSINESS_NAMES = [
  'Riverbend Consulting', 'Oakhaven Legal Group', 'Cascade Ventures',
  'Blackwood Studios', 'Meridian Analytics', 'Silverpine Holdings',
  'Beacon Hill Design', 'Ironwood Contracting', 'Pacific Rim Trading',
  'Northgate Advisors', 'Crestwood Realty', 'Wildflower Wellness',
  'Sundial Media Group', 'Applewood Farms', 'Golden Ridge Auto',
  'Everest Financial', 'Coral Reef Diving Co', 'Timberline Outfitters',
  'Copperfield Bakery', 'Highland Coffee Roasters', 'Emerald City Salon',
  'Lakeside Property Mgmt', 'Milestone Marketing', 'Rustic Table Catering',
  'Steelworks Fabrication', 'Fernwood Landscaping', 'Whitewater Rafting Co',
  'Cornerstone Insurance', 'Twin Peaks Fitness', 'Sundown Distillery',
  'Redwood Physical Therapy', 'Aurora Dental Group', 'Blueprint Architecture',
  'Nightingale Care Services', 'Vineyard Estate Winery', 'Compass Real Estate',
  'Thornhill & Associates', 'Ashford Motors', 'Willow Creek Preschool',
  'Cypress Grove Winery', 'Solstice Yoga Studio', 'Kingfisher Media',
  'Foxglove Botanicals', 'Anchor Point Coffee', 'Marigold Interiors',
  'Blue Ridge Excavation', 'Ember & Oak Restaurant', 'Prairie Wind Ranch',
  'Skyline HVAC', 'Sable Creek Cabins', 'Elmwood Veterinary',
  'Bramblewood Farm', 'Cinder Lane Bakery', 'Driftwood Boutique',
  'Halcyon Days Spa', 'Ivory Coast Imports', 'Jubilee Print Shop',
  'Katahdin Adventure Co', 'Larkspur Floral', 'Monarch Payroll Services',
  'Neptune Marine', 'Osprey Web Design', 'Pinegrove Storage',
  'Quicksilver Delivery', 'Redstone Consulting', 'Sagebrush Ranch',
  'Tidewater Media', 'Umber Studios', 'Vanguard Property',
  'Waypoint Logistics', 'Xanadu Events', 'Yellowstone Gear Co',
  'Zephyr Athletics',
]

const PERSON_NAMES = [
  'Sarah Mitchell', 'Jamie Chen', 'Morgan Reyes', 'Taylor Brooks',
  'Alex Rivera', 'Casey Thompson', 'Jordan Williams', 'Dakota Kim',
  'Riley Foster', 'Avery Bennett', 'Quinn Sullivan', 'Blake Anderson',
  'Cameron Ross', 'Reese Parker', 'Skyler Nguyen', 'Emerson Cole',
  'Hayden Marsh', 'Sage Turner', 'Rowan Bell', 'Finley Ward',
  'Kendall Palmer', 'Peyton Ellis', 'Marlowe Grant', 'Harper Reed',
  'Elliot Vance', 'Robin Delgado', 'Charlie Novak', 'Adrian Pierce',
  'Kai Whitfield', 'Sydney Ortega', 'Devon Blackburn', 'Micah Stevens',
  'Reagan Holloway', 'Emery Barlow', 'Nico Rowland', 'Tatum Meyer',
  'Wren Callahan', 'Auden Kramer', 'Hollis Fenton', 'Story Larkin',
]

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic hash + pool pick — same input → same output, always
// ─────────────────────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function pickFrom<T>(pool: T[], seed: string): T {
  return pool[hashString(seed) % pool.length]
}

// Cache per-real-value so the same input keeps the same output within a session.
// The reverse sets track which fakes are already in use so a new real name walks
// past collisions to the next free slot — guarantees unique-until-pool-exhausted.
const businessNameCache = new Map<string, string>()
const businessNameTaken = new Set<string>()
const personNameCache   = new Map<string, string>()
const personNameTaken   = new Set<string>()
const codeCache         = new Map<string, string>()
const codeTaken         = new Set<string>()

function assignFromPool(pool: string[], seed: string, cache: Map<string, string>, taken: Set<string>): string {
  if (cache.has(seed)) return cache.get(seed)!
  const start = hashString(seed) % pool.length
  for (let step = 0; step < pool.length; step++) {
    const candidate = pool[(start + step) % pool.length]
    if (!taken.has(candidate)) {
      cache.set(seed, candidate)
      taken.add(candidate)
      return candidate
    }
  }
  // Pool exhausted — fall back to indexed variant so we never return undefined
  const fallback = `${pool[start]} ${cache.size + 1}`
  cache.set(seed, fallback)
  taken.add(fallback)
  return fallback
}

function scrubBusinessName(v: string): string {
  if (!v) return v
  return assignFromPool(CLIENT_BUSINESS_NAMES, 'biz:' + v, businessNameCache, businessNameTaken)
}

function scrubPersonName(v: string): string {
  if (!v) return v
  return assignFromPool(PERSON_NAMES, 'person:' + v, personNameCache, personNameTaken)
}

function scrubProjectCode(v: string): string {
  if (!v) return v
  if (codeCache.has(v)) return codeCache.get(v)!
  // 4 uppercase letters, deterministic starting point + linear probe on collision
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let attempt = 0
  while (attempt < 26 * 26 * 26 * 26) {
    const h = hashString('code:' + v) + attempt
    let n = h, out = ''
    for (let i = 0; i < 4; i++) { out += letters[n % 26]; n = Math.floor(n / 26) }
    if (!codeTaken.has(out)) {
      codeCache.set(v, out)
      codeTaken.add(out)
      return out
    }
    attempt++
  }
  // Effectively impossible (456,976 slots), but keep the compiler happy
  codeCache.set(v, v)
  return v
}

function scrubEmail(v: string): string {
  if (!v || !v.includes('@')) return v
  const [, domain] = v.split('@')
  const h = hashString('email:' + v) % 10000
  const safeDomain = domain?.includes('.') ? 'demo.example.com' : 'demo.example.com'
  return `demo${String(h).padStart(4, '0')}@${safeDomain}`
}

function scrubPhone(v: string): string {
  if (!v) return v
  const h = hashString('phone:' + v) % 10000
  return `(555) 010-${String(h).padStart(4, '0')}`
}

function scrubEIN(v: string): string {
  if (!v) return v
  const h = hashString('ein:' + v) % 10000000
  return `99-${String(h).padStart(7, '0')}`
}

function scrubExternalId(prefix: string, v: string): string {
  if (!v) return v
  const h = hashString(prefix + ':' + v).toString(36).toUpperCase().slice(0, 6)
  return `${prefix}-DEMO-${h}`
}

/**
 * Salary jitter — private data.
 * Deterministic ±15% jitter per employee (keyed by their id/name) rounded to
 * nearest $500. Preserves the "salary bands look reasonable" story but any
 * real number is invisible.
 */
function scrubSalary(val: unknown, ctx: any): unknown {
  if (typeof val !== 'number' || val <= 0) return val
  const seed = ctx?.id || ctx?.name || 'default'
  const factor = 0.85 + (hashString('salary:' + seed) % 30) / 100  // 0.85 – 1.14
  return Math.round((val * factor) / 500) * 500
}

function scrubHourlyRate(val: unknown, ctx: any): unknown {
  if (typeof val !== 'number' || val <= 0) return val
  const seed = ctx?.id || ctx?.name || 'default'
  const factor = 0.88 + (hashString('rate:' + seed) % 24) / 100  // 0.88 – 1.11
  return Math.round(val * factor * 2) / 2  // nearest $0.50
}

// ─────────────────────────────────────────────────────────────────────────────
// Object walker — detects "what am I looking at" by shape, then scrubs the
// keys that matter for that type. Recurses into nested objects/arrays.
// ─────────────────────────────────────────────────────────────────────────────

type EntityKind = 'client' | 'employee' | 'accountant' | 'view' | 'other'

function detectKind(obj: any): EntityKind {
  if (!obj || typeof obj !== 'object') return 'other'
  // Employees have a compensation shape that clients + accountants don't
  if ('effectiveHourlyRate' in obj || 'contractedHours' in obj || 'annualSalary' in obj) return 'employee'
  // Clients have harvestProjectCode
  if ('harvestProjectCode' in obj || ('archiveStatus' in obj && 'processingCadence' in obj)) return 'client'
  // Accountants have okToContactAccountant + businessName (person on top of firm)
  if ('okToContactAccountant' in obj || 'hasSecurePortal' in obj) return 'accountant'
  // Saved views (leave alone — user-created labels)
  if ('sharedWithTeam' in obj && 'visibleCols' in obj) return 'view'
  return 'other'
}

function scrubObject(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(scrubObject)
  if (typeof obj !== 'object') return obj

  const kind = detectKind(obj)
  const out: any = {}

  for (const [k, v] of Object.entries(obj)) {
    // ── Names — meaning depends on the containing kind ────────────────────
    if (k === 'name') {
      if (kind === 'client')      { out[k] = typeof v === 'string' ? scrubBusinessName(v) : v; continue }
      if (kind === 'employee')    { out[k] = typeof v === 'string' ? scrubPersonName(v)   : v; continue }
      if (kind === 'accountant')  { out[k] = typeof v === 'string' ? scrubPersonName(v)   : v; continue }
      // Otherwise (tags, generic settings, etc), leave alone
      out[k] = scrubObject(v); continue
    }

    // ── Fields we always scrub regardless of container ───────────────────
    if (k === 'businessName' || k === 'accountantName' || k === 'clientGroupName') {
      out[k] = typeof v === 'string' ? scrubBusinessName(v) : v; continue
    }
    if (k === 'accountantPersonName' || k === 'clientContactName' ||
        k === 'bookkeeper' || k === 'Bookkeeper' || k === 'referredBy') {
      out[k] = typeof v === 'string' ? scrubPersonName(v) : v; continue
    }
    if (k === 'email' || k === 'contactEmail' || k === 'accountantEmail') {
      out[k] = typeof v === 'string' ? scrubEmail(v) : v; continue
    }
    if (k === 'phoneNumber' || k === 'phone' || k === 'accountantPhone') {
      out[k] = typeof v === 'string' ? scrubPhone(v) : v; continue
    }
    if (k === 'harvestProjectCode' || k === 'projectCode') {
      out[k] = typeof v === 'string' ? scrubProjectCode(v) : v; continue
    }
    if (k === 'einNumber') {
      out[k] = typeof v === 'string' ? scrubEIN(v) : v; continue
    }
    if (k === 'qboId')     { out[k] = typeof v === 'string' ? scrubExternalId('QBO', v)  : v; continue }
    if (k === 'clickUpId') { out[k] = typeof v === 'string' ? scrubExternalId('CU',  v)  : v; continue }
    if (k === 'doubleId')  { out[k] = typeof v === 'string' ? scrubExternalId('DBL', v)  : v; continue }
    if (k === 'accountantPortalUrl') {
      out[k] = v ? 'https://portal.example.com/demo' : v; continue
    }

    // ── Free-text notes — redact wholesale ────────────────────────────────
    if (k === 'clientContext' || k === 'oddBookkeepingNotes' || k === 'notes') {
      out[k] = v ? '(Demo notes redacted for presentation)' : v; continue
    }

    // ── Salaries / hourly rates (employee only) ───────────────────────────
    if (kind === 'employee' && (k === 'annualSalary' || k === 'salary')) {
      out[k] = scrubSalary(v, obj); continue
    }
    if (kind === 'employee' && (k === 'hourlyRate' || k === 'effectiveHourlyRate' || k === 'rate')) {
      out[k] = scrubHourlyRate(v, obj); continue
    }

    // ── Default: recurse ─────────────────────────────────────────────────
    out[k] = scrubObject(v)
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch interceptor — installed once, checks a module-level flag on every call
// ─────────────────────────────────────────────────────────────────────────────

// Module-level so the wrapped fetch can read it synchronously without React state
let _demoActive = false

// Same-window guard so hot reload / re-mounts don't stack wrappers
declare global {
  interface Window { __bbaDemoFetchInstalled?: boolean }
}

function installFetchInterceptor() {
  if (typeof window === 'undefined') return
  if (window.__bbaDemoFetchInstalled) return
  window.__bbaDemoFetchInstalled = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await originalFetch(input, init)
    if (!_demoActive) return res

    // Only bother with our own API responses
    let url = ''
    if (typeof input === 'string') url = input
    else if (input instanceof URL) url = input.toString()
    else if (input instanceof Request) url = input.url
    if (!url.includes('/api/')) return res

    if (!res.ok) return res
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return res

    try {
      const body = await res.clone().json()
      const scrubbed = scrubObject(body)
      return new Response(JSON.stringify(scrubbed), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      })
    } catch {
      // If we can't parse or scrub, pass the original through — never break a page
      return res
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React context
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bba.demoMode.v1'

interface DemoModeCtx {
  enabled: boolean
  toggle: () => void
  set: (v: boolean) => void
}

const DemoModeContext = createContext<DemoModeCtx>({
  enabled: false,
  toggle: () => {},
  set: () => {},
})

export function useDemoMode() {
  return useContext(DemoModeContext)
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  // Read initial state synchronously so first render matches storage (avoids
  // a real→fake flash on refresh when demo mode is already on)
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  // Keep the module-level flag in sync so the fetch wrapper sees updates
  useEffect(() => {
    _demoActive = enabled
    try {
      if (enabled) localStorage.setItem(STORAGE_KEY, '1')
      else         localStorage.removeItem(STORAGE_KEY)
    } catch { /* private mode etc — ignore */ }
  }, [enabled])

  // Install once
  useEffect(() => { installFetchInterceptor() }, [])

  // Hard-reload on toggle so any state already fetched in memory gets
  // re-populated through the wrapper in the new mode. Cleaner than trying
  // to teach every screen to refetch.
  function toggle() {
    setEnabled(e => !e)
    setTimeout(() => window.location.reload(), 50)
  }
  function set(v: boolean) {
    setEnabled(v)
    setTimeout(() => window.location.reload(), 50)
  }

  return (
    <DemoModeContext.Provider value={{ enabled, toggle, set }}>
      {children}
    </DemoModeContext.Provider>
  )
}
