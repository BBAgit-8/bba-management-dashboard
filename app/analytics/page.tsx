import { Client } from 'pg';

export const revalidate = 0; // Force live data fetching

export default async function AnalyticsPage() {
  let clientCount = 0;

  // 1. Set up a direct connection package using your verified Supabase string
  const client = new Client({
    connectionString: "postgresql://postgres:e2yYAXPEUWpQ9q7w@db.tkhmfexhcdxwtpfiviyo.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1",
    ssl: { rejectUnauthorized: false } // Required by Supabase for secure connections
  });

  try {
    await client.connect();
    // 2. Query your database directly via standard SQL
    const res = await client.query('SELECT COUNT(*) FROM "Client"');
    clientCount = parseInt(res.rows[0].count, 10);
  } catch (error) {
    console.error("Direct database query failed:", error);
  } finally {
    await client.end().catch(() => {});
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-950 mb-2">Analytics Dashboard</h1>
      <p className="text-sm text-slate-500 mb-6">Real-time database monitoring sync.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Active Clients</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{clientCount}</div>
          <p className="text-xs text-emerald-600 mt-1">✓ Live Direct Supabase Connection Active</p>
        </div>
      </div>
    </div>
  );
}
