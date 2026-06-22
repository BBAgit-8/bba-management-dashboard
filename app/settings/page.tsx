import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings — Management Dashboard' }

const sections = [
  {
    href: '/settings/software-pricing',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Software Pricing',
    description: 'Set monthly prices for QuickBooks tiers and Dext. Used to auto-calculate software rates when adding clients.',
  },
  {
    href: '/settings/pills',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    title: 'Visual Pill Manager',
    description: 'Customize badge labels and colors for project types, revenue types, cadences, and client statuses system-wide.',
  },
  {
    href: '/settings/tags',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    title: 'Client Tags',
    description: 'Create, color, and delete global tags that appear on client cards and dashboard filters.',
  },
]

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[#8a6a90]">Manage global configuration for the dashboard.</p>
      </div>

      <div className="space-y-3">
        {sections.map(s => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-start gap-4 rounded-xl border border-surface-border bg-white p-5 transition-colors hover:bg-purple-50"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#b20476]/20 text-[#b20476] transition-colors group-hover:bg-[#b20476]/30">
              {s.icon}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{s.title}</p>
              <p className="mt-0.5 text-sm text-slate-500">{s.description}</p>
            </div>
            <svg className="ml-auto mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-bba-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
