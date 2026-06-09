import { Client } from 'pg';

export const revalidate = 0; // Force live data fetching every time the page is loaded

export default async function ClientsPage() {
  let clients: any[] = [];

  // 1. Establish the direct connection using your working string parameters
  const client = new Client({
    connectionString: "postgresql://postgres:e2yYAXPEUWpQ9q7w@db.tkhmfexhcdxwtpfiviyo.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1",
    ssl: { rejectUnauthorized: false } // Required for secure connections to Supabase
  });

  try {
    await client.connect();
    // 2. Fetch all client rows directly from your database table via SQL
    const res = await client.query('SELECT * FROM "Client"');
    clients = res.rows;
  } catch (error) {
    console.error("Direct SQL client fetch failed:", error);
  } finally {
    await client.end().catch(() => {});
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Clients Directory</h1>
          <p className="text-sm text-slate-500">Manage your active business client relations.</p>
        </div>
      </div>

      {clients.length === 0 ? (
        /* Render a clean, empty state because your live database table has no rows yet */
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="text-slate-400 text-4xl mb-3">📁</div>
          <h3 className="text-base font-semibold text-slate-900">No clients found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
            Your live Supabase database table is empty. Add a row inside Supabase to see it sync here.
          </p>
        </div>
      ) : (
        /* Render your live table data automatically once records exist */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Name</th>
                <th className="p-4">Company</th>
                <th className="p-4">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {clients.map((item: any) => (
                <tr key={item.id || item.email} className="hover:bg-slate-50/50 transition">
                  <td className="p-4 font-medium text-slate-900">{item.name}</td>
                  <td className="p-4">{item.company || 'N/A'}</td>
                  <td className="p-4">{item.email || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
