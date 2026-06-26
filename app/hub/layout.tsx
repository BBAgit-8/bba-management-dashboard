'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabaseClient'

type ClientView = {
  id:             string
  name:           string
  sharedWithTeam: boolean
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [name,   setName]   = useState('')
  const [views,  setViews]  = useState<ClientView[]>([])

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
    // Load shared views
    fetch('/api/views')
      .then(r => r.json())
      .then(d => {
        const shared = (d.views ?? []).filter((v: ClientView) => v.sharedWithTeam)
        setViews(shared)
      })
      .catch(() => {})
  }, [router, isLoginPage])

  async function handleSignOut() {
    await supabaseClient.auth.signOut()
    router.replace('/hub')
  }

  if (isLoginPage) return <>{children}</>

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  const mainNav = [
    {
      label: 'My Clients',
      href:  '/hub/dashboard',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  function NavItem({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          active
            ? 'bg-white/15 text-bba-highlight ring-1 ring-inset ring-bba-highlight/40'
            : 'text-[#eae6e5]/80 hover:bg-white/10 hover:text-[#eae6e5]'
        }`}>
        <span className={active ? 'text-bba-highlight' : 'text-white/40 group-hover:text-white/80'}>
          {icon}
        </span>
        <span className="whitespace-nowrap truncate">{label}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-bba-highlight" />}
      </Link>
    )
  }

  // View icon
  const viewIcon = (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M4 6h16M4 10h16M4 14h8" />
    </svg>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-bba-primary border-r border-white/10">

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-white/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bba-highlight">
            <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-wide text-[#eae6e5] truncate">
            BBA Client Hub
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Main Menu
          </p>

          {mainNav.map(item => (
            <NavItem key={item.href} label={item.label} href={item.href} icon={item.icon} />
          ))}

          {/* Views section — only shown if there are shared views */}
          {views.length > 0 && (
            <>
              <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Views
              </p>
              {views.map(v => (
                <NavItem key={v.id} label={v.name} href={`/hub/views/${v.id}`} icon={viewIcon} />
              ))}
            </>
          )}
        </nav>

        {/* Bottom — sign out + user */}
        <div className="border-t border-white/10 px-3 py-4 space-y-0.5">
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#eae6e5]/80 hover:bg-white/10 hover:text-[#eae6e5] transition-colors">
            <span className="text-white/40">
              <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
            Sign out
          </button>

          <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white/90">{name || 'Loading…'}</p>
              <p className="truncate text-[10px] text-white/50">BBA Team Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
