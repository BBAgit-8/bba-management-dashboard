import { supabase } from '@/lib/supabase'

export const revalidate = 0

async function getStats() {
  try {
    const [total, active, qbo] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('archive_status', 'ACTIVE').eq('qbo_only', false),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('qbo_only', true),
    ])
    return {
      totalClients:  total.count  ?? 0,
      activeClients: active.count ?? 0,
      qboOnly:       qbo.count    ?? 0,
      error: null,
    }
  } catch (err) {
    return { totalClients: 0, activeClients: 0, qboOnly: 0, error: String(err) }
  }
}

export default async function AnalyticsPage() {
  const { totalClients, activeClients, qboOnly, error } = await getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">Real-time metrics from your database.</p>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          Database error: {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[
          { label: 'Active Clients',   value: activeClients },
          { label: 'QBO Only Clients', value: qboOnly       },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-surface-border bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{stat.label}</p>
            <p className="mt-2 text-4xl font-bold text-bba-primary tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
