import { prisma } from '@/lib/prisma'

export const revalidate = 0

async function getStats() {
  try {
    const [totalClients, activeClients, qboOnly] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { archiveStatus: 'ACTIVE', qboOnly: false } }),
      prisma.client.count({ where: { qboOnly: true } }),
    ])
    return { totalClients, activeClients, qboOnly, error: null }
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
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          Database error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[
          { label: 'Total Clients',     value: totalClients },
          { label: 'Active Clients',    value: activeClients },
          { label: 'QBO Only Clients',  value: qboOnly },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border p-6" style={{ backgroundColor: '#2d0050', borderColor: 'rgba(212,190,190,0.18)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(212,190,190,0.6)' }}>{stat.label}</p>
            <p className="mt-2 text-4xl font-bold text-white tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
