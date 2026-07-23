'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * useState drop-in that persists its value to localStorage under a fixed key.
 *
 * Use for filter/sort/search state that should survive page navigation and
 * reloads (e.g. "sort clients by name, ascending — remember when I come back").
 *
 * Reads on mount (post-hydration to avoid SSR mismatch), writes on every
 * change. Values must be JSON-serializable — that covers all our filter
 * primitives (strings, booleans, string arrays, Set-as-array).
 *
 * Namespace keys with a page prefix ("profitability.sort") so different pages
 * don't collide.
 */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  // Start with the initial default. We read from localStorage in a post-mount
  // effect so the server and client render match (avoids hydration warnings).
  const [value, setValue] = useState<T>(initial)
  const hydrated = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        setValue(JSON.parse(raw))
      }
    } catch {
      // Corrupt entry — ignore and keep the default
    }
    hydrated.current = true
  }, [key])

  useEffect(() => {
    // Skip the very first render — we haven't loaded from storage yet, so
    // writing would clobber whatever's saved with the default.
    if (!hydrated.current) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage quota / private mode — silently degrade to non-persistent
    }
  }, [key, value])

  return [value, setValue]
}
