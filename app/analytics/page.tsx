import Link from "next/link";
import { CLIENTS, SOWS, TIME_LOGS, EMPLOYEES } from "@/lib/mock-data";

// ── Server-side aggregate functions ──────────────────────────────────────────

function r2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface ClientRow {
  name:      string;
  code:      string;
  revenue:   number;
  laborCost: number;
  netProfit: number;
}

function computeLeaderboards() {
  const rows: ClientRow[] = CLIENTS.map(client => {
    const sow = SOWS.find(s => s.clientId === client.id);

    const revenue = sow
      ? sow.billingType === "FLAT"
        ? r2(sow.fixedMonthlyRate ?? 0)
        : r2((sow.targetHours ?? 0) * (sow.billingRate ?? 0))
      : 0;

    const laborCost = r2(
      TIME_LOGS
        .filter(l => l.clientId === client.id)
        .reduce((sum, log) => {
          const emp = EMPLOYEES.find(e => e.id === log.employeeId);
          return sum + log.hoursLogged * (emp?.effectiveHourlyRate ?? 0);
        }, 0)
    );

    return { name: client.name, code: client.harvestProjectCode, revenue, laborCost, netProfit: r2(revenue - laborCost) };
  });

  // Card A — top 10 by gross contract revenue, high → low
  const topRevenue = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Card B — top 10 by net profit dollar amount, high → low
  const topProfit = [...rows].sort((a, b) => b.netProfit - a.netProfit).slice(0, 10);

  // Card C — bottom 10 by net profit dollar amount, low → high (worst first)
  const bottomProfit = [...rows].sort((a, b) => a.netProfit - b.netProfit).slice(0, 10);

  // Portfolio KPIs
  const grossMRR       = r2(rows.reduce((s, r) => s + r.revenue,   0));
  const totalLaborCost = r2(rows.reduce((s, r) => s + r.laborCost, 0));
  const netPortfolio   = r2(grossMRR - totalLaborCost);
  const profitMargin   = grossMRR > 0 ? r2((netPortfolio / grossMRR) * 100) : 0;

  return { topRevenue, topProfit, bottomProfit, grossMRR, totalLaborCost, netPortfolio, profitMargin };
}

// ── Badge components ──────────────────────────────────────────────────────────

function RevBadge({ value }: { value: number }) {
  return (
    <span className="shrink-0 rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-teal-300 ring-1 ring-teal-500/30">
      ${fmtUSD(value)}
    </span>
  );
}

function ProfitBadge({ value }: { value: number }) {
  if (value > 0) return (
    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-300 ring-1 ring-emerald-500/30">
      +${fmtUSD(value)}
    </span>
  );
  if (value < 0) return (
    <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-red-400 ring-1 ring-red-500/30">
      −${fmtUSD(Math.abs(value))}
    </span>
  );
  return (
    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/50 ring-1 ring-white/20">
      $0
    </span>
  );
}

// ── Leaderboard card ──────────────────────────────────────────────────────────

function LeaderboardCard({
  title,
  subtitle,
  rows,
  badge,
}: {
  title:    string;
  subtitle: string;
  rows:     ClientRow[];
  badge:    "revenue" | "profit";
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#7020b8]/40 bg-[#2d0050]">
      {/* Pink header — auto-styled by global CSS: div.border-b:has(> h3) */}
      <div className="border-b px-4 py-3.5">
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        <p className="mt-0.5 text-[11px] text-white/65">{subtitle}</p>
      </div>

      {/* Ranked rows */}
      <div>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-white/40">No data available</p>
        )}
        {rows.map((row, i) => (
          <div
            key={row.code}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#4e008e]/60"
            style={{ backgroundColor: i % 2 === 0 ? "#1e0038" : "#2d0054" }}
          >
            {/* Rank number */}
            <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-[#8050b8]">
              {i + 1}
            </span>

            {/* Client name + code */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/clients/${row.code}`}
                className="block truncate text-xs font-semibold leading-tight text-white/90 transition-colors hover:text-[#f060c0]"
              >
                {row.name}
              </Link>
              <span className="font-mono text-[9px] leading-none text-[#7030a8]">
                {row.code}
              </span>
            </div>

            {/* Metric badge */}
            {badge === "revenue" ? (
              <RevBadge value={row.revenue} />
            ) : (
              <ProfitBadge value={row.netProfit} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { topRevenue, topProfit, bottomProfit, grossMRR, totalLaborCost, netPortfolio, profitMargin } =
    computeLeaderboards();

  const kpis = [
    {
      label: "Gross Monthly Revenue",
      value: `$${fmtUSD(grossMRR)}`,
      sub:   "contracted MRR",
      color: "text-teal-400",
    },
    {
      label: "Total Labor Cost",
      value: `$${fmtUSD(totalLaborCost)}`,
      sub:   "Harvest hours × employee rate",
      color: "text-rose-400",
    },
    {
      label: "Net Portfolio Profit",
      value: `${netPortfolio >= 0 ? "+" : "−"}$${fmtUSD(Math.abs(netPortfolio))}`,
      sub:   "revenue minus labor cost",
      color: netPortfolio >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Profit Margin",
      value: `${profitMargin.toFixed(1)}%`,
      sub:   "net profit ÷ revenue",
      color: profitMargin >= 30 ? "text-emerald-400" : profitMargin >= 0 ? "text-amber-400" : "text-red-400",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financial Leaderboards</h1>
        <p className="mt-1 text-sm text-[#8a6a90]">
          Server-computed · {CLIENTS.length} client records · monthly snapshot
        </p>
      </div>

      {/* ── Portfolio KPI strip ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k => (
          <div
            key={k.label}
            className="rounded-xl border border-[#7020b8]/40 bg-[#2d0050] p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">
              {k.label}
            </p>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="mt-0.5 text-[11px] text-white/40">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Section label ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#7020b8]/30" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8050b0]">
          Client Performance Rankings
        </span>
        <div className="h-px flex-1 bg-[#7020b8]/30" />
      </div>

      {/* ── 3-column leaderboard grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <LeaderboardCard
          title="Top 10 — Revenue"
          subtitle="Highest gross contract value · high → low"
          rows={topRevenue}
          badge="revenue"
        />
        <LeaderboardCard
          title="Top 10 — Net Profit"
          subtitle="Revenue minus labor cost · high → low"
          rows={topProfit}
          badge="profit"
        />
        <LeaderboardCard
          title="Bottom 10 — Net Profit"
          subtitle="Over-budget &amp; low-margin accounts · low → high"
          rows={bottomProfit}
          badge="profit"
        />
      </div>
    </div>
  );
}
