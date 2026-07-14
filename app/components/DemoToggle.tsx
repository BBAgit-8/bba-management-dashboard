'use client'

/**
 * DemoToggle — floating bottom-right pill.
 *
 * When OFF: a tiny neutral dot, only visible on hover. Stays out of the way
 *           during regular work but is discoverable.
 * When ON:  a purple pill labelled "DEMO MODE ON" — deliberately obvious so
 *           Dawn never accidentally shows real data thinking it's the demo.
 *
 * Keyboard shortcut: Cmd/Ctrl + Shift + D toggles.
 *
 * Suppressed on /login and /hub (the hub root gate page) because those are
 * pre-auth screens with no data to scrub.
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useDemoMode } from '@/lib/demo-mode'

export default function DemoToggle() {
  const { enabled, toggle } = useDemoMode()
  const pathname = usePathname()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  // Don't render on pre-auth screens
  if (pathname === '/login' || pathname === '/hub') return null

  if (enabled) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Click to exit demo mode (⌘⇧D)"
        className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full bg-bba-action px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg ring-2 ring-white transition hover:bg-purple-800 active:scale-95"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Demo Mode On
      </button>
    )
  }

  // OFF: small dark pill with a label — visible but out of the way
  return (
    <button
      type="button"
      onClick={toggle}
      title="Enable demo mode (⌘⇧D) — scrubs real data for presentations"
      className="group fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-full bg-slate-800/85 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition hover:bg-slate-900 active:scale-95"
    >
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-slate-400" />
      Demo mode
    </button>
  )
}
