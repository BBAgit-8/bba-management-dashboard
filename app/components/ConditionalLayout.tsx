'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHubRoute = pathname.startsWith('/hub')

  // Hub routes render their own layout — no management sidebar
  if (isHubRoute) return <>{children}</>

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
