"use client";

import { SOWS, TIME_LOGS, EMPLOYEES } from "@/lib/mock-data";

interface Props { clientId: string }

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProfitabilityTab({ clientId }: Props) {
  const sow        = SOWS.find(s => s.clientId === clientId);
  const logs       = TIME_LOGS.filter(l => l.clientId === clientId);
  const totalHours = logs.reduce((sum, l) => sum + l.hoursLogged, 0);

  const revenue =
    sow?.billingType === 'FLAT'
      ? (sow.fixedMonthlyRate ?? 0)
      : totalHours * (sow?.billingRate ?? 0);

  const employeeRows = EMPLOYEES.map(emp => {
    const empLogs    = logs.filter(l => l.employeeId === emp.id);
    const hrs        = empLogs.reduce((sum, l) => sum + l.hoursLogged, 0);
    const cost       = hrs * emp.effectiveHourlyRate;
    return { ...emp, hrs, cost };
  }).filter(e => e.hrs > 0);

  const totalCost  = employeeRows.reduce((sum, e) => sum + e.cost, 0);
  const netProfit  = revenue - totalCost;
  const margin     = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const isPositive = netProfit >= 0;

  return (
    <div className="space-y-6">
      {/* Hero metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Net Profitability */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Net Profitability</p>
          <p className={`mt-2 text-4xl font-bold tracking-tight tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : '−'}${fmt(Math.abs(netProfit))}
          </p>
          <p className={`mt-1 text-xs font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {margin.toFixed(1)}% margin
          </p>
        </div>

        {/* Revenue */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Revenue</p>
          <p className="mt-2 text-3xl font-bold text-slate-100 tabular-nums">${fmt(revenue)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {sow?.billingType === 'FLAT'
              ? 'Fixed monthly rate'
              : `${totalHours.toFixed(1)} hrs × $${sow?.billingRate}/hr`}
          </p>
        </div>

        {/* Total Cost */}
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Total Cost</p>
          <p className="mt-2 text-3xl font-bold text-slate-100 tabular-nums">${fmt(totalCost)}</p>
          <p className="mt-1 text-xs text-slate-500">{totalHours.toFixed(1)} hrs logged this period</p>
        </div>
      </div>

      {/* Visual bar */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Revenue vs Cost</h3>
        {[
          { label: 'Revenue', value: revenue, total: revenue, color: 'bg-bba-primary' },
          { label: 'Total Cost', value: totalCost, total: revenue, color: isPositive ? 'bg-rose-500' : 'bg-red-600' },
        ].map(row => (
          <div key={row.label}>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{row.label}</span>
              <span className="tabular-nums">${fmt(row.value)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                style={{ width: `${row.total > 0 ? Math.min((row.value / row.total) * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
        <div className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          Net {isPositive ? 'profit' : 'loss'} of ${fmt(Math.abs(netProfit))} — {margin.toFixed(1)}% margin
        </div>
      </div>

      {/* Employee breakdown */}
      <div className="rounded-xl border border-slate-700/60 overflow-hidden">
        <div className="border-b border-slate-700/60 bg-slate-800/60 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-200">Employee Cost Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bba-primary)', borderBottom: '1px solid rgba(78,0,142,0.3)' }}>
              {['Employee', 'Hours Logged', 'Effective Rate', 'Total Cost', '% of Costs'].map(h => (
                <th key={h} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider ${h === 'Employee' ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {employeeRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No time logs recorded for this client.</td>
              </tr>
            ) : employeeRows.map(emp => (
              <tr key={emp.id} className="bg-slate-900/50 hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-300">
                      {emp.name.split(' ').map((w: string) => w[0]).join('')}
                    </div>
                    <span className="font-medium text-slate-200">{emp.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-300">{emp.hrs.toFixed(1)} hrs</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-400">${emp.effectiveHourlyRate}/hr</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-200">${fmt(emp.cost)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-400">
                  {totalCost > 0 ? ((emp.cost / totalCost) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
          {employeeRows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-700/60 bg-slate-800/30">
                <td className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Total</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-200">{totalHours.toFixed(1)} hrs</td>
                <td />
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-200">${fmt(totalCost)}</td>
                <td className="px-5 py-3 text-right text-slate-500">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
