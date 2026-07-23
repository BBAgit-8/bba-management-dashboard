'use client'

import { supabaseClient } from '@/lib/supabaseClient'

/**
 * Installs a global window.fetch interceptor that attaches
 * `Authorization: Bearer <jwt>` to every same-origin request to /api/*.
 *
 * This lets us gate every API route server-side without touching the 90+
 * `fetch('/api/...')` call sites scattered throughout the components.
 *
 * Called once from ConditionalLayout on the client. Safe to call more than
 * once — the second call is a no-op.
 */
let installed = false

export function installAuthedFetch() {
  if (typeof window === 'undefined') return
  if (installed) return
  installed = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Figure out the URL we're being asked to fetch
    let urlStr: string
    if (typeof input === 'string') urlStr = input
    else if (input instanceof URL) urlStr = input.toString()
    else urlStr = input.url

    // Only intercept same-origin /api/* requests. Everything else (Harvest,
    // Supabase Auth calls, external CDNs) passes through untouched.
    let isApi = false
    try {
      const u = new URL(urlStr, window.location.origin)
      isApi = u.origin === window.location.origin && u.pathname.startsWith('/api/')
    } catch {
      isApi = false
    }

    if (!isApi) return originalFetch(input, init)

    // Attach the current session's JWT if we have one. If the user isn't
    // logged in, the request goes through without a token and the server
    // returns 401 — which is the correct behavior.
    const { data } = await supabaseClient.auth.getSession()
    const token = data?.session?.access_token

    if (!token) return originalFetch(input, init)

    const headers = new Headers(init?.headers || {})
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return originalFetch(input, { ...init, headers })
  }
}
