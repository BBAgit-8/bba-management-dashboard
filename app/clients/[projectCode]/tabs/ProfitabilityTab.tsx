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
    const empLogs = logs.filter(l => l.employeeId === emp.id);
    const hrs     = empLogs.reduce((sum, l) => sum + l.hoursLogged, 0);
    const cost    = hrs * emp.effectiveHourlyRate;
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
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Net Profitability</p>
          <p className={`mt-2 text-4xl font-bold tracking-tight tabular-nums ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : '−'}${fmt(Math.abs(netProfit))}
          </p>
          <p className={`mt-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {margin.toFixed(1)}% margin
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Revenue</p>
          <p className="mt-2 text-3xl font-bold text-slate-800 tabular-nums">${fmt(revenue)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {sow?.billingType === 'FLAT'
              ? 'Fixed monthly rate'
              : `${totalHours.toFixed(1)} hrs × $${sow?.billingRate}/hr`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total Cost</p>
          <p className="mt-2 text-3xl font-bold text-slate-800 tabular-nums">${fmt(totalCost)}</p>
          <p className="mt-1 text-xs text-slate-400">{totalHours.toFixed(1)} hrs logged this period</p>
        </div>
      </div>

      {/* Visual bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Revenue vs Cost</h3>
        {[
          { label: 'Revenue',    value: revenue,    color: 'bg-purple-500' },
          { label: 'Total Cost', value: totalCost,  color: isPositive ? 'bg-rose-400' : 'bg-red-600' },
        ].map(row => (
          <div key={row.label}>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>{row.label}</span>
              <span className="tabular-nums font-medium text-slate-700">${fmt(row.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                style={{ width: `${revenue > 0 ? Math.min((row.value / revenue) * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
        <div className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
          isPositive ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          Net {isPositive ? 'profit' : 'loss'} of ${fmt(Math.abs(netProfit))} — {margin.toFixed(1)}% margin
        </div>
      </div>

      {/* Employee breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100"
          style={{ backgroundColor: 'var(--bba-primary)' }}>
          <h3 className="text-sm font-semibold text-white">Employee Cost Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Employee', 'Hours Logged', 'Effective Rate', 'Total Cost', '% of Costs'].map(h => (
                <th key={h} className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${h === 'Employee' ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                  No time logs recorded for this client.
                </td>
              </tr>
            ) : employeeRows.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
                      {emp.name.split(' ').map((w: string) => w[0]).join('')}
                    </div>
                    <span className="font-medium text-slate-700">{emp.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">{emp.hrs.toFixed(1)} hrs</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-500">${emp.effectiveHourlyRate}/hr</td>
                <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-700">${fmt(emp.cost)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-500">
                  {totalCost > 0 ? ((emp.cost / totalCost) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
          {employeeRows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Total</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-700">{totalHours.toFixed(1)} hrs</td>
                <td />
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-700">${fmt(totalCost)}</td>
                <td className="px-5 py-3 text-right text-slate-500">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
