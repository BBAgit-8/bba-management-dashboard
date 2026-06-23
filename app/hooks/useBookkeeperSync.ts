/**
 * useBookkeeperSync
 *
 * Broadcast/subscribe to bookkeeper assignment changes across all pages
 * in the same tab (custom event) and across tabs (storage event).
 *
 * Usage — to broadcast a change after a successful PATCH:
 *   import { broadcastBookkeeperChange } from '@/app/hooks/useBookkeeperSync'
 *   broadcastBookkeeperChange(clientId, newBookkeeperName)
 *
 * Usage — to listen and refetch on any page:
 *   import { useBookkeeperSync } from '@/app/hooks/useBookkeeperSync'
 *   useBookkeeperSync(() => refetch())
 */

const EVENT_KEY = 'bba-bookkeeper-change'

export interface BookkeeperChangePayload {
  clientId: string
  bookkeeper: string | null
  timestamp: number
}

/** Call this after any successful bookkeeper PATCH */
export function broadcastBookkeeperChange(clientId: string, bookkeeper: string | null) {
  const payload: BookkeeperChangePayload = { clientId, bookkeeper, timestamp: Date.now() }

  // Same-tab: custom DOM event
  window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: payload }))

  // Cross-tab: localStorage event
  try {
    localStorage.setItem(EVENT_KEY, JSON.stringify(payload))
    // Immediately remove so next change still fires even if value is same
    setTimeout(() => localStorage.removeItem(EVENT_KEY), 100)
  } catch {}
}

/** Subscribe to bookkeeper changes — calls onChanged whenever any change is broadcast */
import { useEffect } from 'react'

export function useBookkeeperSync(onChanged: (payload: BookkeeperChangePayload) => void) {
  useEffect(() => {
    function handleCustom(e: Event) {
      onChanged((e as CustomEvent<BookkeeperChangePayload>).detail)
    }
    function handleStorage(e: StorageEvent) {
      if (e.key === EVENT_KEY && e.newValue) {
        try { onChanged(JSON.parse(e.newValue)) } catch {}
      }
    }

    window.addEventListener(EVENT_KEY, handleCustom)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(EVENT_KEY, handleCustom)
      window.removeEventListener('storage', handleStorage)
    }
  }, [onChanged])
}
