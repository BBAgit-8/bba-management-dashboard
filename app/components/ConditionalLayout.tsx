'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import { supabaseClient } from '@/lib/supabaseClient'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isHubRoute   = pathname.startsWith('/hub')
  const isLoginRoute = pathname === '/login'

  const [checking, setChecking] = useState(!isHubRoute && !isLoginRoute)
  const [authed,   setAuthed]   = useState(false)

  useEffect(() => {
    if (isHubRoute || isLoginRoute) return

    supabaseClient.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthed(true)
        setChecking(false)
      } else {
        router.replace('/login')
      }
    })

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!session && !isHubRoute && !isLoginRoute) {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [pathname, isHubRoute, isLoginRoute, router])

  // Hub routes and the login page render their own layout — no management sidebar, no gate
  if (isHubRoute || isLoginRoute) return <>{children}</>

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-bba-action border-t-transparent" />
      </div>
    )
  }

  if (!authed) return null // redirecting

  return (
    <>
      <Sidebar />
      <main
        className="flex min-h-screen flex-col transition-all duration-300"
        style={{ marginLeft: 'var(--sidebar-width, 256px)' }}
      >
        <div className="flex-1 p-8">{children}</div>
      </main>
    </>
  )
}
