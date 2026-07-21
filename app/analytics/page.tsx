import { supabase } from '@/lib/supabase'

export const revalidate = 0

/**
 * QBO-only clients are identified by revenueType (the current truth-of-record
 * for revenue category). The legacy `projectType` column has been superseded —
 * most rows now have projectType = NULL, which is exactly why the previous
 * `.neq('projectType', 'QBO_ONLY')` filter silently returned 0: in Postgres
 * NULL != anything evaluates to NULL, and NULL rows are excluded from a WHERE
 * clause. Filter on revenueType instead.
 */
const QBO_ONLY_REV_TYPES = ['QBO_ONLY_ANCHOR', 'QBO_ONLY_QBO'] as const

async function getStats() {
  try {
    const [total, activeAll, activeQbo] = await Promise.all([
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('archiveStatus', 'ACTIVE'),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('archiveStatus', 'ACTIVE')
        .in('revenueType', QBO_ONLY_REV_TYPES as unknown as string[]),
    ])

    // Log any errors server-side so a schema drift or column rename fails
    // loudly next time instead of silently zeroing out the dashboard.
    if (total.error)     console.error('[Analytics] total query failed:',      total.error)
    if (activeAll.error) console.error('[Analytics] activeAll query failed:',  activeAll.error)
    if (activeQbo.error) console.error('[Analytics] activeQbo query failed:',  activeQbo.error)

    const activeAllCount = activeAll.count ?? 0
    const qboCount       = activeQbo.count ?? 0
    // "Active" = active minus the QBO-only subset, matching how the app treats
    // QBO-only clients elsewhere (see app/api/profitability/route.ts).
    const activeClients  = Math.max(0, activeAllCount - qboCount)

    return {
      totalClients:  total.count ?? 0,
      activeClients,
      qboOnly:       qboCount,
      error:
        total.error?.message ??
        activeAll.error?.message ??
        activeQbo.error?.message ??
        null,
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
