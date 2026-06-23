'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabaseClient'

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [name, setName] = useState('')

  const isLoginPage = pathname === '/hub'

  useEffect(() => {
    if (isLoginPage) return
    supabaseClient.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/hub'); return }
      const email = data.session.user.email
      const res = await fetch(`/api/hub/me?email=${encodeURIComponent(email ?? '')}`)
      const json = await res.json()
      if (json.name) setName(json.name)
    })
  }, [router, isLoginPage])

  async function handleSignOut() {
    await supabaseClient.auth.signOut()
    router.replace('/hub')
  }

  if (isLoginPage) return <>{children}</>

  const navItems = [
    {
      label: 'My Clients',
      href: '/hub/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-purple-950 border-r border-white/10">
        <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
          <div className="flex h-8 w-8 items-center justify-center">
            <img src="/bba-logo-purple.png" alt="BBA" className="h-8 w-8 object-contain rounded-md" />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#b20476' }}>BBA Client Hub</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/15 ring-1 ring-inset ring-pink-400/40'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                style={active ? { color: '#b20476' } : {}}>
                <span style={{ color: active ? '#b20476' : undefined }}
                  className={active ? '' : 'text-white/40 group-hover:text-white/70'}>
                  {item.icon}
                </span>
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#b20476' }} />}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold"
              style={{ color: '#b20476' }}>
              {name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white/90">{name || 'Loading…'}</p>
              <p className="truncate text-[10px] text-white/50">BBA Team Member</p>
            </div>
          </div>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
